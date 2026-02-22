import { supabase } from "@/lib/supabaseClient";

export interface CreateMessageInput {
  couchId: string;
  hostId: string | null | undefined;
  hostName: string;
  hostEmail?: string | null | undefined;
  renterId: string | null | undefined;
  renterName: string;
  renterEmail?: string | null | undefined;
  body: string;
  sentAt?: string;
  senderRole?: "renter" | "host";
  senderId?: string | null | undefined;
  senderName?: string | null | undefined;
}

export interface MessageRecord {
  id: string;
  couchId: string | null;
  hostId: string | null;
  hostName: string | null;
  hostEmail: string | null;
  renterId: string | null;
  renterName: string | null;
  renterEmail: string | null;
  text: string;
  rawBody: string;
  senderRole: "renter" | "host";
  senderName: string | null;
  senderId: string | null;
  sentAt: string;
}

export type MessageRow = {
  id: string;
  couch_id: string | null;
  host_id: string | null;
  host_name: string | null;
  renter_id: string | null;
  renter_name: string | null;
  body: string;
  sent_at: string;
  created_at?: string;
};

const parseMessageBody = (
  rawBody: string | null | undefined,
  defaults: { hostName?: string | null; renterName?: string | null },
) => {
  const fallback = {
    text: rawBody ?? "",
    senderRole: "renter" as const,
    senderName: defaults.renterName ?? defaults.hostName ?? null,
    senderId: null,
    hostName: defaults.hostName ?? null,
    hostEmail: null,
    renterName: defaults.renterName ?? null,
    renterEmail: null,
  };

  if (!rawBody) {
    return { ...fallback, rawBody: "" };
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...fallback, rawBody };
    }

    const text = typeof parsed.text === "string" ? parsed.text : fallback.text;
    const senderRole = parsed.senderRole === "host" ? "host" : "renter";
    const senderName = typeof parsed.senderName === "string"
      ? parsed.senderName
      : fallback.senderName;
    const senderId = typeof parsed.senderId === "string" ? parsed.senderId : null;
    const hostName = typeof parsed.hostName === "string" ? parsed.hostName : fallback.hostName;
    const hostEmail = typeof parsed.hostEmail === "string" ? parsed.hostEmail : null;
    const renterName = typeof parsed.renterName === "string" ? parsed.renterName : fallback.renterName;
    const renterEmail = typeof parsed.renterEmail === "string" ? parsed.renterEmail : null;

    return {
      text,
      senderRole,
      senderName,
      senderId,
      hostName,
      hostEmail,
      renterName,
      renterEmail,
      rawBody,
    };
  } catch (_error) {
    return { ...fallback, rawBody };
  }
};

export const mapRowToMessage = (row: MessageRow): MessageRecord => {
  const parsed = parseMessageBody(row.body, {
    hostName: row.host_name,
    renterName: row.renter_name,
  });

  return {
    id: row.id,
    couchId: row.couch_id,
    hostId: row.host_id,
    hostName: parsed.hostName,
    hostEmail: parsed.hostEmail,
    renterId: row.renter_id,
    renterName: parsed.renterName,
    renterEmail: parsed.renterEmail,
    text: parsed.text,
    rawBody: parsed.rawBody ?? row.body ?? "",
    senderRole: parsed.senderRole,
    senderName: parsed.senderName,
    senderId: parsed.senderId,
    sentAt: row.sent_at ?? row.created_at ?? new Date().toISOString(),
  };
};

const toUuidOrNull = (value: string | null | undefined) => {
  if (!value) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : null;
};

const sanitizeIdentifiers = (identifiers?: string[]) => {
  if (!identifiers) return [] as string[];
  const seen = new Set<string>();
  identifiers.forEach((identifier) => {
    if (!identifier) return;
    const trimmed = identifier.trim();
    if (!trimmed) return;
    seen.add(trimmed);
  });
  return Array.from(seen);
};

const escapeForIlike = (value: string) =>
  value.replace(/[%_]/g, (match) => `\\${match}`).replace(/,/g, "\\,");

const sanitizeIdList = (ids?: string[]) => {
  if (!ids) return [] as string[];
  const seen = new Set<string>();
  ids.forEach((id) => {
    if (!id) return;
    const trimmed = id.trim();
    if (!trimmed) return;
    seen.add(trimmed);
  });
  return Array.from(seen);
};

export const createMessage = async (input: CreateMessageInput): Promise<MessageRecord> => {
  const senderRole = input.senderRole ?? "renter";
  const senderName = input.senderName
    ?? (senderRole === "host" ? input.hostEmail ?? input.hostName : input.renterName);
  const senderId = toUuidOrNull(input.senderId);

  const messagePayload = {
    version: 1,
    text: input.body,
    senderRole,
    senderName,
    senderId,
    hostName: input.hostEmail ?? input.hostName,
    hostEmail: input.hostEmail ?? null,
    renterName: input.renterName,
    renterEmail: input.renterEmail ?? (input.renterName?.includes("@") ? input.renterName : null),
  };

  const payload = {
    couch_id: input.couchId,
    host_id: toUuidOrNull(input.hostId),
    host_name: input.hostEmail ?? input.hostName,
    renter_id: toUuidOrNull(input.renterId),
    renter_name: input.renterName,
    body: JSON.stringify(messagePayload),
    sent_at: input.sentAt ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from<MessageRow>("messages")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapRowToMessage(data);
};

export const getMessagesForRenter = async (
  renterId: string | null,
  renterIdentifiers?: string[],
): Promise<MessageRecord[]> => {
  const sanitizedRenterId = toUuidOrNull(renterId);
  const sanitizedIdentifiers = sanitizeIdentifiers(renterIdentifiers);

  const orFilters: string[] = [];

  if (sanitizedRenterId) {
    orFilters.push(`renter_id.eq.${sanitizedRenterId}`);
  }

  sanitizedIdentifiers.forEach((identifier) => {
    orFilters.push(`renter_name.ilike.%${escapeForIlike(identifier)}%`);
  });

  if (orFilters.length === 0) {
    return [];
  }

  let query = supabase
    .from<MessageRow>("messages")
    .select("*")
    .order("sent_at", { ascending: true });

  if (orFilters.length === 1 && orFilters[0].startsWith("renter_id.eq.")) {
    query = query.eq("renter_id", sanitizedRenterId!);
  } else {
    query = query.or(orFilters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRowToMessage);
};

export const getMessagesForHost = async (
  hostId: string | null,
  hostIdentifiers?: string[],
  couchIds?: string[],
): Promise<MessageRecord[]> => {
  const sanitizedHostId = toUuidOrNull(hostId);
  const sanitizedIdentifiers = sanitizeIdentifiers(hostIdentifiers);
  const sanitizedCouchIds = sanitizeIdList(couchIds);

  let query = supabase
    .from<MessageRow>("messages")
    .select("*")
    .order("sent_at", { ascending: true });

  const orFilters: string[] = [];

  if (sanitizedHostId) {
    orFilters.push(`host_id.eq.${sanitizedHostId}`);
  }

  sanitizedIdentifiers.forEach((identifier) => {
    orFilters.push(`host_name.ilike.%${escapeForIlike(identifier)}%`);
  });

  sanitizedCouchIds.forEach((id) => {
    orFilters.push(`couch_id.eq.${escapeForIlike(id)}`);
  });

  if (orFilters.length === 1 && orFilters[0].startsWith("host_id.eq.")) {
    query = query.eq("host_id", sanitizedHostId!);
  } else if (orFilters.length > 0) {
    query = query.or(orFilters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRowToMessage);
};
