import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Dog,
  Mail,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";

export default function AdminAssistantPanel({
  todayLabel,
  todayItems,
  followups,
  onShortcut,
  onOpenView,
}) {
  return (
    <section className="admin-assistant-panel" data-section="assistant">
      <div className="admin-panel-title admin-panel-title--row">
        <span><ClipboardList size={24} /></span>
        <div>
          <h2>Assistant admin</h2>
          <p>La vue rapide pour savoir quoi faire maintenant et quoi relancer ensuite.</p>
        </div>
      </div>

      <div className="admin-assistant-grid">
        <article className="admin-assistant-block">
          <div className="admin-assistant-block__title">
            <CalendarDays size={22} />
            <div>
              <h3>Aujourd'hui</h3>
              <p>{todayLabel}</p>
            </div>
          </div>
          <div className="admin-assistant-list">
            {todayItems.map((item) => (
              <button key={item.id} type="button" onClick={item.action} className={item.count > 0 ? "has-items" : ""}>
                <strong>{item.count}</strong>
                <span>
                  <b>{item.title}</b>
                  <em>{item.detail}</em>
                </span>
                <small>{item.actionLabel}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="admin-assistant-block admin-assistant-block--followups">
          <div className="admin-assistant-block__title">
            <AlertTriangle size={22} />
            <div>
              <h3>À relancer</h3>
              <p>Paiements, vaccins, coordonnées et rappels internes.</p>
            </div>
          </div>
          <div className="admin-assistant-followups">
            {followups.map((item) => (
              <article key={item.id} className={`admin-assistant-followup admin-assistant-followup--${item.tone}`}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <button type="button" onClick={item.action}>{item.actionLabel}</button>
              </article>
            ))}
            {followups.length === 0 && (
              <p className="admin-assistant-empty">Aucune relance prioritaire pour le moment.</p>
            )}
          </div>
        </article>
      </div>

      <div className="admin-assistant-actions">
        <button type="button" onClick={() => onShortcut("toPrepare")}>
          <PackageCheck size={18} />
          Commandes à préparer
        </button>
        <button type="button" onClick={() => onShortcut("pendingReservations")}>
          <CalendarCheck size={18} />
          Réservations en attente
        </button>
        <button type="button" onClick={() => onOpenView("contacts")}>
          <Mail size={18} />
          Messages clients
        </button>
        <button type="button" onClick={() => onOpenView("kennelDogs")}>
          <Dog size={18} />
          Fiches chiens
        </button>
        <button type="button" onClick={() => onOpenView("health")}>
          <ShieldCheck size={18} />
          Santé appli
        </button>
      </div>
    </section>
  );
}
