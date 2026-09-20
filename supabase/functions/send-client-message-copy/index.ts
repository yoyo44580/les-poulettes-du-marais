import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function plainText(value: unknown) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
      throw new Error("Configuration email incomplete.");
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Non autorise." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profile?.is_admin !== true) {
      return new Response(JSON.stringify({ error: "Acces admin requis." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const replyId = String(body.replyId || "");
    if (!replyId) {
      return new Response(JSON.stringify({ error: "Message introuvable." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reply, error: replyError } = await adminClient
      .from("contact_message_replies")
      .select("id, contact_message_id, sender_role, sender_name, message, created_at")
      .eq("id", replyId)
      .maybeSingle();
    if (replyError) throw replyError;
    if (!reply || reply.sender_role !== "admin") {
      return new Response(JSON.stringify({ error: "Seules les reponses admin sont envoyees par email." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: message, error: messageError } = await adminClient
      .from("contact_messages")
      .select("id, full_name, email, subject")
      .eq("id", reply.contact_message_id)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message?.email) {
      return new Response(JSON.stringify({ error: "Aucun email client renseigne." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientName = String(message.full_name || "").trim();
    const subject = String(message.subject || "votre demande").trim();
    const replyMessage = plainText(reply.message);
    const greeting = clientName ? `Bonjour ${clientName},` : "Bonjour,";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: message.email,
        subject: `Message des Poulettes du Marais - ${subject}`,
        text: `${greeting}\n\nVous avez reçu un nouveau message depuis l'application Les Poulettes du Marais :\n\n${replyMessage}\n\nVous pouvez aussi retrouver l'historique dans votre espace client : ${APP_URL}\n\nÀ bientôt,\nLes Poulettes du Marais`,
        html: `<div style="font-family:Arial,sans-serif;color:#24352a;line-height:1.6;max-width:640px;margin:auto">
          <div style="border-top:7px solid #315c3d;background:#fffdf8;padding:28px">
            <p>${escapeHtml(greeting)}</p>
            <h1 style="color:#315c3d;font-size:24px;line-height:1.25">Nouveau message des Poulettes du Marais</h1>
            <p>Vous avez reçu un message au sujet de <strong>${escapeHtml(subject)}</strong>.</p>
            <div style="background:#f4efe3;border:1px solid #ded2bd;border-radius:8px;padding:16px;margin:20px 0;white-space:pre-wrap">${escapeHtml(replyMessage)}</div>
            <p style="margin:26px 0"><a href="${APP_URL}" style="display:inline-block;background:#315c3d;color:#fff;text-decoration:none;padding:13px 18px;border-radius:6px;font-weight:bold">Voir dans mon espace client</a></p>
            <p>À bientôt,<br><strong>Les Poulettes du Marais</strong></p>
          </div>
        </div>`,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || "Email non envoye.");

    await adminClient.from("admin_action_logs").insert({
      action_type: "contact_reply_email_copy",
      title: "Copie email envoyee au client",
      target_type: "Message",
      target_id: message.id,
      target_label: message.full_name || message.email || "Client",
      details: { reply_id: reply.id, subject, email: message.email },
      created_by: userData.user.id,
      created_by_email: userData.user.email || "",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
