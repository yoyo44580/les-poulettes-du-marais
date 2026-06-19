import { useEffect, useRef, useState } from "react";
import { CheckCircle2, PenLine, Printer, X } from "lucide-react";

const PROVIDER = {
  name: "AUGUSTE Marie",
  company: "Les Poulettes du marais",
  legalForm: "Micro BA",
  address: "61 Les Ruelles, 44580 Bourneuf-en-Retz",
  phone: "06 70 20 38 91",
  email: "lespoulettesdumarais@gmail.com",
  insurance: "Thelem Assurances",
  siret: "89493132800013",
  registry: "RCS / RM : non concerné",
  website: "lespoulettesdumarais.fr",
};

const DECLARATION_LABELS = {
  identifiedVaccinated: "Mon chien est identifié et à jour de ses vaccinations.",
  parasitesTreated: "Mon chien est traité contre les parasites (puces, tiques et vermifuge).",
  healthy: "Mon chien est en bonne santé générale.",
  noContagiousDisease: "Mon chien ne présente aucune maladie contagieuse.",
  healthBookProvided: "Le carnet de santé sera fourni.",
  sociable: "Mon chien est sociable avec ses congénères.",
  notAggressive: "Mon chien n'a aucun comportement agressif envers les autres chiens.",
  groupSuitable: "Mon chien est apte à vivre en groupe restreint.",
  startedDayDue: "J'accepte que toute journée entamée soit due.",
  careModeAccepted: "J'accepte le mode de garde familial en groupe restreint.",
  foodProvided: "Je fournirai la nourriture habituelle en quantité suffisante pour le séjour.",
  belongingsProvided: "Je fournirai un couchage, des jouets ou des objets familiers (facultatif).",
  emergencyVetAccepted: "J'accepte que mon chien soit conduit chez un vétérinaire en cas d'urgence.",
  interactionRisksAccepted: "Je reconnais que les interactions entre chiens comportent des risques.",
  previsitAccepted: "J'accepte qu'une rencontre préalable ou une période d'essai puisse être demandée.",
  paymentTermsAccepted: "J'accepte les conditions tarifaires et de paiement.",
  lateFeesAccepted: "J'accepte que tout retard entraîne des frais supplémentaires.",
  legalMeasuresAccepted: "Je reconnais qu'en l'absence de nouvelles, des mesures légales pourront être engagées.",
  contractAccepted: "Je reconnais avoir pris connaissance des conditions et les accepter sans réserve.",
};

const OPTIONAL_DECLARATIONS = new Set(["belongingsProvided"]);
const REQUIRED_DECLARATION_KEYS = Object.keys(DECLARATION_LABELS).filter((key) => !OPTIONAL_DECLARATIONS.has(key));
const DEFAULT_DECLARATIONS = Object.fromEntries(
  Object.keys(DECLARATION_LABELS).map((key) => [key, !OPTIONAL_DECLARATIONS.has(key)])
);

function formatDate(value) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}

function getPointerPosition(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

export default function KennelContractModal({ booking, profile, contract, amount, dailyRate, isAdmin, onClose, onSign }) {
  const canvasRef = useRef(null);
  const documentRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [declarations, setDeclarations] = useState(contract?.snapshot?.declarations || DEFAULT_DECLARATIONS);
  const [photoConsent, setPhotoConsent] = useState(
    contract?.snapshot?.photoConsent === true
      ? "yes"
      : contract?.snapshot?.photoConsent === false
      ? "no"
      : booking?.photo_consent === true
      ? "yes"
      : booking?.photo_consent === false
      ? "no"
      : ""
  );
  const [mention, setMention] = useState("");
  const [ownerInsurance, setOwnerInsurance] = useState(
    contract?.snapshot?.owner?.insurance || booking?.client_insurance || ""
  );
  const [veterinarian, setVeterinarian] = useState(
    contract?.snapshot?.dog?.veterinarian || booking?.dog?.veterinarian_name || ""
  );
  const [birthDate, setBirthDate] = useState(contract?.snapshot?.dog?.birthDate || "");

  const signed = Boolean(contract?.signed_at);
  const dog = contract?.snapshot?.dog || booking?.dog || {};
  const owner = contract?.snapshot?.owner || {
    name: booking?.client_name || profile?.full_name || "",
    address: booking?.client_address || profile?.delivery_address || "",
    phone: booking?.phone || profile?.phone || "",
    email: booking?.client_email || profile?.email || "",
    insurance: ownerInsurance,
  };
  const stay = contract?.snapshot?.stay || {
    startDate: booking?.start_date,
    endDate: booking?.end_date,
    amount,
    dailyRate,
  };
  const allRequiredDeclarationsAccepted = REQUIRED_DECLARATION_KEYS.every((key) => declarations[key] === true);
  const currentDeclarations = signed
    ? Object.keys(contract?.snapshot?.declarations || {}).length > 0
      ? contract.snapshot.declarations
      : DEFAULT_DECLARATIONS
    : declarations;

  function declarationMark(key) {
    return currentDeclarations[key] === true ? "[x]" : "[ ]";
  }

  function photoConsentLabel() {
    if (photoConsent === "yes") return "autorisée";
    if (photoConsent === "no") return "refusée";
    return "non renseignée";
  }

  useEffect(() => {
    if (signed || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * ratio);
    canvas.height = Math.floor(canvas.clientHeight * ratio);
    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.5 * ratio;
    context.strokeStyle = "#263b2d";
  }, [signed]);

  function startDrawing(event) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    canvas.setPointerCapture?.(event.pointerId);
    const point = getPointerPosition(canvas, event);
    const context = canvas.getContext("2d");
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event) {
    if (!drawingRef.current || !canvasRef.current) return;
    const point = getPointerPosition(canvasRef.current, event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function signContract() {
    if (!ownerInsurance.trim() || !veterinarian.trim() || !birthDate || !allRequiredDeclarationsAccepted || !photoConsent || mention.trim().toLowerCase() !== "lu et approuvé" || !hasSignature) return;
    setSaving(true);
    const snapshot = {
      version: 2,
      provider: PROVIDER,
      owner: { ...owner, insurance: ownerInsurance.trim() },
      dog: {
        name: dog.name || "",
        breed: dog.breed || "",
        birthDate,
        birthYear: dog.birth_year || "",
        sex: dog.sex || "",
        sterilized: dog.sterilized === true,
        microchipNumber: dog.is_microchipped === false ? "Non pucé" : dog.microchip_number || "",
        vaccinesUpToDate: dog.vaccines_up_to_date === true,
        veterinarian: veterinarian.trim(),
      },
      stay,
      photoConsent: photoConsent === "yes",
      declarations,
      acceptedAt: new Date().toISOString(),
    };
    await onSign({ snapshot, signatureData: canvasRef.current.toDataURL("image/png"), signerName: owner.name });
    setSaving(false);
  }

  function printContract() {
    if (!documentRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.opener = null;
    printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Contrat pension - ${dog.name || "chien"}</title><style>body{font-family:Arial,sans-serif;color:#342822;margin:28px;line-height:1.42}.kennel-contract-document{max-width:900px;margin:auto}.contract-brand{display:flex;align-items:center;gap:16px;border-bottom:3px solid #527052;padding-bottom:16px}.contract-brand>img{width:82px;height:82px;object-fit:contain}.contract-brand div{flex:1}.contract-brand h1{margin:0;font-size:26px}.contract-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.contract-box{border:1px solid #d7cbb6;padding:14px;border-radius:8px}.contract-section{margin-top:18px}.contract-section h3{margin:0 0 8px;color:#36533d}.contract-section p{margin:5px 0}.contract-check-line{font-weight:600}.contract-legal-footer{display:flex;gap:14px;margin-top:22px;border-top:2px solid #527052;padding-top:14px;font-size:12px}.contract-legal-footer img{width:60px;height:60px;object-fit:contain}.contract-signature{margin-top:24px;border-top:2px solid #527052;padding-top:16px}.contract-signature img{display:block;max-width:320px;max-height:130px}@media print{body{margin:12mm}.contract-section{break-inside:avoid}}</style></head><body>${documentRef.current.outerHTML}<script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  }

  const signatureImage = contract?.signature_data;

  return (
    <div className="contract-modal" role="dialog" aria-modal="true" aria-label="Contrat de pension canine">
      <div className="contract-modal__panel">
        <header className="contract-modal__header">
          <div><span>Contrat de garde</span><h2>{dog.name || "Votre chien"}</h2></div>
          <button type="button" onClick={onClose} aria-label="Fermer"><X /></button>
        </header>

        <div className="kennel-contract-document" ref={documentRef}>
          <div className="contract-brand">
            <img src="/logo-poulettes.png" alt="Logo Les Poulettes du marais" />
            <div><h1>Pension canine à la ferme</h1><p>Contrat de transfert de garde</p></div>
            <strong>Les Poulettes du marais</strong>
          </div>
          <div className="contract-grid">
            <div className="contract-box"><h3>Le prestataire</h3><p><b>{PROVIDER.name}</b><br />{PROVIDER.company} - {PROVIDER.legalForm}<br />{PROVIDER.address}<br />{PROVIDER.phone}<br />{PROVIDER.email}<br />SIRET : {PROVIDER.siret}<br />{PROVIDER.registry}<br />Assurance : {PROVIDER.insurance}</p></div>
            <div className="contract-box"><h3>Le propriétaire</h3><p><b>{owner.name || "Non renseigné"}</b><br />{owner.address || "Adresse non renseignée"}<br />{owner.phone || "Téléphone non renseigné"}<br />{owner.email || "Email non renseigné"}<br />Assurance : {signed ? owner.insurance || "Non renseignée" : ownerInsurance || "À compléter"}</p></div>
          </div>
          <section className="contract-section"><h3>1. Objet du contrat</h3><p>Le présent contrat définit les conditions de garde du chien confié à la pension canine familiale, accueillant un maximum de 4 chiens simultanément.</p></section>
          <section className="contract-section"><h3>2. Identification du chien</h3><p><b>Nom :</b> {dog.name || "Non renseigné"}<br /><b>Race :</b> {dog.breed || "Non renseignée"}<br /><b>Date de naissance :</b> {(signed ? dog.birthDate : birthDate) ? formatDate(signed ? dog.birthDate : birthDate) : dog.birth_year || dog.birthYear || "Non renseignée"}<br /><b>Sexe :</b> {dog.sex || "Non renseigné"} - <b>Stérilisé :</b> {dog.sterilized ? "Oui" : "Non"}<br /><b>Numéro d'identification :</b> {dog.is_microchipped === false ? "Non pucé" : dog.microchip_number || dog.microchipNumber || "Non renseigné"}<br /><b>Vétérinaire habituel :</b> {signed ? dog.veterinarian || "Non renseigné" : veterinarian || "À compléter"}</p></section>
          <section className="contract-section"><h3>3. Conditions d'admission</h3><p>Le propriétaire déclare que son chien :</p><p className="contract-check-line">{declarationMark("identifiedVaccinated")} Est identifié et à jour de ses vaccinations</p><p className="contract-check-line">{declarationMark("parasitesTreated")} Est traité contre les parasites (puces, tiques et vermifuge)</p><p className="contract-check-line">{declarationMark("healthy")} Est en bonne santé générale</p><p className="contract-check-line">{declarationMark("noContagiousDisease")} Ne présente aucune maladie contagieuse</p><p className="contract-check-line">{declarationMark("healthBookProvided")} Carnet de santé fourni</p></section>
          <section className="contract-section"><h3>4. Engagement comportemental</h3><p>Le propriétaire s'engage sur l'honneur que son chien :</p><p className="contract-check-line">{declarationMark("sociable")} Est sociable avec ses congénères</p><p className="contract-check-line">{declarationMark("notAggressive")} N'a aucun comportement agressif envers les autres chiens</p><p className="contract-check-line">{declarationMark("groupSuitable")} Est apte à vivre en groupe restreint</p><p><b>En cas de comportement dangereux ou agressif constaté pendant le séjour :</b><br />La pension se réserve le droit d'interrompre immédiatement la garde. Le propriétaire devra récupérer son chien dans les plus brefs délais.</p></section>
          <section className="contract-section"><h3>5. Durée du séjour</h3><p><b>Date d'arrivée :</b> {formatDate(stay.startDate)}<br /><b>Date de départ :</b> {formatDate(stay.endDate)}</p><p className="contract-check-line">{declarationMark("startedDayDue")} J'accepte que toute journée entamée soit due</p></section>
          <section className="contract-section"><h3>6. Conditions de garde</h3><p>Le chien est accueilli dans un environnement familial, en groupe restreint de 4 chiens maximum, avec surveillance quotidienne.</p><p className="contract-check-line">{declarationMark("careModeAccepted")} Le propriétaire accepte ce mode de garde</p></section>
          <section className="contract-section"><h3>7. Alimentation et effets personnels</h3><p>Le propriétaire fournit :</p><p className="contract-check-line">{declarationMark("foodProvided")} La nourriture habituelle en quantité suffisante pour le séjour</p><p className="contract-check-line">{declarationMark("belongingsProvided")} Un couchage, des jouets ou des objets familiers (facultatif)</p></section>
          <section className="contract-section"><h3>8. Soins vétérinaires</h3><p>En cas de problème de santé :</p><p className="contract-check-line">{declarationMark("emergencyVetAccepted")} J'accepte que mon chien soit conduit chez un vétérinaire en cas d'urgence</p><p>Clinique vétérinaire des Iris, 44270 Machecoul - 02 40 78 52 83.</p></section>
          <section className="contract-section"><h3>9. Responsabilité</h3><p>La pension est assurée en responsabilité civile professionnelle auprès de {PROVIDER.insurance}.</p><p className="contract-check-line">{declarationMark("interactionRisksAccepted")} Je reconnais que les interactions entre chiens comportent des risques</p></section>
          <section className="contract-section"><h3>10. Chiens non stérilisés</h3><p>La pension se réserve le droit de refuser ou d'adapter l'accueil selon le sexe du chien, les périodes de chaleurs et son comportement.</p></section>
          <section className="contract-section"><h3>11. Rencontre préalable</h3><p className="contract-check-line">{declarationMark("previsitAccepted")} J'accepte qu'une rencontre préalable ou une période d'essai puisse être demandée avant validation du séjour</p></section>
          <section className="contract-section"><h3>12. Photos et communication</h3><p className="contract-check-line">{photoConsent === "yes" ? "[x]" : "[ ]"} J'autorise la pension à utiliser des photos ou vidéos de mon chien sur ses réseaux sociaux et son site internet</p><p className="contract-check-line">{photoConsent === "no" ? "[x]" : "[ ]"} Je refuse l'utilisation de photos ou vidéos de mon chien</p><p><b>Choix enregistré : {photoConsentLabel()}</b></p></section>
          <section className="contract-section"><h3>13. Tarifs et paiement</h3><p><b>Tarif journalier :</b> {Number(stay.dailyRate || 0).toFixed(2)} €<br /><b>Montant total du séjour :</b> {Number(stay.amount || 0).toFixed(2)} €<br /><b>Modalités de paiement :</b> chèque, espèces ou virement bancaire.</p><p className="contract-check-line">{declarationMark("paymentTermsAccepted")} J'accepte les conditions tarifaires et de paiement</p></section>
          <section className="contract-section"><h3>14. Retard et abandon</h3><p className="contract-check-line">{declarationMark("lateFeesAccepted")} J'accepte que tout retard entraîne des frais supplémentaires</p><p className="contract-check-line">{declarationMark("legalMeasuresAccepted")} Je reconnais qu'en l'absence de nouvelles, des mesures légales pourront être engagées</p></section>
          <section className="contract-section"><h3>15. Acceptation du contrat</h3><p className="contract-check-line">{declarationMark("contractAccepted")} Je reconnais avoir pris connaissance des conditions et les accepter sans réserve</p><p>Fait à Villeneuve-en-Retz, le {signed ? formatDate(String(contract.signed_at).slice(0, 10)) : "jour de la signature électronique"}.</p></section>
          <div className="contract-legal-footer"><img src="/logo-poulettes.png" alt="Logo" /><p><b>{PROVIDER.company}</b> - {PROVIDER.legalForm}<br />Responsable : {PROVIDER.name}<br />{PROVIDER.address}<br />SIRET : {PROVIDER.siret} - {PROVIDER.registry}<br />Assurance RC professionnelle : {PROVIDER.insurance}<br />{PROVIDER.phone} - {PROVIDER.email} - {PROVIDER.website}</p></div>
          {signed && <div className="contract-signature"><p>Signé électroniquement le <b>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(contract.signed_at))}</b><br />Mention : Lu et approuvé<br />Signataire : {contract.signer_name}</p>{signatureImage && <img src={signatureImage} alt="Signature du propriétaire" />}</div>}
        </div>

        {!signed && !isAdmin && <div className="contract-signing-form">
          <h3><PenLine size={20} /> Compléter et signer</h3>
          <div className="contract-signing-grid"><label><span>Assurance du propriétaire *</span><input value={ownerInsurance} onChange={(e) => setOwnerInsurance(e.target.value)} placeholder="Nom de l'assurance" /></label><label><span>Vétérinaire habituel *</span><input value={veterinarian} onChange={(e) => setVeterinarian(e.target.value)} placeholder="Nom ou clinique" /></label><label><span>Date de naissance exacte du chien *</span><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></label></div>
          <div className="contract-declaration-list">
            <h4>Déclarations à confirmer une par une</h4>
            {Object.entries(DECLARATION_LABELS).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={declarations[key] === true}
                  onChange={(event) => setDeclarations((current) => ({ ...current, [key]: event.target.checked }))}
                />
                <span>{label}{OPTIONAL_DECLARATIONS.has(key) ? " (facultatif)" : " *"}</span>
              </label>
            ))}
          </div>
          <fieldset><legend>Photos et vidéos du chien</legend><label><input type="radio" name="photo-consent" checked={photoConsent === "yes"} onChange={() => setPhotoConsent("yes")} /> J’autorise leur utilisation</label><label><input type="radio" name="photo-consent" checked={photoConsent === "no"} onChange={() => setPhotoConsent("no")} /> Je refuse leur utilisation</label></fieldset>
          <label><span>Mention obligatoire</span><input value={mention} onChange={(e) => setMention(e.target.value)} placeholder="Écrivez : Lu et approuvé" /></label>
          <div className="contract-signature-pad"><span>Votre signature</span><canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onPointerLeave={stopDrawing} /><button type="button" onClick={clearSignature}>Effacer la signature</button></div>
          <button className="primary-action" type="button" disabled={saving || !ownerInsurance.trim() || !veterinarian.trim() || !birthDate || !allRequiredDeclarationsAccepted || !photoConsent || mention.trim().toLowerCase() !== "lu et approuvé" || !hasSignature} onClick={signContract}><CheckCircle2 size={19} /> {saving ? "Enregistrement..." : "Signer définitivement"}</button>
        </div>}

        <footer className="contract-modal__footer"><button type="button" onClick={printContract}><Printer size={18} /> Imprimer ou enregistrer en PDF</button><button type="button" onClick={onClose}>Fermer</button></footer>
      </div>
    </div>
  );
}
