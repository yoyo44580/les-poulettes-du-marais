import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getOrderSummary(order: Record<string, unknown>) {
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items as Array<Record<string, unknown>>
    : [
        { name: "Boite de 6 œufs", quantity: order.box6 || 0 },
        { name: "Boite de 12 œufs", quantity: order.box12 || 0 },
      ].filter((item) => Number(item.quantity || 0) > 0);

  if (items.length === 0) {
    return "Votre commande";
  }

  return items
    .map((item) => `${item.quantity} x ${item.name}`)
    .join(" - ");
}

function normalizeStatus(status: string) {
  if (status === "Prête") {
    return "Prête";
  }

  if (status === "Livrée") {
    return "Livrée";
  }

  return status;
}

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
    const { data: userData } = await authClient.auth.getUser();

    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Non autorise." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profile?.is_admin !== true) {
      return new Response(JSON.stringify({ error: "Acces admin requis." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const orderId = body.orderId;
    const status = normalizeStatus(body.status || "");

    if (!orderId || !["Prête", "Livrée"].includes(status)) {
      return new Response(JSON.stringify({ error: "Commande ou statut invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, user_id, client_name, delivery_date, items, box6, box12")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Commande introuvable." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions, error } = await adminClient
      .from("client_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", order.user_id);

    if (error) {
      throw error;
    }

    const payload = JSON.stringify({
      title: status === "Prête" ? "Votre commande est prête" : "Commande livrée",
      body: status === "Prête"
        ? `${getOrderSummary(order)} vous attend.`
        : "Merci pour votre commande aux Poulettes du Marais.",
      url: "/",
    });

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
      await adminClient.from("client_push_subscriptions").delete().in("id", expiredIds);
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


