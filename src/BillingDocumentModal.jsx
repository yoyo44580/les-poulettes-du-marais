import { Download, Printer, X } from "lucide-react";
import "./BillingDocumentModal.css";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}

export default function BillingDocumentModal({ document, referenceDocument, onClose }) {
  if (!document) return null;

  const provider = document.provider_snapshot || {};
  const customer = document.customer_snapshot || {};
  const lines = Array.isArray(document.lines) ? document.lines : [];
  const title = document.document_type === "credit_note" ? "Avoir" : "Facture";

  function printPdf() {
    const documentNode = window.document.querySelector(".billing-document-paper");
    if (!documentNode) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=920,height=760");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title} ${document.document_number}</title><style>body{font-family:Arial,sans-serif;color:#1f2d24;margin:24px}.billing-document-paper{max-width:820px;margin:auto}.billing-document-brand{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #315c3d;padding-bottom:18px}.billing-document-brand img{width:90px;height:90px;object-fit:contain}.billing-document-brand h1{margin:0;color:#315c3d}.billing-document-parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}.billing-document-party{border:1px solid #d7dfd8;padding:14px;border-radius:6px}.billing-document-party h2{font-size:14px;text-transform:uppercase;color:#687169}.billing-document-table{width:100%;border-collapse:collapse}.billing-document-table th,.billing-document-table td{padding:10px;border-bottom:1px solid #dfe5df;text-align:right}.billing-document-table th:first-child,.billing-document-table td:first-child{text-align:left}.billing-document-total{margin:22px 0 0 auto;width:320px}.billing-document-total div{display:flex;justify-content:space-between;padding:8px}.billing-document-total .is-final{border-top:2px solid #315c3d;font-size:18px;font-weight:bold}.billing-document-legal{margin-top:28px;border-top:1px solid #dfe5df;padding-top:16px;font-size:12px;color:#59645c}@media print{body{margin:10mm}}</style></head><body>${documentNode.outerHTML}<script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  }

  return (
    <div className="billing-document-modal" role="dialog" aria-modal="true" aria-labelledby="billing-document-title">
      <div className="billing-document-modal__toolbar">
        <button type="button" onClick={printPdf}><Download size={18} /> Enregistrer en PDF</button>
        <button type="button" onClick={printPdf}><Printer size={18} /> Imprimer</button>
        <button type="button" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
      </div>

      <article className="billing-document-paper">
        <header className="billing-document-brand">
          <div>
            <img src="/logo-poulettes.png" alt="Logo Les Poulettes du Marais" />
            <div>
              <strong>{provider.company || "Les Poulettes du Marais"}</strong>
              <span>{provider.legal_form || "Micro-BA"}</span>
            </div>
          </div>
          <div>
            <h1 id="billing-document-title">{title}</h1>
            <strong>{document.document_number}</strong>
            <span>Émise le {formatDateTime(document.issued_at)}</span>
            {referenceDocument && <span>Référence : {referenceDocument.document_number}</span>}
          </div>
        </header>

        <section className="billing-document-parties">
          <div className="billing-document-party">
            <h2>Émetteur</h2>
            <p><strong>{provider.name}</strong><br />{provider.company}<br />{provider.address}<br />SIRET : {provider.siret}<br />{provider.phone}<br />{provider.email}</p>
          </div>
          <div className="billing-document-party">
            <h2>Client</h2>
            <p><strong>{customer.name || "Client"}</strong><br />{customer.address || "Adresse non renseignée"}<br />{customer.email}<br />{customer.phone}</p>
          </div>
        </section>

        <div className="billing-document-meta">
          <span>Date de la prestation ou livraison : <strong>{formatDate(document.service_date)}</strong></span>
          <span>Échéance : <strong>{formatDate(document.due_date)}</strong></span>
        </div>

        <table className="billing-document-table">
          <thead><tr><th>Désignation</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th></tr></thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${document.id}-line-${index}`}>
                <td>{line.description}</td>
                <td>{line.quantity} {line.unit || ""}</td>
                <td>{formatCurrency(line.unit_price)}</td>
                <td>{formatCurrency(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="billing-document-total">
          <div><span>Total HT</span><strong>{formatCurrency(document.subtotal)}</strong></div>
          <div><span>TVA</span><strong>{formatCurrency(document.vat_amount)}</strong></div>
          <div className="is-final"><span>Total TTC</span><strong>{formatCurrency(document.total)}</strong></div>
        </div>

        <section className="billing-document-payment">
          <strong>{document.payment_status}</strong>
          <span>{document.payment_method || "Paiement à réception"}</span>
        </section>

        <footer className="billing-document-legal">
          <strong>{document.legal_notice}</strong>
          <p>Paiement à réception. Aucun escompte pour paiement anticipé.</p>
          <p>{provider.company} · {provider.address} · SIRET {provider.siret} · {provider.website}</p>
        </footer>
      </article>
    </div>
  );
}
