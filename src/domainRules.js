export function getLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getKennelCalendarStayDates(startDate, endDate) {
  const dates = [];

  if (!startDate || !endDate || endDate < startDate) {
    return dates;
  }

  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    dates.push(getLocalIsoDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function getKennelBookingDays(startDate, endDate) {
  return getKennelCalendarStayDates(startDate, endDate).length;
}

export function getKennelBillableDays(startDate, endDate, arrivalTime = "09:00", departureTime = "18:00") {
  const calendarDays = getKennelBookingDays(startDate, endDate);

  if (calendarDays <= 0) {
    return 0;
  }

  if (calendarDays === 1) {
    return 1;
  }

  const isAfternoonArrival = String(arrivalTime || "09:00") >= "12:00";
  const isMorningDeparture = String(departureTime || "18:00") < "12:00";
  const firstDay = isAfternoonArrival ? 0.5 : 1;
  const lastDay = isMorningDeparture ? 0.5 : 1;
  const middleDays = Math.max(0, calendarDays - 2);

  return firstDay + middleDays + lastDay;
}

export function normalizeOrderStatus(status) {
  const legacyStatuses = {
    "Récupérée": "Livrée",
  };

  return legacyStatuses[status] || status;
}

export function normalizeStatusKeyword(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getTrackedProductStock(product) {
  if (product?.stock_quantity === null || product?.stock_quantity === undefined) {
    return null;
  }

  return Math.max(0, Math.floor(Number(product.stock_quantity) || 0));
}

export function isProductQuantityAvailable(product, quantity) {
  if (!product || product.active === false) {
    return false;
  }

  const stock = getTrackedProductStock(product);
  const requestedQuantity = Math.max(0, Number(quantity) || 0);

  return stock === null || requestedQuantity <= stock;
}

export function getCappedProductQuantity(product, currentQuantity, delta) {
  const requestedQuantity = Math.max(0, (Number(currentQuantity) || 0) + Number(delta || 0));
  const stock = getTrackedProductStock(product);

  return stock === null ? requestedQuantity : Math.min(requestedQuantity, stock);
}

export function getClientOrderMaxDeliveryDate(todayIso, maxDays = 14) {
  if (!todayIso) return "";

  const date = new Date(`${todayIso}T12:00:00`);
  date.setDate(date.getDate() + maxDays);
  return getLocalIsoDate(date);
}

export function isClientDeliveryDateAllowed(deliveryDate, todayIso, maxDays = 14) {
  if (!deliveryDate || !todayIso) return false;

  return deliveryDate >= todayIso && deliveryDate <= getClientOrderMaxDeliveryDate(todayIso, maxDays);
}

const clientOrderCancelWindowMs = 6 * 60 * 60 * 1000;

export function getClientOrderCancelInfo(order, now = Date.now()) {
  const normalizedStatus = normalizeOrderStatus(order?.status || "");
  const createdAt = order?.created_at ? new Date(order.created_at) : null;
  const createdTime = createdAt?.getTime();

  if (!order || normalizedStatus === "Annulée") {
    return { canCancel: false, reason: "Commande déjà annulée." };
  }

  if (!["À préparer", "A préparer", "Demandée", "Demandee"].includes(normalizedStatus)) {
    return { canCancel: false, reason: "La commande est déjà en préparation avancée." };
  }

  if (!createdAt || Number.isNaN(createdTime)) {
    return { canCancel: false, reason: "Heure de création indisponible." };
  }

  const expiresAt = new Date(createdTime + clientOrderCancelWindowMs);

  if (Number(now) > expiresAt.getTime()) {
    return { canCancel: false, expiresAt, reason: "Le délai d'annulation de 6h est dépassé." };
  }

  return { canCancel: true, expiresAt, reason: "" };
}

export function isActiveReservationStatus(status) {
  return !normalizeStatusKeyword(status).startsWith("annul");
}

function normalizePerson(value) {
  return String(value || "").trim().toLocaleLowerCase("fr");
}

export function getEducationPeopleSignature({ accompanistName, additionalAccompanists = [], children = [] }) {
  return [
    `adult:${normalizePerson(accompanistName)}`,
    ...additionalAccompanists.map((accompanist) => `adult:${normalizePerson(accompanist)}`).sort(),
    ...children
      .map((child) => `${normalizePerson(child.firstName || child.first_name)}:${Number(child.age || 0)}`)
      .sort(),
  ].join("|");
}

export function hasDuplicateEducationBooking(bookings, request) {
  const requestedPeopleSignature = getEducationPeopleSignature(request);

  return (bookings || []).some((booking) =>
    String(booking.user_id || "") === String(request.userId || "") &&
    String(booking.date_slot_id || "") === String(request.dateSlotId || "") &&
    isActiveReservationStatus(booking.status) &&
    getEducationPeopleSignature({
      accompanistName: booking.accompanist_name,
      additionalAccompanists: Array.isArray(booking.additional_accompanists)
        ? booking.additional_accompanists
        : [],
      children: Array.isArray(booking.children) ? booking.children : [],
    }) === requestedPeopleSignature
  );
}

export function getActiveEducationParticipantCount(bookings) {
  return (bookings || [])
    .filter((booking) => isActiveReservationStatus(booking.status))
    .reduce((sum, booking) => sum + Number(booking.participants || 0), 0);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isRecordLinkedToClient(record, userId, email) {
  const recordUserId = String(record?.user_id || "");
  const clientUserId = String(userId || "");
  const recordEmail = normalizeEmail(record?.client_email || record?.email);
  const clientEmail = normalizeEmail(email);

  return (
    (clientUserId && recordUserId === clientUserId) ||
    (clientEmail && recordEmail === clientEmail)
  );
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

export function getClientBillingDocuments({
  documents = [],
  profile,
  orders = [],
  educationBookings = [],
  kennelBookings = [],
}) {
  if (!profile) return [];

  const profileId = String(profile.id || "");
  const profileEmail = normalizeEmail(profile.email);
  const profilePhone = normalizePhone(profile.phone);
  const linkedSourceIds = new Set([
    ...orders.map((order) => `order:${String(order.id)}`),
    ...educationBookings.map((booking) => `education:${String(booking.id)}`),
    ...kennelBookings.map((booking) => `kennel:${String(booking.id)}`),
  ]);

  return documents.filter((document) => {
    const documentUserId = String(document.user_id || "");
    const snapshotEmail = normalizeEmail(document.customer_snapshot?.email);
    const snapshotPhone = normalizePhone(document.customer_snapshot?.phone);
    const sourceKey = `${String(document.source_type || "")}:${String(document.source_id || "")}`;

    return (
      (profileId && documentUserId === profileId) ||
      linkedSourceIds.has(sourceKey) ||
      (profileEmail && snapshotEmail === profileEmail) ||
      (profilePhone && snapshotPhone === profilePhone)
    );
  });
}

export function getUnsignedConfirmedKennelBookings(
  bookings,
  contracts,
  todayIso,
  reminderDays = 7,
) {
  const limitDate = getClientOrderMaxDeliveryDate(todayIso, reminderDays);
  const signedBookingIds = new Set((contracts || []).map((contract) => String(contract.booking_id)));

  return (bookings || [])
    .filter((booking) => {
      const status = normalizeStatusKeyword(booking.status);
      const startDate = String(booking.start_date || "");

      return (
        status.startsWith("confirm") &&
        startDate >= todayIso &&
        startDate <= limitDate &&
        !signedBookingIds.has(String(booking.id))
      );
    })
    .sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")));
}

export function isKennelContractReminderDue(booking, contracts, todayIso, reminderDays = 7) {
  return getUnsignedConfirmedKennelBookings(
    booking ? [booking] : [],
    contracts,
    todayIso,
    reminderDays,
  ).length > 0;
}

export function getBookingPaymentSummary(booking, amount) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const deposit = Math.max(0, Number(booking?.deposit_amount) || 0);
  const received = booking?.payment_received === true;
  const paidAmount = received ? safeAmount : Math.min(deposit, safeAmount);
  const remaining = Math.max(0, safeAmount - paidAmount);
  const method = booking?.payment_method || "Non renseigné";

  return {
    deposit,
    received,
    paidAmount,
    remaining,
    method,
    label: received ? "Paiement reçu" : deposit > 0 ? "Acompte payé" : "Paiement à suivre",
    tone: received ? "paid" : deposit > 0 ? "partial" : "missing",
  };
}

export function isKennelPaymentOverdue(booking, amount, todayIso) {
  const status = normalizeStatusKeyword(booking?.status);
  const endDate = String(booking?.end_date || booking?.start_date || "");

  return (
    !booking?.archived_at &&
    (status.startsWith("confirm") || status.startsWith("termine")) &&
    !status.startsWith("annul") &&
    Number(amount || 0) > 0 &&
    booking?.payment_received !== true &&
    Boolean(endDate) &&
    endDate < todayIso
  );
}

export function isContactMessageArchived(message) {
  return Boolean(message?.archived_at) || normalizeStatusKeyword(message?.status) === "traite";
}

export function getUnreadAdminReplies(replies, contactMessageIds, clientMessagesSeenAt = "") {
  const messageIds = contactMessageIds instanceof Set
    ? contactMessageIds
    : new Set(contactMessageIds || []);

  return (replies || [])
    .filter((reply) =>
      reply.sender_role === "admin" &&
      messageIds.has(reply.contact_message_id) &&
      !reply.client_read_at &&
      (!clientMessagesSeenAt || String(reply.created_at || "") > clientMessagesSeenAt)
    )
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

export async function collectPaginatedRows(fetchPage, pageSize = 500) {
  const rows = [];
  let from = 0;
  let totalCount = null;

  while (true) {
    const { data, error, count } = await fetchPage(from, from + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);

    if (Number.isFinite(count)) {
      totalCount = count;
    }

    if (
      page.length === 0 ||
      (totalCount !== null && rows.length >= totalCount) ||
      (totalCount === null && page.length < pageSize)
    ) {
      return { data: rows, error: null };
    }

    from += page.length;
  }
}

export function getOrderItems(order) {
  if (Array.isArray(order?.items) && order.items.length > 0) {
    return order.items;
  }

  return [
    {
      product_id: "box6",
      name: "Boite de 6 œufs",
      quantity: order?.box6 || 0,
      unit_label: "boite",
      size_eggs: 6,
    },
    {
      product_id: "box12",
      name: "Boite de 12 œufs",
      quantity: order?.box12 || 0,
      unit_label: "boite",
      size_eggs: 12,
    },
  ].filter((item) => item.quantity > 0);
}

export function getOrderDuplicateSignatureFromItems(items) {
  return (items || [])
    .filter((item) => Number(item.quantity || 0) > 0)
    .map((item) => ({
      key: String(item.product_id || item.name || "").trim().toLowerCase(),
      quantity: Number(item.quantity || 0),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => `${item.key}:${item.quantity}`)
    .join("|");
}

export function getOrderDuplicateSignature(order) {
  return getOrderDuplicateSignatureFromItems(getOrderItems(order));
}

function normalizeActivityName(activity) {
  return String(activity?.name || activity?.activity_type || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isPaidAccompanistEducationActivity(activity) {
  const normalizedName = normalizeActivityName(activity);

  return (normalizedName.includes("visite") && normalizedName.includes("guide")) ||
    (normalizedName.includes("rallye") && normalizedName.includes("photo"));
}

export function isTreasureHuntActivity(activity) {
  const normalizedName = normalizeActivityName(activity);

  return normalizedName.includes("jeu de piste") ||
    String(activity?.id || "").toLowerCase().includes("piste");
}

export function getReservationTrackingSteps(kind, booking, { hasSignedContract = false, todayIso = "" } = {}) {
  const status = normalizeStatusKeyword(booking?.status || "Demandee");
  const isCancelled = status.startsWith("annul");
  const isConfirmed = status.startsWith("confirm") || status.startsWith("termine");
  const isFinished =
    status.startsWith("termine") ||
    (kind === "kennel"
      ? Boolean(booking?.end_date) && String(booking.end_date) < todayIso
      : Boolean(booking?.booking_date) && String(booking.booking_date) < todayIso && isConfirmed);

  if (isCancelled) {
    return [
      { label: "Demande envoyée", state: "done" },
      { label: "Annulée", state: "cancelled" },
    ];
  }

  const baseSteps = [
    { label: "Demande envoyée", state: "done" },
    { label: "En attente de confirmation", state: isConfirmed || isFinished ? "done" : "current" },
    { label: "Confirmée", state: isConfirmed || isFinished ? "done" : "todo" },
  ];

  if (kind === "kennel") {
    baseSteps.push({
      label: hasSignedContract ? "Contrat signé" : "Contrat à signer",
      state: isFinished || hasSignedContract ? "done" : isConfirmed ? "current" : "todo",
    });
    baseSteps.push({
      label: "Séjour terminé",
      state: isFinished ? "done" : "todo",
    });
    return baseSteps;
  }

  baseSteps.push({
    label: "Activité terminée",
    state: isFinished ? "done" : "todo",
  });

  return baseSteps;
}
