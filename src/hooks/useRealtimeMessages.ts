import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { MessageRecord, MessageRow } from "@/lib/messages";
import { mapRowToMessage } from "@/lib/messages";

interface UseRealtimeMessagesOptions {
  queryKey: unknown[];
  matcher: (message: MessageRecord) => boolean;
}

const useRealtimeMessages = ({ queryKey, matcher }: UseRealtimeMessagesOptions) => {
  const queryClient = useQueryClient();
  const keyString = JSON.stringify(queryKey);

  useEffect(() => {
    const channelName = `messages-${keyString}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);

    const handler = (payload: { new: MessageRow | null }) => {
      const row = payload.new;
      if (!row) return;
      const message = mapRowToMessage(row);
      if (matcher(message)) {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        handler,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        handler,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keyString, matcher, queryClient, queryKey]);
};

export default useRealtimeMessages;
