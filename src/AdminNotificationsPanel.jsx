import { BellRing } from "lucide-react";

const notificationFilters = [
  { value: "unread", label: "Non vues" },
  { value: "all", label: "Toutes" },
  { value: "Commandes", label: "Commandes" },
  { value: "Messages", label: "Messages" },
  { value: "Ferme", label: "Ferme" },
  { value: "Pension", label: "Pension" },
  { value: "Ventes", label: "Ventes" },
];

export default function AdminNotificationsPanel({
  unreadCount,
  counts,
  paymentFollowupCount,
  activeFilter,
  notifications,
  formatDateTime,
  onFilterChange,
  onMarkAllSeen,
  onMarkSeen,
}) {
  return (
    <section className="admin-products-panel admin-notifications-panel" data-section="notifications">
      <div className="admin-panel-title admin-panel-title--row">
        <span><BellRing size={24} /></span>
        <div>
          <h2>Centre de notifications</h2>
          <p>Commandes, messages, réservations et annulations à suivre au même endroit.</p>
        </div>
      </div>

      <div className="admin-notification-summary">
        <article className={unreadCount > 0 ? "has-unread" : ""}>
          <span>Non vues</span>
          <strong>{unreadCount}</strong>
        </article>
        <article>
          <span>Historique</span>
          <strong>{counts.total || 0}</strong>
        </article>
        <article>
          <span>Commandes</span>
          <strong>{counts.Commandes || 0}</strong>
        </article>
        <article>
          <span>Messages</span>
          <strong>{counts.Messages || 0}</strong>
        </article>
        <article className={paymentFollowupCount > 0 ? "has-unread" : ""}>
          <span>Paiements pension</span>
          <strong>{paymentFollowupCount}</strong>
        </article>
        <article>
          <span>Ventes</span>
          <strong>{counts.Ventes || 0}</strong>
        </article>
      </div>

      <div className="admin-notification-actions">
        {notificationFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={activeFilter === filter.value ? "is-active" : ""}
            onClick={() => onFilterChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
        <button type="button" className="admin-notification-actions__mark" onClick={onMarkAllSeen}>
          Tout marquer comme vu
        </button>
      </div>

      <div className="admin-notification-list">
        {notifications.map((notification) => (
          <article
            key={notification.id}
            className={`admin-notification-card admin-notification-card--${notification.tone} ${notification.seen_at ? "is-seen" : "is-unread"}`}
          >
            <div>
              <span>{notification.category}</span>
              <strong>{notification.title}</strong>
              <em>{formatDateTime(notification.created_at)}</em>
            </div>
            <p>
              {[notification.target_type, notification.target_label].filter(Boolean).join(" - ") || "Notification admin"}
            </p>
            {notification.details && Object.keys(notification.details).length > 0 && (
              <small>
                {Object.entries(notification.details)
                  .filter(([, value]) => value !== null && value !== undefined && value !== "")
                  .slice(0, 4)
                  .map(([key, value]) => `${key.replaceAll("_", " ")} : ${String(value)}`)
                  .join(" | ")}
              </small>
            )}
            <div className="admin-notification-card__actions">
              <button type="button" onClick={notification.open}>Ouvrir</button>
              {!notification.seen_at && (
                <button type="button" onClick={() => onMarkSeen(notification.id)}>
                  Marquer comme vu
                </button>
              )}
            </div>
          </article>
        ))}

        {notifications.length === 0 && (
          <p className="admin-empty">
            {activeFilter === "unread"
              ? "Aucune notification non vue."
              : "Aucune notification dans cette catégorie."}
          </p>
        )}
      </div>
    </section>
  );
}
