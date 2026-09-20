import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getParisDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function getParisIsoDate(date = new Date()) {
  const values = getParisDateParts(date);
  return `${values.year}-${values.month}-${values.day}`;
}

function getWeekStartIso() {
  const todayIso = getParisIsoDate();
  const date = new Date(`${todayIso}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

async function sendEmail(apiKey: string, to: string, clientName: string, issues: string[]) {
  const hasUpdateIssue = issues.includes("update");
  const hasNotificationIssue = issues.includes("notifications");
  const greeting = clientName ? `Bonjour ${clientName},` : "Bonjour,";
  const subject = hasUpdateIssue && hasNotificationIssue
    ? "Petite mise a jour de votre application Les Poulettes"
    : hasUpdateIssue
    ? "Pensez a mettre votre application Les Poulettes a jour"
    : "Pensez a activer les notifications Les Poulettes";
  const lines = [
    greeting,
    "",
    "Petit message pratique pour que votre espace client fonctionne au mieux.",
    hasUpdateIssue ? "- Votre application ne semble pas encore etre sur la derniere version." : "",
    hasNotificationIssue ? "- Les notifications ne semblent pas encore actives sur votre compte." : "",
    "",
    "Vous pouvez ouvrir l'application, vous connecter, puis utiliser le bouton de mise a jour ou activer les notifications depuis votre espace client.",
    "",
    APP_URL,
    "",
    "Merci et a bientot,",
    "Les Poulettes du Marais",
  ].filter(Boolean);

  const htmlIssues = [
    hasUpdateIssue ? "<li>Votre application ne semble pas encore etre sur la derniere version.</li>" : "",
    hasNotificationIssue ? "<li>Les notifications ne semblent pas encore actives sur votre compte.</li>" : "",
  ].filter(Boolean).join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      text: lines.join("\n"),
      html: `<div style="font-family:Arial,sans-serif;color:#24352a;line-height:1.6;max-width:620px;margin:auto"><div style="border-top:7px solid #315c3d;background:#fffdf8;padding:28px"><p>${escapeHtml(greeting)}</p><h1 style="color:#315c3d;font-size:24px;line-height:1.25">${escapeHtml(subject)}</h1><p>Petit message pratique pour que votre espace client fonctionne au mieux.</p><ul>${htmlIssues}</ul><p>Vous pouvez ouvrir l'application, vous connecter, puis utiliser le bouton de mise a jour ou activer les notifications depuis votre espace client.</p><p style="margin:26px 0"><a href="${APP_URL}" style="display:inline-block;background:#315c3d;color:#fff;text-decoration:none;padding:13px 18px;border-radius:6px;font-weight:bold">Ouvrir mon espace client</a></p><p>Merci et a bientot,<br><strong>Les Poulettes du Marais</strong></p></div></div>`,
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
    const cronSecret = Deno.env.get("CLIENT_APP_HEALTH_REMINDER_SECRET");
    const requestSecret = req.headers.get("x-cron-secret") || "";
    const isServiceRoleRequest = req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !cronSecret) {
      throw new Error("Configuration des rappels application incomplete.");
    }

    if (!isServiceRoleRequest && requestSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Acces refuse." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const triggerSource = body?.triggerSource === "manual" ? "manual" : "scheduled";
    const weekStart = getWeekStartIso();

    const { data: run } = await adminClient.from("automation_runs").insert({
      automation_key: "client_app_health",
      trigger_source: triggerSource,
    }).select("id").maybeSingle();
    runId = String(run?.id || "");

    const { data: setting } = await adminClient.from("site_settings").select("value").eq("key", "automation_settings").maybeSingle();
    if (setting?.value?.client_app_health === false) {
      if (runId) await adminClient.from("automation_runs").update({
        status: "success",
        finished_at: new Date().toISOString(),
        details: { skipped: true, reason: "paused" },
      }).eq("id", runId);
      return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: releaseSetting } = await adminClient
      .from("site_settings")
      .select("value")
      .eq("key", "current_app_release")
      .maybeSingle();
    const currentReleaseKey = String(releaseSetting?.value?.release_key || "");
    if (!currentReleaseKey) throw new Error("Version actuelle inconnue. Ouvrez une fois l'espace admin apres le deploiement.");

    const [{ data: profiles, error: profilesError }, { data: versions, error: versionsError }, { data: subscriptions, error: subscriptionsError }, { data: existing, error: existingError }] =
      await Promise.all([
        adminClient.from("profiles").select("id, email, full_name, is_admin").not("email", "is", null).limit(1000),
        adminClient.from("client_app_versions").select("user_id, release_key, build_commit, build_time, app_version, last_seen_at").limit(2000),
        adminClient.from("client_push_subscriptions").select("user_id").limit(3000),
        adminClient.from("client_app_health_reminders").select("user_id").eq("reminder_week", weekStart),
      ]);

    if (profilesError) throw profilesError;
    if (versionsError) throw versionsError;
    if (subscriptionsError) throw subscriptionsError;
    if (existingError) throw existingError;

    const versionsByUser = new Map((versions || []).map((item) => [String(item.user_id), item]));
    const usersWithPush = new Set((subscriptions || []).map((item) => String(item.user_id)));
    const alreadyReminded = new Set((existing || []).map((item) => String(item.user_id)));

    const candidates = (profiles || []).filter((profile) => profile.is_admin !== true).map((profile) => {
      const userId = String(profile.id);
      const version = versionsByUser.get(userId);
      const releaseKey = String(version?.release_key || version?.build_commit || version?.build_time || version?.app_version || "");
      const needsUpdate = !releaseKey || releaseKey !== currentReleaseKey;
      const needsNotifications = !usersWithPush.has(userId);
      const issues = [needsUpdate ? "update" : "", needsNotifications ? "notifications" : ""].filter(Boolean);
      const reminderKind = needsUpdate && needsNotifications
        ? "both"
        : needsUpdate
        ? "outdated_app"
        : needsNotifications
        ? "notifications_disabled"
        : "";

      return { profile, version, issues, reminderKind };
    }).filter(({ profile, issues }) => issues.length > 0 && !alreadyReminded.has(String(profile.id)));

    const logRows: Array<Record<string, unknown>> = [];
    let failed = 0;

    for (const candidate of candidates) {
      const email = String(candidate.profile.email || "").trim();
      if (!email) continue;

      const sent = await sendEmail(resendApiKey, email, candidate.profile.full_name || "", candidate.issues);
      if (!sent) {
        failed += 1;
        continue;
      }

      logRows.push({
        user_id: candidate.profile.id,
        reminder_week: weekStart,
        reminder_kind: candidate.reminderKind,
        email,
        email_sent: true,
        details: {
          issues: candidate.issues,
          current_release_key: currentReleaseKey,
          client_release_key: candidate.version?.release_key || null,
          last_seen_at: candidate.version?.last_seen_at || null,
        },
      });
    }

    if (logRows.length > 0) {
      const { error: logError } = await adminClient.from("client_app_health_reminders").insert(logRows);
      if (logError) throw logError;
    }

    if (runId) await adminClient.from("automation_runs").update({
      status: failed > 0 && logRows.length === 0 ? "failed" : "success",
      finished_at: new Date().toISOString(),
      processed_count: logRows.length,
      failed_count: failed,
      details: { candidates: candidates.length, week_start: weekStart },
      error_message: failed > 0 && logRows.length === 0 ? "Aucun rappel application n'a pu etre envoye." : null,
    }).eq("id", runId);

    return new Response(JSON.stringify({ success: true, candidates: candidates.length, sent: logRows.length, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (adminClient && runId) await adminClient.from("automation_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      failed_count: 1,
      error_message: error instanceof Error ? error.message : "Erreur inconnue.",
    }).eq("id", runId);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
