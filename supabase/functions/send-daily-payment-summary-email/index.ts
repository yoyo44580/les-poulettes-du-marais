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

function buildEmailHtml(items: Array<Record<string, unknown>>, totalRemaining: number) {
  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  if (items.length === 0) {
    return `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
        <h1 style="margin:0 0 12px;color:#166534">Suivi des paiements pension canine</h1>
        <p>Bonjour,</p>
        <p>Bonne nouvelle : aucun impaye pension canine a relancer ce matin (${escapeHtml(todayLabel)}).</p>
        <p style="margin-top:24px">Les Poulettes du Marais</p>
      </div>
    `;
  }

  const rows = items
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

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
      <h1 style="margin:0 0 12px;color:#991b1b">Impayes pension canine</h1>
      <p>Bonjour,</p>
      <p>Voici la liste des paiements pension canine a relancer ce matin (${escapeHtml(todayLabel)}).</p>
      <div style="margin:18px 0;padding:14px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px">
        <strong>${items.length} dossier${items.length > 1 ? "s" : ""} a suivre</strong><br>
        Reste total estime : <strong>${formatCurrency(totalRemaining)}</strong>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px;text-align:left;border-bottom:1px solid #d1d5db">Client</th>
            <th style="padding:10px;text-align:left;border-bottom:1px solid #d1d5db">Chien</th>
            <th style="padding:10px;text-align:left;border-bottom:1px solid #d1d5db">Sejour</th>
            <th style="padding:10px;text-align:right;border-bottom:1px solid #d1d5db">Montant</th>
            <th style="padding:10px;text-align:right;border-bottom:1px solid #d1d5db">Acompte</th>
            <th style="padding:10px;text-align:right;border-bottom:1px solid #d1d5db">Reste</th>
            <th style="padding:10px;text-align:left;border-bottom:1px solid #d1d5db">Telephone</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px">Les Poulettes du Marais</p>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const cronSecret = Deno.env.get("DAILY_PAYMENT_EMAIL_SECRET");
    const requestSecret = req.headers.get("x-cron-secret") || "";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !cronSecret) {
      return new Response(JSON.stringify({ error: "Configuration email incomplete." }), {
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
    const subject =
      unpaidItems.length > 0
        ? `Impayes pension canine - ${unpaidItems.length} dossier${unpaidItems.length > 1 ? "s" : ""} a suivre`
        : "Impayes pension canine - aucun dossier a relancer";

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
        html: buildEmailHtml(unpaidItems, totalRemaining),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Email quotidien non envoye.");
    }

    await adminClient.from("admin_action_logs").insert({
      action_type: "notification_kennel_payment_daily_email",
      title: "Email quotidien impayes pension",
      target_type: "Paiements",
      target_id: null,
      target_label: `${unpaidItems.length} dossier(s) - ${formatCurrency(totalRemaining)}`,
      details: {
        recipient: ADMIN_EMAIL,
        unpaid_count: unpaidItems.length,
        total_remaining: totalRemaining,
      },
      created_by: null,
      created_by_email: "system",
    });

    return new Response(JSON.stringify({ sent: true, unpaidCount: unpaidItems.length, totalRemaining, email: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
