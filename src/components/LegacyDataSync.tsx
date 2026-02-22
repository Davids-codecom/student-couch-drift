import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import {
  syncLegacyDataForRenter,
  syncLegacyListingsForHost,
  verifySupabaseTables,
} from "@/lib/legacySync";

const LegacyDataSync = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const lastProfileId = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!profile?.id) {
      lastProfileId.current = null;
      return;
    }

    if (lastProfileId.current === profile.id) {
      return;
    }

    lastProfileId.current = profile.id;

    let active = true;

    const run = async () => {
      try {
        const verification = await verifySupabaseTables();
        if (!verification.ok) {
          if (!active) return;
          toast({
            title: "Supabase setup required",
            description: verification.issues
              .map((issue) => `${issue.table}: ${issue.error}`)
              .join("\n"),
            variant: "destructive",
          });
          console.warn("Supabase table verification issues", verification.issues);
          return;
        }

        const renterResult = await syncLegacyDataForRenter({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
        });

        if (!active) return;

        if (renterResult.bookings || renterResult.messages) {
          const pieces = [] as string[];
          if (renterResult.bookings) {
            pieces.push(
              `${renterResult.bookings} booking request${renterResult.bookings === 1 ? "" : "s"}`,
            );
          }
          if (renterResult.messages) {
            pieces.push(`${renterResult.messages} message${renterResult.messages === 1 ? "" : "s"}`);
          }

          toast({
            title: "Legacy requests synced",
            description: `Moved ${pieces.join(" and ")} into Supabase.`,
          });
        }

        const hostResult = await syncLegacyListingsForHost({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
        });

        if (!active) return;

        if (hostResult.listings) {
          toast({
            title: "Legacy listing published",
            description: `Moved ${hostResult.listings} offline listing${hostResult.listings === 1 ? "" : "s"} into Supabase.`,
          });
        }
      } catch (error) {
        if (!active) return;
        console.error("Legacy data sync failed", error);
        toast({
          title: "Legacy sync failed",
          description: "We couldn't move your past data into Supabase. Please retry later.",
          variant: "destructive",
        });
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [profile?.id, profile?.full_name, profile?.email, profile?.user_role, toast]);

  return null;
};

export default LegacyDataSync;
