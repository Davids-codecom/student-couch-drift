import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL
  ?? (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined);
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

if (!url || !anon) {
  throw new Error("Supabase env vars are missing. Set VITE_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and VITE_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

const createPublicSupabase = (): SupabaseClient =>
  createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "couchshare.public",
    },
  });

type GlobalPublicSupabase = typeof globalThis & { __couchsharePublicSupabase?: SupabaseClient };
const globalScope = globalThis as GlobalPublicSupabase;

export const publicSupabase = globalScope.__couchsharePublicSupabase ?? createPublicSupabase();

if (typeof window !== "undefined") {
  globalScope.__couchsharePublicSupabase = publicSupabase;
}
