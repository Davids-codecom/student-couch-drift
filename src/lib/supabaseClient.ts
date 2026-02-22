import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL
  ?? (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined);
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

if (!url || !anon) {
  throw new Error("Supabase env vars are missing. Set VITE_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and VITE_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

const resolveBrowserStorage = (): SupabaseClientOptions["auth"]["storage"] => {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    const storage = window.localStorage;
    const testKey = "__couchshare_storage_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch (error) {
    console.warn("Local storage unavailable; sessions won't persist", error);
    return undefined;
  }
};

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "couchshare.auth",
    storage: resolveBrowserStorage(),
  },
});
