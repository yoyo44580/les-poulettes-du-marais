import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Configuration push incomplete." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });
    const body = await req.json();
    const isOccasionalSaleNotification = Boolean(body.occasionalSaleReservationId);
    const { data: userData } = await authClient.auth.getUser();
    const currentUser = userData.user ?? null;

    if (!currentUser && !isOccasionalSaleNotification) {
      return new Response(JSON.stringify({ error: "Non autorise." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUser?.id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    const isAdmin = profile?.is_admin === true;
    let title = "Nouvelle commande";
    let message = "Une nouvelle commande vient d'etre passee.";
    let url = "/";
    let notificationActionType = "notification_custom";
    let notificationTargetType = "Notification";
    let notificationTargetId: string | null = null;
    let notificationTargetLabel = "";
    let notificationDetails: Record<string, unknown> = {};

    if (body.orderId) {
      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .select("id, user_id, client_name, client_email, delivery_date, status, items, box6, box12")
        .eq("id", body.orderId)
        .single();

      if (orderError || !order) {
        return new Response(JSON.stringify({ error: "Commande introuvable." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isAdmin && order.user_id !== currentUser?.id) {
        return new Response(JSON.stringify({ error: "Acces refuse pour cette commande." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const items = Array.isArray(order.items) && order.items.length > 0
        ? order.items
        : [
            { name: "Boite de 6 oeufs", quantity: order.box6 || 0 },
            { name: "Boite de 12 oeufs", quantity: order.box12 || 0 },
          ].filter((item) => item.quantity > 0);
      const summary = items.length > 0
        ? items.map((item) => `${item.quantity} x ${item.name}`).join(" - ")
        : "Commande";

      message = `${order.client_name || "Client"} - ${summary} - ${order.delivery_date || "date a confirmer"}`;
      notificationTargetType = "Commande";
      notificationTargetId = String(order.id);
      notificationTargetLabel = order.client_name || order.client_email || "Commande";
      notificationDetails = { date: order.delivery_date, resume: summary, statut: order.status || "" };

      if (body.eventType === "order_cancelled" || String(order.status || "").toLowerCase().startsWith("annul")) {
        title = "Commande annulee";
        message = `${order.client_name || "Client"} a annule une commande - ${summary} - ${order.delivery_date || "date a confirmer"}`;
        notificationActionType = "notification_order_cancelled";
      } else {
        notificationActionType = "notification_order_created";
      }
    } else if (body.educationBookingId) {
      const { data: booking, error: bookingError } = await adminClient
        .from("educational_bookings")
        .select("id, user_id, activity_type, booking_date, participants, client_name, phone")
        .eq("id", body.educationBookingId)
        .single();

      if (bookingError || !booking) {
        return new Response(JSON.stringify({ error: "Reservation ferme introuvable." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isAdmin && booking.user_id !== currentUser?.id) {
        return new Response(JSON.stringify({ error: "Acces refuse pour cette reservation." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      title = "Nouvelle reservation ferme";
      message = `${booking.client_name || "Client"} - ${booking.activity_type || "Activite"} - ${booking.booking_date || "date a confirmer"} - ${booking.participants || 1} participant(s)`;
      notificationActionType = "notification_education_booking";
      notificationTargetType = "Reservation ferme";
      notificationTargetId = String(booking.id);
      notificationTargetLabel = booking.client_name || booking.activity_type || "Reservation ferme";
      notificationDetails = {
        activite: booking.activity_type || "",
        date: booking.booking_date || "",
        participants: booking.participants || 1,
        telephone: booking.phone || "",
      };
    } else if (body.kennelBookingId) {
      const { data: booking, error: bookingError } = await adminClient
        .from("kennel_bookings")
        .select("id, user_id, dog_id, client_name, start_date, end_date, phone")
        .eq("id", body.kennelBookingId)
        .single();

      if (bookingError || !booking) {
        return new Response(JSON.stringify({ error: "Reservation pension introuvable." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isAdmin && booking.user_id !== currentUser?.id) {
        return new Response(JSON.stringify({ error: "Acces refuse pour cette reservation." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let dogName = "Chien";

      if (booking.dog_id) {
        const { data: dog } = await adminClient
          .from("dogs")
          .select("name")
          .eq("id", booking.dog_id)
          .maybeSingle();

        dogName = dog?.name || dogName;
      }

      title = "Nouvelle reservation pension";
      message = `${booking.client_name || "Client"} - ${dogName} - du ${booking.start_date || "date a confirmer"} au ${booking.end_date || "date a confirmer"}`;
      notificationActionType = "notification_kennel_booking";
      notificationTargetType = "Reservation pension";
      notificationTargetId = String(booking.id);
      notificationTargetLabel = `${booking.client_name || "Client"} - ${dogName}`;
      notificationDetails = {
        chien: dogName,
        arrivee: booking.start_date || "",
        depart: booking.end_date || "",
        telephone: booking.phone || "",
      };
    } else if (body.occasionalSaleReservationId) {
      const { data: reservation, error: reservationError } = await adminClient
        .from("occasional_sale_reservations")
        .select("id, item_id, item_name, quantity, client_name, client_email, phone, notes, status, created_at")
        .eq("id", body.occasionalSaleReservationId)
        .single();

      if (reservationError || !reservation) {
        return new Response(JSON.stringify({ error: "Reservation vente ponctuelle introuvable." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      title = "Nouvelle reservation vente";
      message = `${reservation.client_name || "Client"} - ${reservation.quantity || 1} x ${reservation.item_name || "Vente ponctuelle"}`;
      notificationActionType = "notification_occasional_sale";
      notificationTargetType = "Vente ponctuelle";
      notificationTargetId = String(reservation.id);
      notificationTargetLabel = `${reservation.client_name || "Client"} - ${reservation.item_name || "Vente ponctuelle"}`;
      notificationDetails = {
        produit: reservation.item_name || "",
        quantite: reservation.quantity || 1,
        telephone: reservation.phone || "",
        email: reservation.client_email || "",
        statut: reservation.status || "Nouvelle",
        message: reservation.notes || "",
      };
    } else if (isAdmin) {
      title = body.title || title;
      message = body.body || message;
      url = body.url || url;
      notificationDetails = { message };
    } else {
      return new Response(JSON.stringify({ error: "Commande requise." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url,
    });

    await adminClient.from("admin_action_logs").insert({
      action_type: notificationActionType,
      title,
      target_type: notificationTargetType,
      target_id: notificationTargetId,
      target_label: notificationTargetLabel,
      details: notificationDetails,
      created_by: currentUser?.id || null,
      created_by_email: currentUser?.email || "",
    });

    const { data: subscriptions, error } = await adminClient
      .from("admin_push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (error) {
      throw error;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const results = await Promise.allSettled(
      (subscriptions || []).map((subscription) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        )
      )
    );

    const expiredIds = results
      .map((result, index) => ({ result, subscription: subscriptions?.[index] }))
      .filter(({ result }) => result.status === "rejected" && [404, 410].includes(result.reason?.statusCode))
      .map(({ subscription }) => subscription?.id)
      .filter(Boolean);

    if (expiredIds.length > 0) {
      await adminClient.from("admin_push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(JSON.stringify({
      total: subscriptions?.length || 0,
      sent: results.filter((result) => result.status === "fulfilled").length,
      failed: results.filter((result) => result.status === "rejected").length,
      expired: expiredIds.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
