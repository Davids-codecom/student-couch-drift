import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { fetchUserProfile, upsertUserProfile, type UserProfileRecord } from "@/lib/profile";
import { AuthContext, type AuthContextValue } from "@/hooks/auth-context";

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 15000, message = "Request timed out") => {
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfile = async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setUser(null);
      setAuthError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);
      const remote = await withTimeout(
        fetchUserProfile(nextSession.user.id),
        12000,
        "Timed out loading profile",
      );
      if (remote) {
        setUser(remote);
      } else {
        const inserted = await upsertUserProfile({
          id: nextSession.user.id,
          email: nextSession.user.email ?? "",
          full_name: nextSession.user.user_metadata?.full_name ?? null,
          user_role: nextSession.user.user_metadata?.user_role ?? "renter",
          avatar_url: null,
          bio: null,
          student_id_url: null,
          university: null,
          program_name: null,
          program_year: null,
          program_type: null,
        });
        setUser(inserted);
      }
    } catch (error) {
      console.error("Failed to load profile", error);
      setUser(null);
      setAuthError(error instanceof Error ? error.message : "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let mounted = true;

    const initialise = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          15000,
          "Timed out loading auth session",
        );
        if (!mounted) return;
        if (error) {
          throw error;
        }
        setSession(data.session ?? null);
        await loadProfile(data.session ?? null);

        const authListener = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (!mounted) {
            return;
          }
          setSession(newSession);
          loadProfile(newSession);
        });

        subscription = authListener.data?.subscription ?? null;
      } catch (error) {
        console.error("Failed to initialise auth session", error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setAuthError(error instanceof Error ? error.message : "Unable to connect to Supabase.");
          setLoading(false);
        }
      }
    };

    initialise();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setAuthError(null);
  };

  const refreshUser = async () => {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      15000,
      "Timed out refreshing auth session",
    );
    setSession(data.session ?? null);
    await loadProfile(data.session ?? null);
  };

  const value: AuthContextValue = {
    user,
    session,
    profile: user,
    loading,
    authError,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
