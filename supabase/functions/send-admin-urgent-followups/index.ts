import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "lespoulettesdumarais@gmail.com";
const FROM_EMAIL = "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>";
const APP_URL = "https://lespoulettesdumarais.fr/";

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeStatus(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isMessageOpen(value: unknown) {
  const status = normalizeStatus(value || "Nouveau");
  return status !== "traite" && status !== "traitee";
}

function isPendingReservation(value: unknown) {
  return normalizeStatus(value || "Demandee").startsWith("demand");
}

function formatDate(value: unknown) {
  const text = String(value || "");
  if (!text) return "date non renseignee";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${text}T00:00:00`));
}

function renderRows(rows: string[]) {
  if (rows.length === 0) return "<p>Aucun élément.</p>";
  return `<ul>${rows.map((row) => `<li>${row}</li>`).join("")}</ul>`;
}

async function sendEmail(resendApiKey: string, summary: {
  messages: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
  kennel: Array<Record<string, unknown>>;
}) {
  const total = summary.messages.length + summary.education.length + summary.kennel.length;
  const subject = total > 0
    ? `Alertes admin : ${total} action(s) a traiter`
    : "Alertes admin : rien d'urgent";

  const messageRows = summary.messages.slice(0, 8).map((message) =>
    `<strong>${escapeHtml(message.full_name || "Client")}</strong> - ${escapeHtml(message.subject || "Message")} - ${escapeHtml(message.email || "")}`
  );
  const educationRows = summary.education.slice(0, 8).map((booking) =>
    `<strong>${escapeHtml(booking.client_name || "Client")}</strong> - ${escapeHtml(booking.activity_type || "Activite")} - ${formatDate(booking.booking_date)}`
  );
  const kennelRows = summary.kennel.slice(0, 8).map((booking) =>
    `<strong>${escapeHtml(booking.client_name || "Client")}</strong> - ${escapeHtml((booking.dog as Record<string, unknown> | null)?.name || "Chien")} - du ${formatDate(booking.start_date)} au ${formatDate(booking.end_date)}`
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html: `<div style="font-family:Arial,sans-serif;color:#24352a;line-height:1.55;max-width:680px;margin:auto">
        <div style="border-top:8px solid #be185d;background:#fffdf8;padding:28px">
          <h1 style="margin:0 0 12px;color:#173a26;font-size:25px">Alertes admin a traiter</h1>
          <p style="font-size:17px"><strong>${total}</strong> action(s) attendent encore dans l'administration.</p>
          <h2 style="color:#be185d;font-size:18px">Messages non traites (${summary.messages.length})</h2>
          ${renderRows(messageRows)}
          <h2 style="color:#2563eb;font-size:18px">Reservations ferme a confirmer (${summary.education.length})</h2>
          ${renderRows(educationRows)}
          <h2 style="color:#2563eb;font-size:18px">Reservations pension a confirmer (${summary.kennel.length})</h2>
          ${renderRows(kennelRows)}
          <p style="margin:26px 0"><a href="${APP_URL}" style="display:inline-block;background:#173a26;color:#fff;text-decoration:none;padding:13px 18px;border-radius:6px;font-weight:bold">Ouvrir l'administration</a></p>
          <p style="color:#6b6255;font-size:14px">Ce rappel peut revenir tant qu'une action reste non traitee ou non confirmee.</p>
        </div>
      </div>`,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || "Email admin urgent non envoye.");
}

async function sendAdminPush(adminClient: ReturnType<typeof createClient>, total: number, details: Record<string, unknown>) {
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) return { sent: 0, total: 0, skipped: true };

  const { data: subscriptions, error } = await adminClient
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (error) throw error;

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const payload = JSON.stringify({
    title: total > 0 ? "Alertes admin a traiter" : "Admin a jour",
    body: total > 0 ? `${total} action(s) attendent encore.` : "Aucun message ou reservation en attente.",
    url: "/",
  });

  const results = await Promise.allSettled(
    (subscriptions || []).map((subscription) =>
      webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload
      )
    )
  );
  const expiredIds = results
    .map((result, index) => ({ result, subscription: subscriptions?.[index] }))
    .filter(({ result }) => result.status === "rejected" && [404, 410].includes(Number(result.reason?.statusCode || 0)))
    .map(({ subscription }) => subscription?.id)
    .filter(Boolean);
  if (expiredIds.length > 0) await adminClient.from("admin_push_subscriptions").delete().in("id", expiredIds);

  await adminClient.from("admin_action_logs").insert({
    action_type: "notification_admin_urgent_followup",
    title: total > 0 ? "Alertes admin a traiter" : "Aucune alerte admin",
    target_type: "Suivi admin",
    target_label: total > 0 ? `${total} action(s)` : "A jour",
    details,
    created_by: null,
    created_by_email: "",
  });

  return {
    total: subscriptions?.length || 0,
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
    expired: expiredIds.length,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let adminClient: ReturnType<typeof createClient> | null = null;
  let runId = "";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const cronSecret = Deno.env.get("ADMIN_URGENT_FOLLOWUP_SECRET");
    const requestSecret = req.headers.get("x-cron-secret") || "";
    const isServiceRoleRequest = req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !cronSecret) {
      throw new Error("Configuration des alertes admin incomplete.");
    }
    if (!isServiceRoleRequest && requestSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Acces refuse." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const { data: run } = await adminClient.from("automation_runs").insert({
      automation_key: "admin_urgent_followups",
      trigger_source: body?.triggerSource === "manual" ? "manual" : "scheduled",
    }).select("id").maybeSingle();
    runId = String(run?.id || "");

    const { data: setting } = await adminClient.from("site_settings").select("value").eq("key", "automation_settings").maybeSingle();
    if (setting?.value?.admin_urgent_followups === false) {
      if (runId) await adminClient.from("automation_runs").update({ status: "success", finished_at: new Date().toISOString(), details: { skipped: true, reason: "paused" } }).eq("id", runId);
      return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [messagesResult, educationResult, kennelResult] = await Promise.all([
      adminClient.from("contact_messages").select("id, full_name, email, phone, subject, status, created_at, archived_at").is("archived_at", null).order("created_at", { ascending: true }).limit(100),
      adminClient.from("educational_bookings").select("id, client_name, client_email, phone, activity_type, booking_date, status, archived_at, created_at").is("archived_at", null).order("booking_date", { ascending: true }).limit(100),
      adminClient.from("kennel_bookings").select("id, client_name, client_email, phone, start_date, end_date, status, archived_at, dog:dogs(id, name)").is("archived_at", null).order("start_date", { ascending: true }).limit(100),
    ]);
    if (messagesResult.error) throw messagesResult.error;
    if (educationResult.error) throw educationResult.error;
    if (kennelResult.error) throw kennelResult.error;

    const summary = {
      messages: (messagesResult.data || []).filter((message) => isMessageOpen(message.status)),
      education: (educationResult.data || []).filter((booking) => isPendingReservation(booking.status)),
      kennel: (kennelResult.data || []).filter((booking) => isPendingReservation(booking.status)),
    };
    const total = summary.messages.length + summary.education.length + summary.kennel.length;
    const details = {
      messages: summary.messages.length,
      reservations_ferme: summary.education.length,
      reservations_pension: summary.kennel.length,
    };

    if (total > 0) {
      await sendEmail(resendApiKey, summary);
      await sendAdminPush(adminClient, total, details);
    }

    if (runId) {
      await adminClient.from("automation_runs").update({
        status: "success",
        finished_at: new Date().toISOString(),
        processed_count: total,
        details: { ...details, email_sent: total > 0 },
      }).eq("id", runId);
    }

    return new Response(JSON.stringify({ success: true, total, ...details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (adminClient && runId) {
      await adminClient.from("automation_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        failed_count: 1,
        error_message: error instanceof Error ? error.message : "Erreur inconnue.",
      }).eq("id", runId);
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
