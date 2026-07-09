import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "lespoulettesdumarais@gmail.com";
const FROM_EMAIL = "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>";
const TRACKING_START_DATE = "2026-06-01";
const EGG_TRACKING_START_DATE = "2026-06-13";

type DailyAdminSummary = {
  todayIso: string;
  periodStart: string;
  stock: number;
  produced: number;
  sold: number;
  balance: number;
  ratio: number;
  messages: Array<Record<string, unknown>>;
  educationBookings: Array<Record<string, unknown>>;
  kennelBookings: Array<Record<string, unknown>>;
  ordersToPrepare: Array<Record<string, unknown>>;
};

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Date non renseignee";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getStayDays(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diff = end.getTime() - start.getTime();

  return Math.floor(diff / 86400000) + 1;
}

function getDailyServicePrice(services: Array<Record<string, unknown>>) {
  const activeServices = services.filter((service) => service.active !== false);
  const candidates = activeServices.length > 0 ? activeServices : services;
  const normalized = candidates.map((service) => ({
    ...service,
    unitLabel: String(service.unit_label || "").toLowerCase(),
    name: String(service.name || "").toLowerCase(),
  }));

  const dailyService =
    normalized.find((service) => service.unitLabel.includes("jour")) ||
    normalized.find((service) => service.name.includes("journee") || service.name.includes("journée")) ||
    normalized.find((service) => service.id === "day-care") ||
    normalized.find((service) => service.unitLabel.includes("nuit")) ||
    normalized.find((service) => service.id === "overnight") ||
    normalized[0];

  return Number(dailyService?.price || 0);
}

function getBookingAmount(booking: Record<string, unknown>, dailyPrice: number) {
  if (booking.amount_confirmed !== null && booking.amount_confirmed !== undefined && booking.amount_confirmed !== "") {
    return Number(booking.amount_confirmed || 0);
  }

  return getStayDays(String(booking.start_date || ""), String(booking.end_date || "")) * dailyPrice;
}

function getRemainingAmount(booking: Record<string, unknown>, amount: number) {
  if (booking.payment_received === true) {
    return 0;
  }

  const deposit = Number(booking.deposit_amount || 0);
  return Math.max(0, amount - Math.min(deposit, amount));
}

function getOrderEggCount(order: Record<string, unknown>) {
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];

  if (items.length > 0) {
    return items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.size_eggs || 0),
      0,
    );
  }

  return Number(order.box6 || 0) * 6 + Number(order.box12 || 0) * 12;
}

function isCancelled(value: unknown) {
  return String(value || "").toLowerCase().startsWith("annul");
}

function isPending(value: unknown) {
  return String(value || "").toLowerCase().startsWith("demand");
}

function isHandled(value: unknown) {
  return String(value || "").toLowerCase().startsWith("trait");
}

function buildEmailHtml(items: Array<Record<string, unknown>>, totalRemaining: number, summary: DailyAdminSummary) {
  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const urgentCount =
    summary.messages.length +
    summary.educationBookings.length +
    summary.kennelBookings.length +
    summary.ordersToPrepare.length +
    items.length;
  const paymentRows = items
    .map((item) => {
      const booking = item.booking as Record<string, unknown>;
      const dog = booking.dog as Record<string, unknown> | null;
      const amount = Number(item.amount || 0);
      const deposit = Number(booking.deposit_amount || 0);
      const remaining = Number(item.remaining || 0);

      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(booking.client_name || "Client")}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(dog?.name || "Chien non renseigne")}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb">
            ${formatDate(String(booking.start_date || ""))} au ${formatDate(String(booking.end_date || ""))}
            ${booking.archived_at ? "<br><small>Archive</small>" : ""}
          </td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${formatCurrency(amount)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${formatCurrency(deposit)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${formatCurrency(remaining)}</strong></td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(booking.phone || "")}</td>
        </tr>
      `;
    })
    .join("");

  const urgentRows = [
    ...summary.messages.slice(0, 5).map((message) => ({
      type: "Message",
      label: message.full_name || message.email || "Client",
      detail: message.subject || "Message sans sujet",
    })),
    ...summary.educationBookings.slice(0, 5).map((booking) => ({
      type: "Ferme pedagogique",
      label: booking.client_name || "Client",
      detail: `${booking.activity_type || "Activite"} - ${formatDate(String(booking.booking_date || ""))}`,
    })),
    ...summary.kennelBookings.slice(0, 5).map((booking) => {
      const dog = booking.dog as Record<string, unknown> | null;
      return {
        type: "Pension canine",
        label: booking.client_name || "Client",
        detail: `${dog?.name || "Chien"} - ${formatDate(String(booking.start_date || ""))}`,
      };
    }),
    ...summary.ordersToPrepare.slice(0, 5).map((order) => ({
      type: "Commande du jour",
      label: order.client || order.email || "Client",
      detail: `${getOrderEggCount(order)} oeufs - ${order.status || "A preparer"}`,
    })),
  ]
    .map((item) => `
      <tr>
        <td style="padding:9px;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(item.type)}</strong></td>
        <td style="padding:9px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.label)}</td>
        <td style="padding:9px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.detail)}</td>
      </tr>
    `)
    .join("");

  const urgentSection = urgentCount > 0
    ? `
      <div style="margin-top:22px">
        <h2 style="margin:0 0 10px;color:#991b1b">A faire en priorite</h2>
        <div style="margin-bottom:12px;padding:12px 14px;background:#fff7ed;border-left:5px solid #ea580c">
          <strong>${urgentCount} action${urgentCount > 1 ? "s" : ""} a verifier</strong><br>
          ${summary.messages.length} message(s), ${summary.educationBookings.length} reservation(s) ferme,
          ${summary.kennelBookings.length} reservation(s) pension, ${summary.ordersToPrepare.length} commande(s) du jour,
          ${items.length} paiement(s) a relancer.
        </div>
        ${urgentRows ? `
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead><tr style="background:#f9fafb">
              <th style="padding:9px;text-align:left">Type</th>
              <th style="padding:9px;text-align:left">Client</th>
              <th style="padding:9px;text-align:left">Detail</th>
            </tr></thead>
            <tbody>${urgentRows}</tbody>
          </table>
        ` : ""}
      </div>
    `
    : `<div style="margin-top:22px;padding:12px 14px;background:#f0fdf4;border-left:5px solid #16a34a"><strong>Aucune action urgente ce matin.</strong></div>`;

  const paymentsSection = items.length > 0
    ? `
      <div style="margin-top:24px">
        <h2 style="margin:0 0 10px;color:#991b1b">Impayes pension canine</h2>
        <div style="margin:0 0 12px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca">
          <strong>${items.length} dossier${items.length > 1 ? "s" : ""} a suivre</strong> - reste total :
          <strong>${formatCurrency(totalRemaining)}</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#f9fafb">
            <th style="padding:9px;text-align:left">Client</th>
            <th style="padding:9px;text-align:left">Chien</th>
            <th style="padding:9px;text-align:left">Sejour</th>
            <th style="padding:9px;text-align:right">Montant</th>
            <th style="padding:9px;text-align:right">Acompte</th>
            <th style="padding:9px;text-align:right">Reste</th>
            <th style="padding:9px;text-align:left">Telephone</th>
          </tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </div>
    `
    : `<p style="margin-top:22px;color:#166534"><strong>Aucun impaye pension canine a relancer.</strong></p>`;

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
      <h1 style="margin:0 0 12px;color:#166534">Synthese quotidienne</h1>
      <p>Bonjour,</p>
      <p>Voici les informations utiles pour commencer la journee du ${escapeHtml(todayLabel)}.</p>

      <div style="margin:18px 0;padding:16px;background:#f8fafc;border:1px solid #d1d5db">
        <h2 style="margin:0 0 12px;color:#166534">Oeufs - mois en cours</h2>
        <table style="width:100%;border-collapse:collapse;text-align:center">
          <tr>
            <td style="padding:10px;background:#fef3c7"><small>Production</small><br><strong style="font-size:22px">${summary.produced}</strong></td>
            <td style="padding:10px;background:#dbeafe"><small>Ventes</small><br><strong style="font-size:22px">${summary.sold}</strong></td>
            <td style="padding:10px;background:${summary.balance < 0 ? "#fee2e2" : "#dcfce7"}"><small>Solde</small><br><strong style="font-size:22px">${summary.balance > 0 ? "+" : ""}${summary.balance}</strong></td>
            <td style="padding:10px;background:#f3e8ff"><small>Ratio vendu / produit</small><br><strong style="font-size:22px">${summary.ratio}%</strong></td>
            <td style="padding:10px;background:#f1f5f9"><small>Stock actuel</small><br><strong style="font-size:22px">${summary.stock}</strong></td>
          </tr>
        </table>
        <p style="margin:10px 0 0;color:#64748b;font-size:12px">Calcul du ${formatDate(summary.periodStart)} au ${formatDate(summary.todayIso)}.</p>
      </div>

      ${urgentSection}
      ${paymentsSection}
      <p style="margin-top:24px">Les Poulettes du Marais</p>
    </div>
  `;
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const cronSecret = Deno.env.get("DAILY_PAYMENT_EMAIL_SECRET");
    const requestSecret = req.headers.get("x-cron-secret") || "";
    const isServiceRoleRequest = req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !cronSecret) {
      return new Response(JSON.stringify({ error: "Configuration email incomplete." }), {
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
      .insert({ automation_key: "daily_payments", trigger_source: triggerSource })
      .select("id")
      .maybeSingle();
    runId = String(runRow?.id || "");

    async function triggerContractReminders() {
      try {
        const contractResponse = await fetch(`${supabaseUrl}/functions/v1/send-kennel-contract-reminders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
          body: JSON.stringify({ triggerSource: "scheduled" }),
        });
        const result = await contractResponse.json().catch(() => ({}));
        if (!contractResponse.ok) console.warn("Relances de contrats pension non exécutées.", result);
        return result as Record<string, unknown>;
      } catch (contractError) {
        console.warn("Relances de contrats pension indisponibles.", contractError);
        return null;
      }
    }

    const { data: automationSetting } = await adminClient
      .from("site_settings")
      .select("value")
      .eq("key", "automation_settings")
      .maybeSingle();
    if (automationSetting?.value?.daily_payments === false) {
      const contractReminderResult = await triggerContractReminders();
      if (runId) {
        await adminClient.from("automation_runs").update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: { skipped: true, reason: "paused", contract_reminders: contractReminderResult },
        }).eq("id", runId);
      }
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: "paused",
        contractReminders: contractReminderResult,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: services, error: servicesError } = await adminClient
      .from("kennel_services")
      .select("id, name, price, unit_label, active")
      .order("created_at", { ascending: true });

    if (servicesError) {
      throw servicesError;
    }

    const dailyPrice = getDailyServicePrice(services || []);

    const todayIso = getParisIsoDate();
    const { data: bookings, error: bookingsError } = await adminClient
      .from("kennel_bookings")
      .select("id, client_name, client_email, phone, start_date, end_date, status, amount_confirmed, deposit_amount, payment_received, payment_method, archived_at, dog:dogs(id, name)")
      .gte("start_date", TRACKING_START_DATE)
      .lt("end_date", todayIso)
      .order("end_date", { ascending: true });

    if (bookingsError) {
      throw bookingsError;
    }

    const unpaidItems = (bookings || [])
      .filter((booking) => !String(booking.status || "").toLowerCase().startsWith("annul"))
      .map((booking) => {
        const amount = getBookingAmount(booking, dailyPrice);
        const remaining = getRemainingAmount(booking, amount);

        return { booking, amount, remaining };
      })
      .filter((item) => item.remaining > 0)
      .sort((a, b) => {
        const aEnd = String((a.booking as Record<string, unknown>).end_date || "");
        const bEnd = String((b.booking as Record<string, unknown>).end_date || "");
        return aEnd.localeCompare(bEnd);
      });

    const totalRemaining = unpaidItems.reduce((sum, item) => sum + Number(item.remaining || 0), 0);
    const monthStart = `${todayIso.slice(0, 7)}-01`;
    const periodStart = monthStart < EGG_TRACKING_START_DATE ? EGG_TRACKING_START_DATE : monthStart;
    const [productionResult, ordersResult, stockResult, messagesResult, educationResult, kennelResult] = await Promise.all([
      adminClient
        .from("egg_production_logs")
        .select("log_date, eggs_collected")
        .gte("log_date", periodStart)
        .lte("log_date", todayIso),
      adminClient
        .from("orders")
        .select("id, client, email, date, status, items, box6, box12, archived_at")
        .gte("date", periodStart)
        .lte("date", todayIso),
      adminClient.from("stock").select("eggs_available").order("id", { ascending: true }).limit(1).maybeSingle(),
      adminClient
        .from("contact_messages")
        .select("id, full_name, email, subject, status, created_at")
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      adminClient
        .from("educational_bookings")
        .select("id, client_name, activity_type, booking_date, status, archived_at")
        .is("archived_at", null)
        .order("booking_date", { ascending: true }),
      adminClient
        .from("kennel_bookings")
        .select("id, client_name, start_date, end_date, status, archived_at, dog:dogs(id, name)")
        .is("archived_at", null)
        .order("start_date", { ascending: true }),
    ]);

    const summaryWarnings = [
      ["production", productionResult.error],
      ["commandes", ordersResult.error],
      ["stock", stockResult.error],
      ["messages", messagesResult.error],
      ["reservations_ferme", educationResult.error],
      ["reservations_pension", kennelResult.error],
    ]
      .filter((entry) => Boolean(entry[1]))
      .map(([source, error]) => `${source}: ${String((error as { message?: string } | null)?.message || "indisponible")}`);

    if (summaryWarnings.length > 0) {
      console.warn("Certaines donnees de la synthese sont indisponibles.", summaryWarnings);
    }

    const activeOrders = (ordersResult.data || []).filter((order) => !isCancelled(order.status) && !order.archived_at);
    const produced = (productionResult.data || []).reduce((sum, log) => sum + Number(log.eggs_collected || 0), 0);
    const sold = activeOrders.reduce((sum, order) => sum + getOrderEggCount(order), 0);
    const balance = produced - sold;
    const ratio = produced > 0 ? Math.round((sold / produced) * 100) : sold > 0 ? 100 : 0;
    const summary: DailyAdminSummary = {
      todayIso,
      periodStart,
      stock: Number(stockResult.data?.eggs_available || 0),
      produced,
      sold,
      balance,
      ratio,
      messages: (messagesResult.data || []).filter((message) => !isHandled(message.status)),
      educationBookings: (educationResult.data || []).filter((booking) => isPending(booking.status)),
      kennelBookings: (kennelResult.data || []).filter((booking) => isPending(booking.status)),
      ordersToPrepare: activeOrders.filter((order) => {
        const status = String(order.status || "").toLowerCase();
        return order.date === todayIso && !status.startsWith("livr");
      }),
    };
    const urgentCount =
      summary.messages.length +
      summary.educationBookings.length +
      summary.kennelBookings.length +
      summary.ordersToPrepare.length +
      unpaidItems.length;
    const subject = `Synthese quotidienne - ${urgentCount} action${urgentCount > 1 ? "s" : ""} a verifier`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject,
        html: buildEmailHtml(unpaidItems, totalRemaining, summary),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Email quotidien non envoye.");
    }

    await adminClient.from("admin_action_logs").insert({
      action_type: "notification_daily_admin_summary_email",
      title: "Synthese quotidienne admin envoyee",
      target_type: "Administration",
      target_id: null,
      target_label: `${urgentCount} action(s) a verifier`,
      details: {
        recipient: ADMIN_EMAIL,
        unpaid_count: unpaidItems.length,
        total_remaining: totalRemaining,
        egg_produced: summary.produced,
        egg_sold: summary.sold,
        egg_balance: summary.balance,
        egg_ratio: summary.ratio,
        urgent_count: urgentCount,
        warnings: summaryWarnings,
      },
      created_by: null,
      created_by_email: "system",
    });

    const contractReminderResult = await triggerContractReminders();

    if (runId) {
      await adminClient
        .from("automation_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          processed_count: urgentCount,
          details: {
            unpaid_count: unpaidItems.length,
            total_remaining: totalRemaining,
            egg_produced: summary.produced,
            egg_sold: summary.sold,
            egg_balance: summary.balance,
            egg_ratio: summary.ratio,
            urgent_count: urgentCount,
            warnings: summaryWarnings,
            contract_reminders: contractReminderResult,
          },
        })
        .eq("id", runId);
    }

    return new Response(JSON.stringify({
      sent: true,
      unpaidCount: unpaidItems.length,
      totalRemaining,
      urgentCount,
      eggSummary: { produced: summary.produced, sold: summary.sold, balance: summary.balance, ratio: summary.ratio },
      warnings: summaryWarnings,
      contractReminders: contractReminderResult,
      email: data,
    }), {
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
