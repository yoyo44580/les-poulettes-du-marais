import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getOrderSummary(order: Record<string, unknown>) {
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items as Array<Record<string, unknown>>
    : [
        { name: "Boite de 6 oeufs", quantity: order.box6 || 0 },
        { name: "Boite de 12 oeufs", quantity: order.box12 || 0 },
      ].filter((item) => Number(item.quantity || 0) > 0);

  return items.length > 0
    ? items.map((item) => `${Number(item.quantity || 0)} x ${item.name || "Produit"}`).join(" - ")
    : "Commande";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
      return new Response(JSON.stringify({ error: "Configuration email incomplete." }), {
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

    const body = await req.json();
    const orderId = String(body.orderId || "");

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Commande requise." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, user_id, client_email, client_name, delivery_date, status, items, box6, box12")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Commande introuvable." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Acces refuse pour cette commande." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!String(order.status || "").toLowerCase().startsWith("annul")) {
      return new Response(JSON.stringify({ error: "Commande non annulee." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientEmail = String(order.client_email || userData.user.email || "");

    if (!clientEmail) {
      return new Response(JSON.stringify({ error: "Email client manquant." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientName = escapeHtml(order.client_name || "Bonjour");
    const summary = escapeHtml(getOrderSummary(order));
    const deliveryDate = escapeHtml(order.delivery_date || "date non renseignee");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>",
        to: clientEmail,
        subject: "Votre commande a bien ete annulee",
        html: `
          <h1>Bonjour ${clientName}</h1>
          <p>Votre commande a bien ete annulee.</p>
          <p><strong>Commande :</strong> ${summary}</p>
          <p><strong>Date prevue :</strong> ${deliveryDate}</p>
          <p>Les oeufs ont ete remis dans le stock disponible.</p>
          <p>Merci et a bientot,<br>Les Poulettes du Marais</p>
        `,
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
