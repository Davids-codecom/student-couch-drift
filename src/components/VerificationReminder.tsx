import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

const buildStorageKey = (userId: string) => `email-verification-warning:${userId}`;

const VerificationReminder = () => {
  const { session } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const user = session?.user ?? null;
    if (!user) {
      return;
    }

    const isVerified = Boolean(user.email_confirmed_at);
    const storageKey = buildStorageKey(user.id);

    if (isVerified) {
      sessionStorage.removeItem(storageKey);
      return;
    }

    if (sessionStorage.getItem(storageKey)) {
      return;
    }

    toast({
      title: "Verify your email",
      description: "Check your inbox for the verification link. New accounts must be confirmed within 24 hours or they will be removed.",
      variant: "default",
    });
    sessionStorage.setItem(storageKey, new Date().toISOString());
  }, [session, toast]);

  return null;
};

export default VerificationReminder;
