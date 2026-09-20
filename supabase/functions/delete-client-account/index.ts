import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function safeDelete(client: ReturnType<typeof createClient>, table: string, userId: string) {
  const { error } = await client.from(table).delete().eq("user_id", userId);
  if (error) {
    console.warn(`Suppression ignoree pour ${table}: ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Methode non autorisee." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Configuration Supabase incomplete." }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();

    if (userError || !userData.user) {
      return jsonResponse({ error: "Non autorise." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return jsonResponse({ error: "Confirmation requise." }, 400);
    }

    const user = userData.user;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, phone, delivery_address, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }

    if (profile?.is_admin === true) {
      return jsonResponse({ error: "Un compte admin ne peut pas etre supprime depuis l'espace client." }, 403);
    }

    const anonymizedEmail = `compte-supprime-${user.id.slice(0, 8)}@les-poulettes.local`;

    const { error: deletionLogError } = await adminClient.from("client_account_deletions").insert({
      user_id: user.id,
      email: profile?.email || user.email || null,
      full_name: profile?.full_name || user.user_metadata?.full_name || null,
      phone: profile?.phone || user.user_metadata?.phone || null,
      delivery_address: profile?.delivery_address || user.user_metadata?.delivery_address || null,
      deletion_source: "client_space",
      user_agent: req.headers.get("user-agent") || null,
    });

    if (deletionLogError) {
      return jsonResponse({ error: `Migration comptes supprimes a appliquer : ${deletionLogError.message}` }, 500);
    }

    await Promise.all([
      safeDelete(adminClient, "client_push_subscriptions", user.id),
      safeDelete(adminClient, "client_app_versions", user.id),
      safeDelete(adminClient, "client_app_health_reminders", user.id),
      safeDelete(adminClient, "egg_order_reminders", user.id),
      safeDelete(adminClient, "egg_first_order_followups", user.id),
    ]);

    const criticalAnonymizations = [
      ["profil client", () => adminClient
        .from("profiles")
        .update({
          full_name: "Compte supprime",
          email: anonymizedEmail,
          phone: null,
          delivery_address: null,
          can_order_eggs: false,
        })
        .eq("id", user.id)],
      ["factures", () => adminClient
        .from("billing_documents")
        .update({ user_id: null })
        .eq("user_id", user.id)],
      ["messages", () => adminClient
        .from("contact_messages")
        .update({
          user_id: null,
          full_name: "Compte supprime",
          email: anonymizedEmail,
          phone: null,
        })
        .eq("user_id", user.id)],
      ["ventes ponctuelles", () => adminClient
        .from("occasional_sale_reservations")
        .update({
          user_id: null,
          client_name: "Compte supprime",
          client_email: anonymizedEmail,
          phone: null,
          client_address: null,
        })
        .eq("user_id", user.id)],
      ["demandes d'avis", () => adminClient
        .from("google_review_requests")
        .update({ user_id: null })
        .eq("user_id", user.id)],
    ] as const;

    for (const [label, operation] of criticalAnonymizations) {
      const { error } = await operation();
      if (error) {
        return jsonResponse({ error: `Anonymisation interrompue (${label}) : ${error.message}` }, 500);
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, true);

    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Erreur inconnue." }, 500);
  }
});
