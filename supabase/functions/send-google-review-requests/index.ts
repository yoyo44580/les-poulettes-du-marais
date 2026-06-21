import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_EMAIL = "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>";
const DEFAULT_REVIEW_URL = "https://g.page/r/CSmAsTCUXluPEBM/review";

function getParisIsoDate() {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmailWithRetry(apiKey: string, payload: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    if (response.ok) return true;
    if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
  }

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let runClient: ReturnType<typeof createClient> | null = null;
  let runId = "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const cronSecret = Deno.env.get("GOOGLE_REVIEW_REQUEST_SECRET");
    const requestSecret = req.headers.get("x-cron-secret") || "";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !cronSecret) {
      return new Response(JSON.stringify({ error: "Configuration des demandes d'avis incomplete." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Acces refuse." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    runClient = adminClient;
    const requestBody = await req.json().catch(() => ({}));
    const triggerSource = requestBody?.triggerSource === "manual" ? "manual" : "scheduled";
    const { data: runRow } = await adminClient
      .from("automation_runs")
      .insert({ automation_key: "google_reviews", trigger_source: triggerSource })
      .select("id")
      .maybeSingle();
    runId = String(runRow?.id || "");
    const todayIso = getParisIsoDate();
    const { data: settingsRows, error: settingsError } = await adminClient
      .from("site_settings")
      .select("key, value")
      .in("key", ["app_settings", "google_review_automation_started_on"]);

    if (settingsError) throw settingsError;

    const appSettings = settingsRows?.find((row) => row.key === "app_settings")?.value || {};
    const configuredStart = settingsRows?.find((row) => row.key === "google_review_automation_started_on")?.value;
    const automationStart = typeof configuredStart === "string" ? configuredStart : todayIso;
    const reviewUrl = String(appSettings.google_review_url || DEFAULT_REVIEW_URL);

    const [{ data: educationBookings, error: educationError }, { data: kennelBookings, error: kennelError }] =
      await Promise.all([
        adminClient
          .from("educational_bookings")
          .select("id, user_id, client_name, client_email, activity_type, booking_date, status")
          .gte("booking_date", automationStart)
          .lt("booking_date", todayIso)
          .in("status", ["Confirmée", "Terminée"])
          .not("client_email", "is", null),
        adminClient
          .from("kennel_bookings")
          .select("id, user_id, client_name, client_email, end_date, status, dogs(name)")
          .gte("end_date", automationStart)
          .lt("end_date", todayIso)
          .in("status", ["Confirmée", "Terminée"])
          .not("client_email", "is", null),
      ]);

    if (educationError) throw educationError;
    if (kennelError) throw kennelError;

    const candidates = [
      ...(educationBookings || []).map((booking) => ({
        type: "education",
        booking,
        completionDate: booking.booking_date,
        experience: booking.activity_type || "votre activité à la ferme pédagogique",
      })),
      ...(kennelBookings || []).map((booking) => ({
        type: "kennel",
        booking,
        completionDate: booking.end_date,
        experience: `le séjour de ${booking.dogs?.name || "votre chien"} à la pension`,
      })),
    ];

    if (candidates.length === 0) {
      if (runId) {
        await adminClient
          .from("automation_runs")
          .update({ status: "success", finished_at: new Date().toISOString(), details: { candidates: 0 } })
          .eq("id", runId);
      }
      return new Response(JSON.stringify({ success: true, candidates: 0, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRows, error: existingError } = await adminClient
      .from("google_review_requests")
      .select("booking_type, booking_id")
      .in("booking_id", candidates.map((candidate) => candidate.booking.id));

    if (existingError) throw existingError;
    const existingKeys = new Set((existingRows || []).map((row) => `${row.booking_type}:${row.booking_id}`));
    const pending = candidates.filter((candidate) => !existingKeys.has(`${candidate.type}:${candidate.booking.id}`));
    const userIds = Array.from(new Set(pending.map((item) => item.booking.user_id).filter(Boolean)));
    const { data: subscriptions, error: subscriptionsError } = userIds.length
      ? await adminClient
          .from("client_push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth")
          .in("user_id", userIds)
      : { data: [], error: null };

    if (subscriptionsError) throw subscriptionsError;

    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const pushConfigured = Boolean(vapidSubject && vapidPublicKey && vapidPrivateKey);
    if (pushConfigured) webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);

    const expiredIds: string[] = [];
    const logRows: Array<Record<string, unknown>> = [];
    let failed = 0;

    for (const candidate of pending) {
      const booking = candidate.booking;
      const clientName = String(booking.client_name || "").trim();
      const message = `Nous espérons que ${candidate.experience} vous a plu. Votre avis nous aide beaucoup à faire connaître Les Poulettes du Marais.`;
      let pushSent = 0;

      if (pushConfigured) {
        const userSubscriptions = (subscriptions || []).filter((item) => item.user_id === booking.user_id);
        for (const subscription of userSubscriptions) {
          try {
            await webpush.sendNotification(
              { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
              JSON.stringify({ title: "Votre avis compte pour nous", body: message, url: reviewUrl })
            );
            pushSent += 1;
          } catch (error) {
            const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
            if ([404, 410].includes(statusCode)) expiredIds.push(subscription.id);
          }
        }
      }

      const emailSent = await sendEmailWithRetry(resendApiKey, {
        from: FROM_EMAIL,
        to: booking.client_email,
        subject: "Comment s'est passée votre expérience ?",
        text: `Bonjour ${clientName},\n\n${message}\n\nLaisser un avis Google : ${reviewUrl}\n\nMerci et à bientôt,\nLes Poulettes du Marais`,
        html: `<div style="font-family:Arial,sans-serif;color:#24352a;line-height:1.55;max-width:620px"><h1 style="color:#315c3d">Votre avis compte pour nous</h1><p>Bonjour ${escapeHtml(clientName)},</p><p>${escapeHtml(message)}</p><p style="margin:28px 0"><a href="${escapeHtml(reviewUrl)}" style="background:#315c3d;color:#fff;padding:13px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Laisser un avis Google</a></p><p>Merci et à bientôt,<br>Les Poulettes du Marais</p></div>`,
      });

      if (!emailSent && pushSent === 0) {
        failed += 1;
        continue;
      }

      logRows.push({
        booking_type: candidate.type,
        booking_id: booking.id,
        user_id: booking.user_id,
        client_email: booking.client_email,
        completion_date: candidate.completionDate,
        email_sent: emailSent,
        push_sent: pushSent > 0,
        details: { experience: candidate.experience, push_count: pushSent },
      });
    }

    if (expiredIds.length > 0) {
      await adminClient.from("client_push_subscriptions").delete().in("id", Array.from(new Set(expiredIds)));
    }
    if (logRows.length > 0) {
      const { error: logError } = await adminClient.from("google_review_requests").insert(logRows);
      if (logError) throw logError;
    }

    if (runId) {
      await adminClient
        .from("automation_runs")
        .update({
          status: failed > 0 && logRows.length === 0 ? "failed" : "success",
          finished_at: new Date().toISOString(),
          processed_count: logRows.length,
          failed_count: failed,
          details: { candidates: candidates.length },
          error_message: failed > 0 && logRows.length === 0 ? "Aucune demande d'avis n'a pu etre envoyee." : null,
        })
        .eq("id", runId);
    }

    return new Response(JSON.stringify({ success: true, candidates: candidates.length, sent: logRows.length, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (runClient && runId) {
      await runClient
        .from("automation_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          failed_count: 1,
          error_message: error instanceof Error ? error.message : "Erreur inconnue.",
        })
        .eq("id", runId);
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
