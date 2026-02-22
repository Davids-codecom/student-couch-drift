import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL
  ?? (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined);
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

if (!url || !anon) {
  throw new Error("Supabase env vars are missing. Set VITE_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and VITE_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

export const publicSupabase = createClient(url, anon, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
