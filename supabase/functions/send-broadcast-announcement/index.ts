import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  task: (item: T) => Promise<R>
) {
  const results: PromiseSettledResult<R>[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.allSettled(batch.map((item) => task(item)))));

    if (index + batchSize < items.length) {
      await wait(delayMs);
    }
  }

  return results;
}

async function sendEmailWithRetry(resendApiKey: string, payload: Record<string, unknown>) {
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return response.json();
    }

    lastError = await response.text();

    if (![408, 429, 500, 502, 503, 504].includes(response.status)) {
      break;
    }

    await wait(900 * (attempt + 1));
  }

  throw new Error(lastError || "Email refuse par le service d'envoi.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuration Supabase incomplete." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const sendPush = body.sendPush !== false;
    const sendEmail = body.sendEmail !== false;

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "Titre ou message manquant." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sendPush && !sendEmail) {
      return new Response(JSON.stringify({ error: "Aucun canal choisi." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      push: { total: 0, sent: 0, failed: 0, expired: 0 },
      email: { total: 0, sent: 0, failed: 0 },
    };

    if (sendPush) {
      if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
        throw new Error("Configuration push incomplete.");
      }

      const { data: subscriptions, error } = await adminClient
        .from("client_push_subscriptions")
        .select("id, endpoint, p256dh, auth");

      if (error) {
        throw error;
      }

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

      const payload = JSON.stringify({
        title,
        body: message,
        url: "/",
      });
      const pushSubscriptions = subscriptions || [];
      const pushResults = await runInBatches(pushSubscriptions, 20, 250, (subscription) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        )
      );

      const expiredIds = pushResults
        .map((pushResult, index) => ({ pushResult, subscription: pushSubscriptions[index] }))
        .filter(({ pushResult }) =>
          pushResult.status === "rejected" && [404, 410].includes(pushResult.reason?.statusCode)
        )
        .map(({ subscription }) => subscription?.id)
        .filter(Boolean);

      if (expiredIds.length > 0) {
        await adminClient.from("client_push_subscriptions").delete().in("id", expiredIds);
      }

      result.push = {
        total: pushSubscriptions.length,
        sent: pushResults.filter((pushResult) => pushResult.status === "fulfilled").length,
        failed: pushResults.filter((pushResult) => pushResult.status === "rejected").length,
        expired: expiredIds.length,
      };
    }

    if (sendEmail) {
      if (!resendApiKey) {
        throw new Error("Configuration email incomplete.");
      }

      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("email, full_name, is_admin")
        .neq("is_admin", true)
        .not("email", "is", null);

      if (error) {
        throw error;
      }

      const recipients = Array.from(
        new Map((profiles || []).map((item) => [String(item.email || "").toLowerCase(), item])).values()
      ).filter((item) => item.email);

      const emailResults = await runInBatches(recipients, 2, 1200, (recipient) =>
        sendEmailWithRetry(resendApiKey, {
          from: "Les Poulettes du Marais <commandes@lespoulettesdumarais.fr>",
          to: recipient.email,
          subject: title,
          text: `Bonjour ${recipient.full_name || "a vous"},\n\n${message}\n\nLes Poulettes du Marais`,
          html: `
            <h1>${escapeHtml(title)}</h1>
            <p>Bonjour ${escapeHtml(recipient.full_name || "a vous")},</p>
            <p>${escapeHtml(message)}</p>
            <p>Les Poulettes du Marais</p>
          `,
        })
      );

      result.email = {
        total: recipients.length,
        sent: emailResults.filter((emailResult) => emailResult.status === "fulfilled").length,
        failed: emailResults.filter((emailResult) => emailResult.status === "rejected").length,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
