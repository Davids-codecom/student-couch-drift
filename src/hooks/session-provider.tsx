import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SessionContext, type SessionContextValue } from "@/hooks/session-context";
import type { Session } from "@supabase/supabase-js";

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 5000, message = "Request timed out") => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          6000,
          "Timed out loading session",
        );
        if (!isMounted) return;
        if (error) {
          throw error;
        }
        setSession(data.session ?? null);
      } catch (error) {
        console.error("Failed to load Supabase session", error);
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) {
        return;
      }
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signOut: () => supabase.auth.signOut(),
  }), [session, loading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
