import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { UserProfileRecord } from "@/lib/profile";

export interface AuthContextValue {
  user: UserProfileRecord | null;
  session: Session | null;
  profile: UserProfileRecord | null;
  loading: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
