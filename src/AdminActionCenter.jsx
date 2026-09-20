import { AlertTriangle } from "lucide-react";

export default function AdminActionCenter({ sections }) {
  return (
    <section className="admin-action-center" data-section="actionCenter" aria-label="À traiter maintenant">
      <div className="admin-panel-title admin-panel-title--row">
        <span><AlertTriangle size={24} /></span>
        <div>
          <h2>À traiter maintenant</h2>
          <p>Un seul écran pour messages, réservations, paiements, contrats, ventes ponctuelles et relances clients.</p>
        </div>
      </div>

      <div className="admin-action-center__summary">
        {sections.map((section) => (
          <button
            key={`action-summary-${section.id}`}
            type="button"
            className={`admin-action-center__summary-card is-${section.tone}`}
            onClick={section.action}
          >
            <section.icon size={20} />
            <span>{section.title}</span>
            <strong>{section.count}</strong>
          </button>
        ))}
      </div>

      <div className="admin-action-center__grid">
        {sections.map((section) => (
          <article key={section.id} className={`admin-action-card admin-action-card--${section.tone}`}>
            <div className="admin-action-card__header">
              <span><section.icon size={20} /></span>
              <div>
                <h3>{section.title}</h3>
                <p>{section.count} élément{section.count > 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="admin-action-card__list">
              {section.items.map((item) => (
                <button key={`${section.id}-${item.id}`} type="button" onClick={item.action}>
                  <strong>{item.title}</strong>
                  <em>{item.detail}</em>
                </button>
              ))}
              {section.items.length === 0 && <p>{section.empty}</p>}
            </div>

            <button type="button" className="admin-action-card__main-action" onClick={section.action}>
              {section.actionLabel}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
