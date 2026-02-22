import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parsePrice = (value: string | null) => {
  if (!value) return null;
  const sanitized = value.replace(/[^0-9.,-]+/g, "");
  if (!sanitized) return null;
  const normalized = sanitized.replace(/,/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

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

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2024-06-20" }) : null;

  try {
    const cutoff = new Date(Date.now() - DAY_MS).toISOString();

    const { data: bookings, error } = await supabase
      .from("booking_requests")
      .select("id, host_id, stay_end, price_per_night, nights, payout_status, payment_status, status")
      .eq("status", "approved")
      .eq("payment_status", "paid")
      .eq("has_checkin_photo", true)
      .or("payout_status.eq.pending,payout_status.is.null")
      .lte("stay_end", cutoff);

    if (error) {
      throw error;
    }

    const summary = {
      processed: 0,
      skippedMissingProfile: 0,
      skippedMissingPayout: 0,
    };

    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ processed: summary }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const booking of bookings) {
      if (!booking.host_id) {
        summary.skippedMissingProfile += 1;
        continue;
      }

      const { data: hostProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("payout_account_holder, payout_account_number, payout_bank_name, payout_bank_country")
        .eq("id", booking.host_id)
        .maybeSingle();

      if (profileError) {
        console.error("host profile load failed", profileError);
        summary.skippedMissingProfile += 1;
        continue;
      }

      const hasPayoutInfo = Boolean(
        hostProfile?.payout_account_holder
          && hostProfile?.payout_account_number
          && hostProfile?.payout_bank_name
          && hostProfile?.payout_bank_country,
      );

      if (!hasPayoutInfo) {
        await supabase
          .from("booking_requests")
          .update({ payout_status: "blocked" })
          .eq("id", booking.id);
        summary.skippedMissingPayout += 1;
        continue;
      }

      const nightly = parsePrice(booking.price_per_night ?? null);
      const nights = booking.nights ? Number(booking.nights) : 1;
      const cents = nightly ? Math.max(1, Math.round(nightly * nights * 100)) : 0;

      if (stripe && cents > 0) {
        console.log(
          `Simulating payout for booking ${booking.id} amount ${cents} cents to host ${booking.host_id}. Stripe transfer would be initiated here.`,
        );
      }

      await supabase
        .from("booking_requests")
        .update({ payout_status: "paid", payout_released_at: new Date().toISOString() })
        .eq("id", booking.id);

      summary.processed += 1;
    }

    return new Response(JSON.stringify({ processed: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-host-payouts error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
