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
const TRACKING_START_DATE = "2026-06-01";

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

function normalizeStatus(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getStayDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 1;
  const start = new Date(`${startDate}T12:00:00Z`).getTime();
  const end = new Date(`${endDate}T12:00:00Z`).getTime();
  const days = Math.round((end - start) / 86400000) + 1;
  return Math.max(1, days);
}

function getBookingAmount(booking: Record<string, unknown>, dailyPrice: number) {
  if (booking.amount_confirmed !== null && booking.amount_confirmed !== undefined && booking.amount_confirmed !== "") {
    return Number(booking.amount_confirmed || 0);
  }

  return getStayDays(String(booking.start_date || ""), String(booking.end_date || "")) * dailyPrice;
}

function getRemainingAmount(booking: Record<string, unknown>, amount: number) {
  if (booking.payment_received === true) return 0;
  const deposit = Number(booking.deposit_amount || 0);
  return Math.max(0, amount - Math.min(deposit, amount));
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
    const cronSecret = Deno.env.get("CLIENT_KENNEL_PAYMENT_REMINDER_SECRET") || Deno.env.get("DAILY_PAYMENT_EMAIL_SECRET");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const requestSecret = req.headers.get("x-cron-secret") || "";
    const isServiceRoleRequest = req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      throw new Error("Configuration des relances paiement client incomplete.");
    }

    if (!isServiceRoleRequest && (!cronSecret || requestSecret !== cronSecret)) {
      return new Response(JSON.stringify({ error: "Acces refuse." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    runClient = adminClient;
    const body = await req.json().catch(() => ({}));
    const triggerSource = body?.triggerSource === "manual" ? "manual" : "scheduled";
    const todayIso = getParisIsoDate();

    const { data: runRow } = await adminClient
      .from("automation_runs")
      .insert({ automation_key: "client_kennel_payments", trigger_source: triggerSource })
      .select("id")
      .maybeSingle();
    runId = String(runRow?.id || "");

    const { data: automationSetting } = await adminClient
      .from("site_settings")
      .select("value")
      .eq("key", "automation_settings")
      .maybeSingle();
    if (automationSetting?.value?.client_kennel_payments === false) {
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

    const { data: services } = await adminClient.from("kennel_services").select("price").eq("active", true).limit(1);
    const dailyPrice = Number(services?.[0]?.price || 18);

    const { data: bookings, error: bookingsError } = await adminClient
      .from("kennel_bookings")
      .select("id, user_id, client_name, client_email, start_date, end_date, status, amount_confirmed, deposit_amount, payment_received, payment_method, archived_at, dog:dogs(id, name)")
      .gte("start_date", TRACKING_START_DATE)
      .lt("end_date", todayIso)
      .not("client_email", "is", null)
      .order("end_date", { ascending: true });

    if (bookingsError) throw bookingsError;

    const rawCandidates = (bookings || [])
      .filter((booking) => {
        const status = normalizeStatus(booking.status);
        return !status.startsWith("annul") && !String(booking.archived_at || "").trim();
      })
      .map((booking) => {
        const amount = getBookingAmount(booking, dailyPrice);
        const remaining = getRemainingAmount(booking, amount);
        return { booking, amount, remaining };
      })
      .filter((item) => item.remaining > 0);

    const bookingIds = rawCandidates.map((item) => item.booking.id);
    const { data: existingReminders, error: existingError } = bookingIds.length > 0
      ? await adminClient
          .from("kennel_payment_reminders")
          .select("booking_id")
          .eq("reminder_date", todayIso)
          .in("booking_id", bookingIds)
      : { data: [], error: null };
    if (existingError) throw existingError;

    const alreadyReminded = new Set((existingReminders || []).map((item) => String(item.booking_id)));
    const candidates = rawCandidates.filter((item) => !alreadyReminded.has(String(item.booking.id)));
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

    for (const { booking, amount, remaining } of candidates) {
      const dogName = String(booking.dog?.name || "votre chien");
      const clientName = String(booking.client_name || "").trim();
      const greeting = clientName ? `Bonjour ${clientName},` : "Bonjour,";
      const subject = `Rappel paiement du séjour de ${dogName}`;
      const message = `Le séjour de ${dogName}, terminé le ${formatDate(String(booking.end_date))}, présente encore un reste à régler de ${remaining.toFixed(2)} €.`;
      const emailSent = await sendEmailWithRetry(resendApiKey, {
        from: FROM_EMAIL,
        to: booking.client_email,
        subject,
        text: `${greeting}\n\n${message}\n\nVous pouvez retrouver le détail depuis votre espace client : ${CLIENT_APP_URL}\n\nSi le paiement vient d'être effectué, vous pouvez ignorer ce message.\n\nMerci beaucoup,\nLes Poulettes du Marais`,
        html: `<div style="font-family:Arial,sans-serif;color:#2c241d;line-height:1.6;max-width:640px;margin:auto"><div style="border-top:7px solid #b91c1c;background:#fffdf8;padding:28px"><p>${escapeHtml(greeting)}</p><h1 style="color:#991b1b;font-size:24px;line-height:1.25">${escapeHtml(subject)}</h1><p>${escapeHtml(message)}</p><p>Si le paiement vient d'être effectué, vous pouvez simplement ignorer ce message.</p><p style="margin:26px 0"><a href="${CLIENT_APP_URL}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:13px 18px;border-radius:6px;font-weight:bold">Voir mon espace client</a></p><p>Merci beaucoup,<br><strong>Les Poulettes du Marais</strong></p></div></div>`,
      });

      if (!emailSent) {
        failed += 1;
        continue;
      }

      let pushSent = 0;
      if (pushConfigured && booking.user_id) {
        const payload = JSON.stringify({
          title: "Paiement pension à finaliser",
          body: `${remaining.toFixed(2)} € restent à régler pour le séjour de ${dogName}.`,
          url: "/",
        });
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
        reminder_date: todayIso,
        email_sent: true,
        push_sent: pushSent > 0,
        remaining_amount: remaining,
        details: {
          email: booking.client_email,
          dog_name: dogName,
          amount,
          remaining,
          push_count: pushSent,
          trigger_source: triggerSource,
        },
      });
    }

    if (expiredSubscriptionIds.length > 0) {
      await adminClient.from("client_push_subscriptions").delete().in("id", Array.from(new Set(expiredSubscriptionIds)));
    }
    if (logRows.length > 0) {
      const { error: logError } = await adminClient
        .from("kennel_payment_reminders")
        .upsert(logRows, { onConflict: "booking_id,reminder_date" });
      if (logError) throw logError;
    }

    if (runId) {
      await adminClient.from("automation_runs").update({
        status: failed > 0 && logRows.length === 0 ? "failed" : "success",
        finished_at: new Date().toISOString(),
        processed_count: logRows.length,
        failed_count: failed,
        details: { candidates: candidates.length, already_reminded_today: alreadyReminded.size },
        error_message: failed > 0 && logRows.length === 0 ? "Aucune relance paiement client n'a pu etre envoyee." : null,
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
