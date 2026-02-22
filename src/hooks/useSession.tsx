import { useContext } from "react";
import { SessionContext, type SessionContextValue } from "@/hooks/session-context";

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

export type { SessionContextValue };
