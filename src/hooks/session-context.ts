import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface SessionContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | undefined>(undefined);
