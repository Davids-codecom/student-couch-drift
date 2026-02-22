import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - DAY_MS);
  const deleted: Array<{ id: string; email: string | null }> = [];
  let page = 1;

  try {
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (error) {
        throw error;
      }

      for (const user of data.users) {
        const createdAt = new Date(user.created_at);
        const needsCleanup = !user.email_confirmed_at && createdAt < cutoff;
        if (!needsCleanup) {
          continue;
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error("Failed to delete unverified user", user.id, deleteError);
          continue;
        }
        deleted.push({ id: user.id, email: user.email ?? null });
      }

      if (data.users.length < PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    return new Response(
      JSON.stringify({
        deleted,
        cutoff: cutoff.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("cleanup-unverified-users failed", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
