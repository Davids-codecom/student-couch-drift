import { supabase } from "@/lib/supabaseClient";

export interface DirectMessageRecord {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export interface DirectMessageThread {
  otherUserId: string;
  lastMessage: DirectMessageRecord;
}

export const fetchDirectMessages = async (
  currentUserId: string,
  otherUserId: string,
): Promise<DirectMessageRecord[]> => {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, receiver_id, content, created_at")
    .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const sendDirectMessage = async (
  senderId: string,
  receiverId: string,
  content: string,
): Promise<DirectMessageRecord | null> => {
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data ?? null;
};

export const fetchThreadsForUser = async (userId: string): Promise<DirectMessageThread[]> => {
  const { data, error } = await supabase
    .from<DirectMessageRecord>("direct_messages")
    .select("id, sender_id, receiver_id, content, created_at")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  const map = new Map<string, DirectMessageRecord>();

  (data ?? []).forEach((message) => {
    const otherId = message.sender_id === userId ? message.receiver_id : message.sender_id;
    if (!map.has(otherId)) {
      map.set(otherId, message);
    }
  });

  return Array.from(map.entries()).map(([otherUserId, lastMessage]) => ({
    otherUserId,
    lastMessage,
  }));
};
