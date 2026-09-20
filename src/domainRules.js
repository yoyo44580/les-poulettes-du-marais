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
