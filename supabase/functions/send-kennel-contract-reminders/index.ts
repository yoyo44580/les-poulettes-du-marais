import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_EMAIL = "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>";
const CLIENT_APP_URL = "https://lespoulettesdumarais.fr";

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

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T12:00:00Z`).getTime();
  const to = new Date(`${toDate}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / 86400000));
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00Z`));
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
    const cronSecret = Deno.env.get("DAILY_PAYMENT_EMAIL_SECRET");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const requestSecret = req.headers.get("x-cron-secret") || "";
    const isServiceRoleRequest = req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      throw new Error("Configuration des relances de contrat incomplete.");
    }

    if (!isServiceRoleRequest && (!cronSecret || requestSecret !== cronSecret)) {
      return new Response(JSON.stringify({ error: "Acces refuse." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    runClient = adminClient;
    const requestBody = await req.json().catch(() => ({}));
    const manualBookingId = requestBody?.bookingId ? String(requestBody.bookingId) : "";
    const triggerSource = requestBody?.triggerSource === "manual" || manualBookingId ? "manual" : "scheduled";
    const { data: runRow } = await adminClient
      .from("automation_runs")
      .insert({ automation_key: "kennel_contracts", trigger_source: triggerSource })
      .select("id")
      .maybeSingle();
    runId = String(runRow?.id || "");

    const { data: automationSetting } = await adminClient
      .from("site_settings")
      .select("value")
      .eq("key", "automation_settings")
      .maybeSingle();
    if (!manualBookingId && automationSetting?.value?.kennel_contracts === false) {
      if (runId) {
        await adminClient.from("automation_runs").update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: { skipped: true, reason: "paused" },
        }).eq("id", runId);
      }
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const todayIso = getParisIsoDate();
    const reminderEndDate = addDays(todayIso, 7);
    const { data: bookings, error: bookingsError } = await adminClient
      .from("kennel_bookings")
      .select("id, user_id, client_name, client_email, start_date, end_date, status, archived_at, dogs(name)")
      .gte("start_date", todayIso)
      .lte("start_date", reminderEndDate)
      .eq("status", "Confirmée")
      .is("archived_at", null)
      .not("client_email", "is", null);

    if (bookingsError) throw bookingsError;

    let scopedBookings = bookings || [];
    if (manualBookingId) {
      const { data: manualBookings, error: manualBookingsError } = await adminClient
        .from("kennel_bookings")
        .select("id, user_id, client_name, client_email, start_date, end_date, status, archived_at, dogs(name)")
        .eq("id", manualBookingId)
        .not("client_email", "is", null);
      if (manualBookingsError) throw manualBookingsError;
      scopedBookings = manualBookings || [];
    }

    const bookingIds = scopedBookings.map((booking) => booking.id);
    const [{ data: contracts, error: contractsError }, { data: existing, error: existingError }] =
      bookingIds.length > 0
        ? await Promise.all([
            adminClient.from("kennel_contracts").select("booking_id").in("booking_id", bookingIds),
            adminClient.from("kennel_contract_reminders").select("booking_id, reminder_kind").in("booking_id", bookingIds),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

    if (contractsError) throw contractsError;
    if (existingError) throw existingError;

    const signedBookingIds = new Set((contracts || []).map((contract) => String(contract.booking_id)));
    const existingKeys = new Set((existing || []).map((item) => `${item.booking_id}:${item.reminder_kind}`));
    const candidates = scopedBookings.filter((booking) => {
      const bookingId = String(booking.id);
      const status = String(booking.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return (
        !signedBookingIds.has(bookingId) &&
        !String(booking.archived_at || "").trim() &&
        status.startsWith("confirm") &&
        !status.startsWith("annul")
      );
    }).map((booking) => {
      const daysBefore = daysBetween(todayIso, String(booking.start_date));
      const reminderKind = daysBefore <= 2 ? "urgent" : "upcoming";
      return { booking, daysBefore, reminderKind };
    }).filter(({ booking, reminderKind }) => {
      const bookingId = String(booking.id);
      return manualBookingId || !existingKeys.has(`${bookingId}:${reminderKind}`);
    });

    const userIds = Array.from(new Set(candidates.map(({ booking }) => String(booking.user_id || "")).filter(Boolean)));
    const { data: subscriptions, error: subscriptionsError } = userIds.length > 0
      ? await adminClient
          .from("client_push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth")
          .in("user_id", userIds)
      : { data: [], error: null };
    if (subscriptionsError) throw subscriptionsError;

    const pushConfigured = Boolean(vapidSubject && vapidPublicKey && vapidPrivateKey);
    if (pushConfigured) webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);

    const logRows: Array<Record<string, unknown>> = [];
    const expiredSubscriptionIds: string[] = [];
    let failed = 0;

    for (const { booking, daysBefore, reminderKind } of candidates) {
      const dogName = String(booking.dogs?.name || "votre chien");
      const clientName = String(booking.client_name || "").trim();
      const greeting = clientName ? `Bonjour ${clientName},` : "Bonjour,";
      const startDateLabel = formatDate(String(booking.start_date));
      const subject = reminderKind === "urgent"
        ? `Contrat à signer rapidement pour le séjour de ${dogName}`
        : `Le contrat du séjour de ${dogName} est prêt à être signé`;
      const message = reminderKind === "urgent"
        ? `Le séjour de ${dogName} commence ${daysBefore === 0 ? "aujourd'hui" : `dans ${daysBefore} jour${daysBefore > 1 ? "s" : ""}`} et le contrat n'est pas encore signé.`
        : `Le séjour de ${dogName} débute le ${startDateLabel}. Le contrat est disponible dans votre espace client et attend votre signature.`;
      const emailSent = await sendEmailWithRetry(resendApiKey, {
        from: FROM_EMAIL,
        to: booking.client_email,
        subject,
        text: `${greeting}\n\n${message}\n\nVous pouvez le consulter et le signer depuis votre espace client : ${CLIENT_APP_URL}\n\nMerci et à bientôt,\nLes Poulettes du Marais`,
        html: `<div style="font-family:Arial,sans-serif;color:#24352a;line-height:1.6;max-width:620px;margin:auto"><div style="border-top:7px solid #315c3d;background:#fffdf8;padding:28px"><p>${escapeHtml(greeting)}</p><h1 style="color:#315c3d;font-size:24px;line-height:1.25">${escapeHtml(subject)}</h1><p>${escapeHtml(message)}</p><p>La signature ne prend que quelques instants.</p><p style="margin:26px 0"><a href="${CLIENT_APP_URL}" style="display:inline-block;background:#315c3d;color:#fff;text-decoration:none;padding:13px 18px;border-radius:6px;font-weight:bold">Voir et signer mon contrat</a></p><p>Merci et à bientôt,<br><strong>Les Poulettes du Marais</strong></p></div></div>`,
      });

      if (!emailSent) {
        failed += 1;
        continue;
      }

      let pushSent = 0;
      if (pushConfigured && booking.user_id) {
        const payload = JSON.stringify({ title: subject, body: message, url: "/" });
        for (const subscription of (subscriptions || []).filter((item) => item.user_id === booking.user_id)) {
          try {
            await webpush.sendNotification({
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            }, payload);
            pushSent += 1;
          } catch (error) {
            const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
            if ([404, 410].includes(statusCode)) expiredSubscriptionIds.push(subscription.id);
          }
        }
      }

      logRows.push({
        booking_id: booking.id,
        user_id: booking.user_id || null,
        reminder_kind: reminderKind,
        email_sent: true,
        push_sent: pushSent > 0,
        days_before: daysBefore,
        sent_at: new Date().toISOString(),
        details: { email: booking.client_email, dog_name: dogName, push_count: pushSent, trigger_source: triggerSource },
      });
    }

    if (expiredSubscriptionIds.length > 0) {
      await adminClient.from("client_push_subscriptions").delete().in("id", expiredSubscriptionIds);
    }
    if (logRows.length > 0) {
      const { error: logError } = await adminClient
        .from("kennel_contract_reminders")
        .upsert(logRows, { onConflict: "booking_id,reminder_kind" });
      if (logError) throw logError;
    }

    if (runId) {
      await adminClient.from("automation_runs").update({
        status: failed > 0 && logRows.length === 0 ? "failed" : "success",
        finished_at: new Date().toISOString(),
        processed_count: logRows.length,
        failed_count: failed,
        details: { candidates: candidates.length, upcoming_days: 7, urgent_days: 2 },
        error_message: failed > 0 && logRows.length === 0 ? "Aucune relance de contrat n'a pu être envoyée." : null,
      }).eq("id", runId);
    }

    return new Response(JSON.stringify({ success: true, candidates: candidates.length, sent: logRows.length, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (runClient && runId) {
      await runClient.from("automation_runs").update({
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
