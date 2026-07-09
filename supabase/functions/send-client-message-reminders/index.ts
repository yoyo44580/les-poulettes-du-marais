import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://lespoulettesdumarais.fr/";
const FROM_EMAIL = "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>";

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmail(apiKey: string, to: string, clientName: string, subject: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: "Vous avez un message des Poulettes du Marais",
      text: `Bonjour ${clientName || ""},\n\nUn message concernant « ${subject || "votre demande"} » vous attend dans votre espace client.\n\nConsulter mon message : ${APP_URL}\n\nÀ bientôt,\nLes Poulettes du Marais`,
      html: `<div style="font-family:Arial,sans-serif;color:#24352a;line-height:1.6;max-width:620px"><h1 style="color:#315c3d;font-size:24px">Un petit message vous attend</h1><p>Bonjour ${escapeHtml(clientName)},</p><p>Nous vous avons répondu au sujet de <strong>${escapeHtml(subject || "votre demande")}</strong>. Vous pouvez retrouver tranquillement notre message dans votre espace client.</p><p style="margin:26px 0"><a href="${APP_URL}" style="background:#315c3d;color:#fff;padding:13px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Consulter mon message</a></p><p style="color:#6b6255;font-size:14px">Ceci est un rappel courtois envoyé une seule fois.</p><p>À bientôt,<br><strong>Les Poulettes du Marais</strong></p></div>`,
    }),
  });
  return response.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let adminClient: ReturnType<typeof createClient> | null = null;
  let runId = "";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const cronSecret = Deno.env.get("CLIENT_MESSAGE_REMINDER_SECRET");
    const requestSecret = req.headers.get("x-cron-secret") || "";
    const isServiceRoleRequest = req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !cronSecret) throw new Error("Configuration des rappels de messages incomplete.");
    if (!isServiceRoleRequest && requestSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Acces refuse." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const { data: run } = await adminClient.from("automation_runs").insert({
      automation_key: "client_messages",
      trigger_source: body?.triggerSource === "manual" ? "manual" : "scheduled",
    }).select("id").maybeSingle();
    runId = String(run?.id || "");

    const { data: setting } = await adminClient.from("site_settings").select("value").eq("key", "automation_settings").maybeSingle();
    if (setting?.value?.client_messages === false) {
      if (runId) await adminClient.from("automation_runs").update({ status: "success", finished_at: new Date().toISOString(), details: { skipped: true, reason: "paused" } }).eq("id", runId);
      return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: replies, error: repliesError } = await adminClient
      .from("contact_message_replies")
      .select("id, contact_message_id, created_at")
      .eq("sender_role", "admin")
      .is("client_read_at", null)
      .is("client_reminder_sent_at", null)
      .lte("created_at", cutoff)
      .limit(200);
    if (repliesError) throw repliesError;

    const messageIds = [...new Set((replies || []).map((reply) => reply.contact_message_id))];
    const { data: messages, error: messagesError } = messageIds.length
      ? await adminClient.from("contact_messages").select("id, user_id, full_name, email, subject").in("id", messageIds)
      : { data: [], error: null };
    if (messagesError) throw messagesError;

    const userIds = [...new Set((messages || []).map((message) => message.user_id).filter(Boolean))];
    const { data: subscriptions } = userIds.length
      ? await adminClient.from("client_push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds)
      : { data: [] };

    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const pushConfigured = Boolean(vapidSubject && vapidPublicKey && vapidPrivateKey);
    if (pushConfigured) webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);

    const sentReplyIds: string[] = [];
    const expiredIds: string[] = [];
    for (const message of messages || []) {
      const relatedReplyIds = (replies || []).filter((reply) => reply.contact_message_id === message.id).map((reply) => reply.id);
      let delivered = false;
      if (message.email) delivered = await sendEmail(resendApiKey, message.email, message.full_name || "", message.subject || "votre demande");

      if (pushConfigured && message.user_id) {
        for (const subscription of (subscriptions || []).filter((item) => item.user_id === message.user_id)) {
          try {
            await webpush.sendNotification(
              { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
              JSON.stringify({ title: "Un message vous attend", body: "Les Poulettes du Marais vous ont répondu dans votre espace client.", url: "/" })
            );
            delivered = true;
          } catch (error) {
            if ([404, 410].includes(Number((error as { statusCode?: number })?.statusCode || 0))) expiredIds.push(subscription.id);
          }
        }
      }
      if (delivered) sentReplyIds.push(...relatedReplyIds);
    }

    if (sentReplyIds.length) await adminClient.from("contact_message_replies").update({ client_reminder_sent_at: new Date().toISOString() }).in("id", sentReplyIds);
    if (expiredIds.length) await adminClient.from("client_push_subscriptions").delete().in("id", [...new Set(expiredIds)]);
    if (runId) await adminClient.from("automation_runs").update({ status: "success", finished_at: new Date().toISOString(), processed_count: sentReplyIds.length, details: { candidates: replies?.length || 0 } }).eq("id", runId);

    return new Response(JSON.stringify({ success: true, candidates: replies?.length || 0, sent: sentReplyIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    if (adminClient && runId) await adminClient.from("automation_runs").update({ status: "failed", finished_at: new Date().toISOString(), failed_count: 1, error_message: error instanceof Error ? error.message : "Erreur inconnue." }).eq("id", runId);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
