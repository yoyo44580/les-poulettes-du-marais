import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

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

async function sendContactAckEmail(resendApiKey: string, message: Record<string, unknown>) {
  const clientName = escapeHtml(message.full_name || "Bonjour");
  const subject = escapeHtml(message.subject || "Message depuis l'application");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>",
      to: String(message.email || ""),
      subject: "Votre message a bien ete pris en compte",
      html: `
        <h1>Bonjour ${clientName}</h1>
        <p>Votre message a bien ete pris en compte.</p>
        <p>Nous allons vous apporter une reponse sous 24h.</p>
        <p><strong>Sujet :</strong> ${subject}</p>
        <p>Merci pour votre message,<br>Les Poulettes du Marais</p>
      `,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Email contact non envoye.");
  }

  return data;
}

async function notifyAdmins(adminClient: ReturnType<typeof createClient>, message: Record<string, unknown>) {
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return { total: 0, sent: 0, failed: 0, expired: 0, skipped: "Configuration push incomplete." };
  }

  const { data: subscriptions, error } = await adminClient
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error) {
    throw error;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: "Nouveau message client",
    body: `${message.full_name || "Client"} - ${message.subject || "Message depuis l'application"}`,
    url: "/",
  });

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

  return {
    total: subscriptions?.length || 0,
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
    expired: expiredIds.length,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return new Response(JSON.stringify({ error: "Configuration contact incomplete." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const contactMessageId = String(body.contactMessageId || "");

    if (!contactMessageId) {
      return new Response(JSON.stringify({ error: "Message requis." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const processingStartedAt = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: message, error: messageError } = await adminClient
      .from("contact_messages")
      .update({ acknowledgement_processing_at: processingStartedAt })
      .is("acknowledged_at", null)
      .or(`acknowledgement_processing_at.is.null,acknowledgement_processing_at.lt.${staleBefore}`)
      .select("id, full_name, email, phone, subject, message, status, created_at")
      .eq("id", contactMessageId)
      .maybeSingle();

    if (messageError) {
      throw messageError;
    }

    if (!message) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const emailResult = await sendContactAckEmail(resendApiKey, message);
      const pushResult = await notifyAdmins(adminClient, message);

      await adminClient.from("admin_action_logs").insert({
        action_type: "notification_contact_message",
        title: "Nouveau message client",
        target_type: "Message",
        target_id: message.id,
        target_label: message.full_name || message.email || "Message client",
        details: {
          sujet: message.subject || "",
          email: message.email || "",
          telephone: message.phone || "",
        },
        created_by: null,
        created_by_email: String(message.email || ""),
      });

      const { error: acknowledgementError } = await adminClient
        .from("contact_messages")
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledgement_processing_at: null,
        })
        .eq("id", message.id);

      if (acknowledgementError) throw acknowledgementError;

      return new Response(JSON.stringify({ email: emailResult, push: pushResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (processingError) {
      await adminClient
        .from("contact_messages")
        .update({ acknowledgement_processing_at: null })
        .eq("id", message.id)
        .eq("acknowledgement_processing_at", processingStartedAt);
      throw processingError;
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
