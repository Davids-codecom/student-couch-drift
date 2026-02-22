import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { mapRowToBookingRequest, type BookingRequestRecord, type BookingRequestRow } from "@/lib/bookings";

interface UseRealtimeBookingsOptions {
  queryKey: unknown[];
  matcher: (request: BookingRequestRecord) => boolean;
}

const useRealtimeBookings = ({ queryKey, matcher }: UseRealtimeBookingsOptions) => {
  const queryClient = useQueryClient();
  const keyString = JSON.stringify(queryKey);

  useEffect(() => {
    const channelName = `booking-requests-${keyString}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);

    const handler = (payload: { new: BookingRequestRow | null }) => {
      if (!payload.new) return;
      const record = mapRowToBookingRequest(payload.new);
      if (matcher(record)) {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_requests" },
        handler,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "booking_requests" },
        handler,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keyString, matcher, queryClient, queryKey]);
};

export default useRealtimeBookings;
