import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuration email incomplete." }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });
    const { data: userData } = await authClient.auth.getUser();

    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Non autorise." }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();

    if (profileError || profile?.is_admin !== true) {
      return new Response(JSON.stringify({ error: "Acces admin requis." }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const body = await req.json();
    const { clientEmail, clientName } = body;

    if (!clientEmail || !clientName) {
      return new Response(JSON.stringify({ error: "Client incomplet." }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>",
        to: clientEmail,
        subject: "Votre commande est prête 🥚",
        html: `
          <h1>Bonjour ${clientName}</h1>
          <p>Votre commande d'œufs est maintenant prête 🥚</p>
          <p>Merci pour votre confiance !</p>
        `,
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
