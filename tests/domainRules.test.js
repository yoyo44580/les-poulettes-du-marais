import test from "node:test";
import assert from "node:assert/strict";
import {
  getKennelBillableDays,
  getKennelCalendarStayDates,
  getOrderDuplicateSignature,
  getOrderDuplicateSignatureFromItems,
  getReservationTrackingSteps,
  isPaidAccompanistEducationActivity,
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
