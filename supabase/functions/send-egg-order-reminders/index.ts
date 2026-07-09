import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_EMAIL = "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>";
const MIN_ORDERS_ON_WEEKDAY = 2;
const HISTORY_DAYS = 183;
const RECENT_HABIT_DAYS = 90;
const FIRST_ORDER_WAIT_DAYS = 3;
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

function getWeekday(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
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
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) return true;
    lastError = await response.text();

    if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
  }

  console.warn("Email de rappel non envoyé.", lastError);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let runClient: ReturnType<typeof createClient> | null = null;
  let runId = "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("EGG_ORDER_REMINDER_SECRET");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const requestSecret = req.headers.get("x-cron-secret") || "";
    const isServiceRoleRequest = req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;

    if (!supabaseUrl || !serviceRoleKey || !cronSecret || !resendApiKey) {
      return new Response(JSON.stringify({ error: "Configuration des rappels incomplete." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isServiceRoleRequest && requestSecret !== cronSecret) {
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
      .insert({ automation_key: "egg_reminders", trigger_source: triggerSource })
      .select("id")
      .maybeSingle();
    runId = String(runRow?.id || "");
    const { data: automationSetting } = await adminClient
      .from("site_settings")
      .select("value")
      .eq("key", "automation_settings")
      .maybeSingle();
    if (automationSetting?.value?.egg_reminders === false) {
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
    const historyStart = addDays(todayIso, -HISTORY_DAYS);
    const recentHabitStart = addDays(todayIso, -RECENT_HABIT_DAYS);
    const targets = [
      { date: addDays(todayIso, 2), leadHours: 48 },
      { date: addDays(todayIso, 1), leadHours: 24 },
    ];

    const [
      { data: profiles, error: profilesError },
      { data: orders, error: ordersError },
      { data: deliverySlots, error: deliverySlotsError },
      { data: allOrderOwners, error: allOrderOwnersError },
      { data: firstOrderFollowups, error: firstOrderFollowupsError },
    ] = await Promise.all([
      adminClient
        .from("profiles")
        .select("id, full_name, email, can_order_eggs, is_admin, created_at")
        .eq("can_order_eggs", true)
        .eq("is_admin", false)
        .not("email", "is", null),
      adminClient
        .from("orders")
        .select("id, user_id, delivery_date, status")
        .gte("delivery_date", historyStart)
        .not("user_id", "is", null),
      adminClient
        .from("delivery_slots")
        .select("delivery_date, active, max_orders")
        .in("delivery_date", targets.map((target) => target.date)),
      adminClient
        .from("orders")
        .select("user_id")
        .not("user_id", "is", null),
      adminClient
        .from("egg_first_order_followups")
        .select("user_id"),
    ]);

    if (profilesError) throw profilesError;
    if (ordersError) throw ordersError;
    if (deliverySlotsError) throw deliverySlotsError;
    if (allOrderOwnersError) throw allOrderOwnersError;
    if (firstOrderFollowupsError) throw firstOrderFollowupsError;

    const firstOrderCutoff = new Date();
    firstOrderCutoff.setUTCDate(firstOrderCutoff.getUTCDate() - FIRST_ORDER_WAIT_DAYS);
    const orderOwnerIds = new Set((allOrderOwners || []).map((order) => String(order.user_id || "")));
    const alreadyFollowedUpIds = new Set((firstOrderFollowups || []).map((item) => String(item.user_id || "")));
    const firstOrderCandidates = (profiles || []).filter((profile) => {
      const profileId = String(profile.id || "");
      const email = String(profile.email || "").trim();
      const createdAt = new Date(String(profile.created_at || ""));
      return Boolean(
        profileId &&
        email.includes("@") &&
        Number.isFinite(createdAt.getTime()) &&
        createdAt <= firstOrderCutoff &&
        !orderOwnerIds.has(profileId) &&
        !alreadyFollowedUpIds.has(profileId)
      );
    });
    const firstOrderLogRows: Array<Record<string, unknown>> = [];
    let firstOrderFailed = 0;

    for (const profile of firstOrderCandidates) {
      const fullName = String(profile.full_name || "").trim();
      const greeting = fullName ? `Bonjour ${fullName},` : "Bonjour,";
      const subject = "Votre première commande d'œufs aux Poulettes du Marais";
      const sent = await sendEmailWithRetry(resendApiKey, {
        from: FROM_EMAIL,
        to: profile.email,
        subject,
        text: `${greeting}\n\nVotre accès aux commandes d'œufs est bien ouvert. Vous n'avez peut-être simplement pas encore eu l'occasion de passer votre première commande.\n\nLorsque vous le souhaitez, quelques clics suffisent depuis votre espace client pour choisir vos produits et votre date de livraison.\n\nAccéder à mon espace : ${CLIENT_APP_URL}\n\nÀ bientôt,\nLes Poulettes du Marais`,
        html: `<div style="font-family:Arial,sans-serif;color:#24352a;line-height:1.6;max-width:620px;margin:auto"><div style="border-top:7px solid #315c3d;background:#fffdf8;padding:28px"><p>${escapeHtml(greeting)}</p><h1 style="color:#315c3d;font-size:25px;line-height:1.2">Votre accès aux commandes d'œufs est prêt</h1><p>Vous n'avez peut-être simplement pas encore eu l'occasion de passer votre première commande.</p><p>Lorsque vous le souhaitez, quelques clics suffisent depuis votre espace client pour choisir vos produits et votre date de livraison.</p><p style="margin:26px 0"><a href="${CLIENT_APP_URL}" style="display:inline-block;background:#315c3d;color:#ffffff;text-decoration:none;padding:13px 18px;border-radius:6px;font-weight:bold">Passer ma première commande</a></p><p style="color:#6b6255;font-size:14px">Aucune urgence : ce message est simplement là pour vous rappeler que votre accès est actif.</p><p style="margin-top:26px">À bientôt,<br><strong>Les Poulettes du Marais</strong></p></div></div>`,
      });

      if (!sent) {
        firstOrderFailed += 1;
        continue;
      }

      firstOrderLogRows.push({
        user_id: profile.id,
        email: profile.email,
        details: {
          profile_created_at: profile.created_at,
          wait_days: FIRST_ORDER_WAIT_DAYS,
        },
      });
    }

    if (firstOrderLogRows.length > 0) {
      const { error: firstOrderLogError } = await adminClient
        .from("egg_first_order_followups")
        .insert(firstOrderLogRows);
      if (firstOrderLogError) throw firstOrderLogError;
    }

    const validOrders = (orders || []).filter(
      (order) =>
        String(order.delivery_date || "") < todayIso &&
        !String(order.status || "").toLowerCase().startsWith("annul")
    );
    const upcomingOrders = (orders || []).filter(
      (order) =>
        targets.some((target) => target.date === order.delivery_date) &&
        !String(order.status || "").toLowerCase().startsWith("annul")
    );
    const candidates: Array<Record<string, unknown>> = [];

    for (const profile of profiles || []) {
      const profileOrders = validOrders.filter((order) => order.user_id === profile.id);

      for (const target of targets) {
        const targetWeekday = getWeekday(target.date);
        const deliverySlot = (deliverySlots || []).find((slot) => slot.delivery_date === target.date);
        const defaultWeekdayAvailable = [1, 2, 4, 5].includes(targetWeekday);
        const targetOrderCount = upcomingOrders.filter((order) => order.delivery_date === target.date).length;
        const deliveryIsClosed = deliverySlot ? deliverySlot.active === false : !defaultWeekdayAvailable;
        const deliveryIsFull =
          Number(deliverySlot?.max_orders || 0) > 0 &&
          targetOrderCount >= Number(deliverySlot?.max_orders || 0);
        const matchingOrders = profileOrders.filter((order) => getWeekday(String(order.delivery_date)) === targetWeekday);
        const latestMatchingDate = matchingOrders.reduce(
          (latest, order) => String(order.delivery_date || "") > latest ? String(order.delivery_date) : latest,
          ""
        );
        const alreadyOrdered = upcomingOrders.some(
          (order) => order.user_id === profile.id && order.delivery_date === target.date
        );

        if (
          matchingOrders.length >= MIN_ORDERS_ON_WEEKDAY &&
          latestMatchingDate >= recentHabitStart &&
          !deliveryIsClosed &&
          !deliveryIsFull &&
          !alreadyOrdered
        ) {
          candidates.push({ profile, target });
        }
      }
    }

    if (candidates.length === 0) {
      const status = firstOrderFailed > 0 && firstOrderLogRows.length === 0 ? "failed" : "success";
      if (runId) {
        await adminClient
          .from("automation_runs")
          .update({
            status,
            finished_at: new Date().toISOString(),
            processed_count: firstOrderLogRows.length,
            failed_count: firstOrderFailed,
            details: {
              habitual_candidates: 0,
              first_order_candidates: firstOrderCandidates.length,
              first_order_sent: firstOrderLogRows.length,
            },
            error_message: status === "failed" ? "Aucune relance de première commande n'a pu être envoyée." : null,
          })
          .eq("id", runId);
      }
      return new Response(JSON.stringify({
        success: status === "success",
        candidates: firstOrderCandidates.length,
        sent: firstOrderLogRows.length,
        failed: firstOrderFailed,
        first_order_sent: firstOrderLogRows.length,
        habitual_sent: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetDates = Array.from(new Set(candidates.map((item) => String((item.target as Record<string, unknown>).date))));
    const { data: existingReminders, error: remindersError } = await adminClient
      .from("egg_order_reminders")
      .select("user_id, target_date, lead_hours")
      .in("target_date", targetDates);

    if (remindersError) throw remindersError;

    const existingKeys = new Set(
      (existingReminders || []).map((item) => `${item.user_id}:${item.target_date}:${item.lead_hours}`)
    );
    const reminders = candidates.filter((item) => {
      const profile = item.profile as Record<string, unknown>;
      const target = item.target as Record<string, unknown>;
      return !existingKeys.has(`${profile.id}:${target.date}:${target.leadHours}`);
    });

    const userIds = Array.from(new Set(reminders.map((item) => String((item.profile as Record<string, unknown>).id))));
    const { data: subscriptions, error: subscriptionsError } = userIds.length > 0
      ? await adminClient
          .from("client_push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth")
          .in("user_id", userIds)
      : { data: [], error: null };

    if (subscriptionsError) throw subscriptionsError;

    const pushConfigured = Boolean(vapidSubject && vapidPublicKey && vapidPrivateKey);
    if (pushConfigured) {
      webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);
    }

    const expiredSubscriptionIds: string[] = [];
    const logRows: Array<Record<string, unknown>> = [];
    let failedDeliveries = 0;

    for (const item of reminders) {
      const profile = item.profile as Record<string, unknown>;
      const target = item.target as Record<string, unknown>;
      const targetDate = String(target.date);
      const leadHours = Number(target.leadHours);
      const dateLabel = formatDate(targetDate);
      const title = leadHours === 48 ? "Pensez a votre commande d'oeufs" : "Dernier rappel pour vos oeufs";
      const message = `Votre jour habituel approche (${dateLabel}) et aucune commande n'est encore enregistree.`;
      let pushSent = 0;
      let emailSent = false;

      if (pushConfigured) {
        const userSubscriptions = (subscriptions || []).filter((subscription) => subscription.user_id === profile.id);
        const payload = JSON.stringify({ title, body: message, url: "/" });

        for (const subscription of userSubscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              payload
            );
            pushSent += 1;
          } catch (error) {
            const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
            if ([404, 410].includes(statusCode)) expiredSubscriptionIds.push(subscription.id);
          }
        }
      }

      emailSent = await sendEmailWithRetry(resendApiKey, {
          from: FROM_EMAIL,
          to: profile.email,
          subject: title,
          text: `Bonjour ${profile.full_name || ""},\n\n${message}\n\nVous pouvez passer votre commande depuis votre espace client.\n\nLes Poulettes du Marais`,
          html: `<div style="font-family:Arial,sans-serif;color:#24352a;line-height:1.55"><h1 style="color:#315c3d">${escapeHtml(title)}</h1><p>Bonjour ${escapeHtml(profile.full_name || "")},</p><p>${escapeHtml(message)}</p><p>Vous pouvez passer votre commande depuis votre espace client.</p><p style="margin-top:24px">Les Poulettes du Marais</p></div>`,
      });

      if (!emailSent && pushSent === 0) {
        failedDeliveries += 1;
        continue;
      }

      logRows.push({
        user_id: profile.id,
        target_date: targetDate,
        lead_hours: leadHours,
        usual_weekday: getWeekday(targetDate),
        email_sent: emailSent,
        push_sent: pushSent > 0,
        details: { email: profile.email, push_count: pushSent },
      });
    }

    if (expiredSubscriptionIds.length > 0) {
      await adminClient.from("client_push_subscriptions").delete().in("id", expiredSubscriptionIds);
    }

    if (logRows.length > 0) {
      const { error: insertError } = await adminClient.from("egg_order_reminders").insert(logRows);
      if (insertError) throw insertError;
    }

    const totalSent = firstOrderLogRows.length + logRows.length;
    const totalFailed = firstOrderFailed + failedDeliveries;

    if (runId) {
      await adminClient
        .from("automation_runs")
        .update({
          status: totalFailed > 0 && totalSent === 0 ? "failed" : "success",
          finished_at: new Date().toISOString(),
          processed_count: totalSent,
          failed_count: totalFailed,
          details: {
            habitual_candidates: candidates.length,
            habitual_sent: logRows.length,
            first_order_candidates: firstOrderCandidates.length,
            first_order_sent: firstOrderLogRows.length,
          },
          error_message: totalFailed > 0 && totalSent === 0 ? "Aucun rappel n'a pu etre envoye." : null,
        })
        .eq("id", runId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        candidates: candidates.length + firstOrderCandidates.length,
        sent: totalSent,
        failed: totalFailed,
        first_order_sent: firstOrderLogRows.length,
        habitual_sent: logRows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
