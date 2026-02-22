import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ownerBypassEmail = (Deno.env.get("OWNER_BYPASS_EMAIL") ?? "davids.akis@unil.ch").trim().toLowerCase();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OwnerSignupAction = "confirm";

interface OwnerSignupBody {
  action?: OwnerSignupAction;
  email?: string;
  userId?: string;
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isOwnerAllowed = (email: string) => {
  if (!ownerBypassEmail) {
    return { ok: false, error: "Owner signup is not configured." };
  }

  if (email !== ownerBypassEmail) {
    return { ok: false, error: "Email is not allowed for owner signup." };
  }

  return { ok: true };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing Supabase configuration." }, 500);
  }

  let body: OwnerSignupBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON payload." }, 400);
  }

  const action = body.action;
  const email = (body.email ?? "").trim().toLowerCase();

  if (!action || !email) {
    return json({ ok: false, error: "action and email are required." }, 400);
  }

  const ownerCheck = isOwnerAllowed(email);
  if (!ownerCheck.ok) {
    return json({ ok: false, error: ownerCheck.error }, 403);
  }

  if (action !== "confirm") {
    return json({ ok: false, error: "Unsupported action." }, 400);
  }

  const userId = (body.userId ?? "").trim();
  if (!userId) {
    return json({ ok: false, error: "userId is required for confirm action." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError) {
    return json({ ok: false, error: userError.message }, 400);
  }

  const existingEmail = (userData.user?.email ?? "").trim().toLowerCase();
  if (existingEmail !== email) {
    return json({ ok: false, error: "User email does not match requested owner email." }, 409);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
    app_metadata: {
      ...(userData.user?.app_metadata ?? {}),
      is_owner: true,
    },
  });

  if (updateError) {
    return json({ ok: false, error: updateError.message }, 400);
  }

  return json({ ok: true });
});
