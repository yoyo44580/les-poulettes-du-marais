import test from "node:test";
import assert from "node:assert/strict";
import {
  getActiveEducationParticipantCount,
  getCappedProductQuantity,
  getClientOrderCancelInfo,
  getClientOrderMaxDeliveryDate,
  getKennelBillableDays,
  getKennelCalendarStayDates,
  getOrderDuplicateSignature,
  getOrderDuplicateSignatureFromItems,
  getReservationTrackingSteps,
  hasDuplicateEducationBooking,
  isClientDeliveryDateAllowed,
  isPaidAccompanistEducationActivity,
  isProductQuantityAvailable,
  isTreasureHuntActivity,
} from "../src/domainRules.js";

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
