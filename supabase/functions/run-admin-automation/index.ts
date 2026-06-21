import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const automations = {
  daily_payments: {
    functionName: "send-daily-payment-summary-email",
    secretName: "DAILY_PAYMENT_EMAIL_SECRET",
  },
  egg_reminders: {
    functionName: "send-egg-order-reminders",
    secretName: "EGG_ORDER_REMINDER_SECRET",
  },
  google_reviews: {
    functionName: "send-google-review-requests",
    secretName: "GOOGLE_REVIEW_REQUEST_SECRET",
  },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization") || "";

    if (!supabaseUrl || !serviceRoleKey || !authorization.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Acces refuse." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authorization.slice(7);
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Session administrateur invalide.");

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();
    if (profileError || profile?.is_admin !== true) throw new Error("Acces reserve a l'administrateur.");

    const body = await req.json();
    const automationKey = String(body.automationKey || "") as keyof typeof automations;
    const automation = automations[automationKey];
    if (!automation) {
      return new Response(JSON.stringify({ error: "Automatisme inconnu." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cronSecret = Deno.env.get(automation.secretName);
    if (!cronSecret) throw new Error(`Secret ${automation.secretName} absent.`);

    const response = await fetch(`${supabaseUrl}/functions/v1/${automation.functionName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
      body: JSON.stringify({ triggerSource: "manual" }),
    });
    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(responseBody.error || "Relance impossible.");

    return new Response(JSON.stringify({ success: true, result: responseBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
