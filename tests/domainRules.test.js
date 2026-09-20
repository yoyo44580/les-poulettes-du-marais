import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPaginatedRows,
  getActiveEducationParticipantCount,
  getBookingPaymentSummary,
  getCappedProductQuantity,
  getClientBillingDocuments,
  getClientOrderCancelInfo,
  getClientOrderMaxDeliveryDate,
  getKennelMultiDogPricing,
  getKennelBillableDays,
  getKennelCalendarStayDates,
  getOrderDuplicateSignature,
  getOrderDuplicateSignatureFromItems,
  getReservationTrackingSteps,
  getUnreadAdminReplies,
  getUnsignedConfirmedKennelBookings,
  hasDuplicateEducationBooking,
  isClientDeliveryDateAllowed,
  isContactMessageArchived,
  isKennelContractReminderDue,
  isKennelPaymentOverdue,
  isPaidAccompanistEducationActivity,
  isProductQuantityAvailable,
  isRecordLinkedToClient,
  isTreasureHuntActivity,
  validateKennelBookingDogs,
} from "../src/domainRules.js";

test("toutes les commandes sont chargées même lorsque Supabase limite chaque réponse", async () => {
  const source = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }));
  const requestedStarts = [];
  const { data, error } = await collectPaginatedRows(async (from) => {
    requestedStarts.push(from);
    return {
      data: source.slice(from, from + 2),
      error: null,
      count: source.length,
    };
  });

  assert.equal(error, null);
  assert.deepEqual(data, source);
  assert.deepEqual(requestedStarts, [0, 2, 4]);
});

test("une erreur de chargement paginé est transmise sans masquer le problème", async () => {
  const expectedError = new Error("chargement impossible");
  const result = await collectPaginatedRows(async () => ({ data: null, error: expectedError, count: null }));

  assert.equal(result.data, null);
  assert.equal(result.error, expectedError);
});

test("le calendrier pension inclut tous les jours du séjour", () => {
  assert.deepEqual(getKennelCalendarStayDates("2026-09-20", "2026-09-22"), [
    "2026-09-20",
    "2026-09-21",
    "2026-09-22",
  ]);
});

test("une réservation pension d'une seule journée facture une journée", () => {
  assert.equal(getKennelBillableDays("2026-09-20", "2026-09-20", "14:00", "17:00"), 1);
});

test("les demi-journées d'arrivée et de départ sont prises en compte", () => {
  assert.equal(getKennelBillableDays("2026-09-20", "2026-09-22", "14:00", "10:00"), 2);
  assert.equal(getKennelBillableDays("2026-09-20", "2026-09-22", "09:00", "18:00"), 3);
});

test("des dates pension invalides ne produisent aucun jour facturé", () => {
  assert.equal(getKennelBillableDays("2026-09-22", "2026-09-20"), 0);
  assert.equal(getKennelBillableDays("", "2026-09-20"), 0);
});

test("une demande pension accepte plusieurs chiens correctement renseignés", () => {
  assert.deepEqual(
    validateKennelBookingDogs([
      { dogName: "Sakura", dogMicrochipNumber: "250001", dogNotMicrochipped: false },
      { dogName: "Nala", dogMicrochipNumber: "", dogNotMicrochipped: true },
    ]),
    { valid: true, code: "ok" },
  );
});

test("une demande pension refuse un chien incomplet ou plus de quatre chiens", () => {
  assert.deepEqual(
    validateKennelBookingDogs([{ dogName: "Sakura", dogMicrochipNumber: "", dogNotMicrochipped: false }]),
    { valid: false, code: "missing_microchip", index: 0 },
  );
  assert.equal(
    validateKennelBookingDogs(Array.from({ length: 5 }, (_, index) => ({
      dogName: `Chien ${index + 1}`,
      dogNotMicrochipped: true,
    }))).code,
    "too_many_dogs",
  );
});

test("le deuxième chien bénéficie automatiquement de dix pour cent de remise", () => {
  assert.deepEqual(getKennelMultiDogPricing(100, 2), {
    unitAmount: 100,
    dogCount: 2,
    secondDogDiscount: 10,
    perDogAmounts: [100, 90],
    total: 190,
  });
  assert.deepEqual(getKennelMultiDogPricing(100, 3).perDogAmounts, [100, 90, 100]);
});

test("aucune remise deuxième chien n'est appliquée pour une réservation simple", () => {
  assert.equal(getKennelMultiDogPricing(75.5, 1).total, 75.5);
  assert.equal(getKennelMultiDogPricing(75.5, 1).secondDogDiscount, 0);
});

test("la signature anti-doublon ne dépend pas de l'ordre des produits", () => {
  const first = getOrderDuplicateSignatureFromItems([
    { product_id: "box12", quantity: 1 },
    { product_id: "courgette", quantity: 3 },
  ]);
  const second = getOrderDuplicateSignatureFromItems([
    { product_id: "courgette", quantity: 3 },
    { product_id: "box12", quantity: 1 },
  ]);

  assert.equal(first, second);
  assert.notEqual(first, getOrderDuplicateSignatureFromItems([{ product_id: "box12", quantity: 2 }]));
});

test("les anciennes commandes d'œufs utilisent aussi la protection anti-doublon", () => {
  assert.equal(getOrderDuplicateSignature({ box6: 2, box12: 1 }), "box12:1|box6:2");
});

test("seules les visites guidées et rallyes photo facturent les accompagnateurs", () => {
  assert.equal(isPaidAccompanistEducationActivity({ name: "Visite guidée de la ferme" }), true);
  assert.equal(isPaidAccompanistEducationActivity({ name: "Rallye photo" }), true);
  assert.equal(isPaidAccompanistEducationActivity({ name: "Atelier beurre" }), false);
  assert.equal(isPaidAccompanistEducationActivity({ name: "Atelier savon" }), false);
  assert.equal(isPaidAccompanistEducationActivity({ name: "Jouets perdus" }), false);
});

test("le jeu de piste est reconnu par son nom ou son identifiant", () => {
  assert.equal(isTreasureHuntActivity({ name: "Jeu de piste à la ferme" }), true);
  assert.equal(isTreasureHuntActivity({ id: "activite-piste", name: "Aventure" }), true);
  assert.equal(isTreasureHuntActivity({ name: "Atelier savon" }), false);
});

test("une réservation annulée apparaît bien annulée dans le suivi client", () => {
  assert.deepEqual(getReservationTrackingSteps("kennel", { status: "Annulée" }), [
    { label: "Demande envoyée", state: "done" },
    { label: "Annulée", state: "cancelled" },
  ]);
});

test("un contrat pension non signé reste clairement à signer", () => {
  const steps = getReservationTrackingSteps(
    "kennel",
    { status: "Confirmée", end_date: "2026-09-25" },
    { hasSignedContract: false, todayIso: "2026-09-20" },
  );

  assert.deepEqual(steps.at(-2), { label: "Contrat à signer", state: "current" });
  assert.deepEqual(steps.at(-1), { label: "Séjour terminé", state: "todo" });
});

test("un produit suivi avec un stock à zéro ne peut pas être commandé", () => {
  const product = { id: "courgette-ronde", active: true, stock_quantity: 0 };

  assert.equal(isProductQuantityAvailable(product, 1), false);
  assert.equal(getCappedProductQuantity(product, 0, 1), 0);
});

test("la quantité du panier ne peut jamais dépasser le stock disponible", () => {
  const product = { id: "courgette", active: true, stock_quantity: 3 };

  assert.equal(getCappedProductQuantity(product, 2, 1), 3);
  assert.equal(getCappedProductQuantity(product, 3, 1), 3);
  assert.equal(isProductQuantityAvailable(product, 3), true);
  assert.equal(isProductQuantityAvailable(product, 4), false);
});

test("un produit sans suivi de stock reste commandable", () => {
  const product = { id: "box12", active: true, stock_quantity: null };

  assert.equal(getCappedProductQuantity(product, 12, 1), 13);
  assert.equal(isProductQuantityAvailable(product, 100), true);
});

test("les commandes client sont limitées à quatorze jours", () => {
  assert.equal(getClientOrderMaxDeliveryDate("2026-09-20"), "2026-10-04");
  assert.equal(isClientDeliveryDateAllowed("2026-10-04", "2026-09-20"), true);
  assert.equal(isClientDeliveryDateAllowed("2026-10-05", "2026-09-20"), false);
  assert.equal(isClientDeliveryDateAllowed("2026-09-19", "2026-09-20"), false);
});

test("une commande reste annulable jusqu'à six heures après sa création", () => {
  const createdAt = "2026-09-20T08:00:00.000Z";
  const order = { status: "À préparer", created_at: createdAt };

  assert.equal(getClientOrderCancelInfo(order, Date.parse("2026-09-20T13:59:59.000Z")).canCancel, true);
  assert.equal(getClientOrderCancelInfo(order, Date.parse("2026-09-20T14:00:01.000Z")).canCancel, false);
});

test("une commande déjà préparée ou annulée ne peut plus être annulée", () => {
  const now = Date.parse("2026-09-20T09:00:00.000Z");

  assert.equal(getClientOrderCancelInfo({ status: "Prête", created_at: "2026-09-20T08:00:00.000Z" }, now).canCancel, false);
  assert.equal(getClientOrderCancelInfo({ status: "Annulée", created_at: "2026-09-20T08:00:00.000Z" }, now).canCancel, false);
});

test("une réservation ferme identique est reconnue malgré l'ordre des participants", () => {
  const bookings = [{
    user_id: "client-1",
    date_slot_id: "slot-1",
    status: "Demandée",
    accompanist_name: "Mme Dupont",
    additional_accompanists: ["Paul", "Anne"],
    children: [{ firstName: "Léa", age: 8 }, { first_name: "Hugo", age: 6 }],
  }];

  assert.equal(hasDuplicateEducationBooking(bookings, {
    userId: "client-1",
    dateSlotId: "slot-1",
    accompanistName: "mme dupont",
    additionalAccompanists: ["Anne", "Paul"],
    children: [{ firstName: "Hugo", age: 6 }, { firstName: "Léa", age: 8 }],
  }), true);
});

test("une réservation ferme annulée ne bloque pas une nouvelle demande", () => {
  const cancelledBooking = {
    user_id: "client-1",
    date_slot_id: "slot-1",
    status: "Annulée",
    accompanist_name: "Mme Dupont",
    children: [{ firstName: "Léa", age: 8 }],
  };

  assert.equal(hasDuplicateEducationBooking([cancelledBooking], {
    userId: "client-1",
    dateSlotId: "slot-1",
    accompanistName: "Mme Dupont",
    children: [{ firstName: "Léa", age: 8 }],
  }), false);
});

test("les réservations annulées libèrent les places du créneau ferme", () => {
  const bookings = [
    { status: "Confirmée", participants: 4 },
    { status: "Annulée", participants: 3 },
    { status: "Demandée", participants: 2 },
  ];

  assert.equal(getActiveEducationParticipantCount(bookings), 6);
});

test("une facture est rattachée directement au bon compte client", () => {
  const documents = [
    { id: "invoice-1", user_id: "client-1", source_type: "kennel", source_id: "stay-1" },
    { id: "invoice-2", user_id: "client-2", source_type: "kennel", source_id: "stay-2" },
  ];

  assert.deepEqual(getClientBillingDocuments({
    documents,
    profile: { id: "client-1", email: "client@example.com", phone: "06 11 22 33 44" },
  }).map((document) => document.id), ["invoice-1"]);
});

test("une facture de réservation manuelle reste visible grâce à sa source", () => {
  const documents = [{
    id: "invoice-sakura",
    user_id: "admin-id",
    source_type: "kennel",
    source_id: "stay-sakura",
    customer_snapshot: { email: "", phone: "" },
  }];

  assert.deepEqual(getClientBillingDocuments({
    documents,
    profile: { id: "client-1", email: "sakura@example.com", phone: "0611223344" },
    kennelBookings: [{ id: "stay-sakura" }],
  }).map((document) => document.id), ["invoice-sakura"]);
});

test("une réservation manuelle reste visible grâce à l'identifiant du compte", () => {
  const manualBooking = {
    user_id: "client-1",
    client_email: "ancienne-adresse@example.com",
  };

  assert.equal(isRecordLinkedToClient(manualBooking, "client-1", "nouvelle-adresse@example.com"), true);
  assert.equal(isRecordLinkedToClient(manualBooking, "client-2", "nouvelle-adresse@example.com"), false);
});

test("des coordonnées vides ne rattachent jamais la facture d'un autre client", () => {
  const documents = [{
    id: "invoice-other",
    user_id: "client-2",
    source_type: "order",
    source_id: "order-2",
    customer_snapshot: { email: "", phone: "" },
  }];

  assert.deepEqual(getClientBillingDocuments({
    documents,
    profile: { id: "client-1", email: "", phone: "" },
  }), []);
});

test("seuls les contrats confirmés des sept prochains jours sont à relancer", () => {
  const bookings = [
    { id: "today", status: "Confirmée", start_date: "2026-09-20" },
    { id: "day-seven", status: "Confirmée", start_date: "2026-09-27" },
    { id: "day-eight", status: "Confirmée", start_date: "2026-09-28" },
    { id: "requested", status: "Demandée", start_date: "2026-09-22" },
    { id: "cancelled", status: "Annulée", start_date: "2026-09-22" },
  ];

  assert.deepEqual(
    getUnsignedConfirmedKennelBookings(bookings, [], "2026-09-20").map((booking) => booking.id),
    ["today", "day-seven"],
  );
});

test("un contrat signé retire immédiatement la relance", () => {
  const booking = { id: "stay-1", status: "Confirmée", start_date: "2026-09-23" };

  assert.equal(isKennelContractReminderDue(booking, [], "2026-09-20"), true);
  assert.equal(isKennelContractReminderDue(booking, [{ booking_id: "stay-1" }], "2026-09-20"), false);
});

test("seul un séjour confirmé terminé et non payé est en retard", () => {
  const baseBooking = {
    status: "Confirmée",
    start_date: "2026-09-10",
    end_date: "2026-09-12",
    payment_received: false,
  };

  assert.equal(isKennelPaymentOverdue(baseBooking, 100, "2026-09-20"), true);
  assert.equal(isKennelPaymentOverdue({ ...baseBooking, end_date: "2026-09-21" }, 100, "2026-09-20"), false);
  assert.equal(isKennelPaymentOverdue({ ...baseBooking, payment_received: true }, 100, "2026-09-20"), false);
  assert.equal(isKennelPaymentOverdue({ ...baseBooking, status: "Annulée" }, 100, "2026-09-20"), false);
  assert.equal(isKennelPaymentOverdue({ ...baseBooking, status: "Demandée" }, 100, "2026-09-20"), false);
  assert.equal(isKennelPaymentOverdue({ ...baseBooking, archived_at: "2026-09-19" }, 100, "2026-09-20"), false);
});

test("le reste à payer tient compte de l'acompte et du paiement reçu", () => {
  assert.equal(getBookingPaymentSummary({ deposit_amount: 30 }, 100).remaining, 70);
  assert.equal(getBookingPaymentSummary({ deposit_amount: 30, payment_received: true }, 100).remaining, 0);
  assert.equal(getBookingPaymentSummary({ deposit_amount: 150 }, 100).remaining, 0);
});

test("seules les réponses admin liées et réellement non lues déclenchent un badge", () => {
  const replies = [
    { id: "new", contact_message_id: "message-1", sender_role: "admin", created_at: "2026-09-20T10:00:00Z", client_read_at: null },
    { id: "old", contact_message_id: "message-1", sender_role: "admin", created_at: "2026-09-20T08:00:00Z", client_read_at: null },
    { id: "read", contact_message_id: "message-1", sender_role: "admin", created_at: "2026-09-20T11:00:00Z", client_read_at: "2026-09-20T11:05:00Z" },
    { id: "client", contact_message_id: "message-1", sender_role: "client", created_at: "2026-09-20T12:00:00Z", client_read_at: null },
    { id: "other", contact_message_id: "message-2", sender_role: "admin", created_at: "2026-09-20T12:00:00Z", client_read_at: null },
  ];

  assert.deepEqual(
    getUnreadAdminReplies(replies, ["message-1"], "2026-09-20T09:00:00Z").map((reply) => reply.id),
    ["new"],
  );
});

test("un message traité ou archivé quitte bien la liste active", () => {
  assert.equal(isContactMessageArchived({ status: "Traité" }), true);
  assert.equal(isContactMessageArchived({ status: "Nouveau", archived_at: "2026-09-20T10:00:00Z" }), true);
  assert.equal(isContactMessageArchived({ status: "Nouveau", archived_at: null }), false);
});
