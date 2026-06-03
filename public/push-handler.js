self.addEventListener("push", (event) => {
  const data = event.data?.json?.() || {};
  const title = data.title || "Nouvelle commande";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Une nouvelle commande vient d'etre passee.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: {
        url: data.url || "/",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.includes(self.location.origin));

      if (existingClient) {
        existingClient.focus();
        return existingClient.navigate(url);
      }

      return self.clients.openWindow(url);
    })
  );
});
