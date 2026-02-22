import { supabase } from "@/lib/supabaseClient";

export interface CreateBookingRequestInput {
  couchId: string;
  couchTitle: string;
  hostId: string | null | undefined;
  hostName: string;
  hostEmail?: string | null | undefined;
  renterId: string | null | undefined;
  renterName: string;
  stayStart: string;
  stayEnd: string;
  nights: number;
  pricePerNight: string;
  status?: BookingRequestStatus;
  createdAt?: string;
}

export type BookingRequestStatus = "pending" | "approved" | "declined" | "cancelled";
export type BookingPayoutStatus = "pending" | "queued" | "paid" | "blocked";

const APPROVAL_HOLD_HOURS = 8;

export type BookingPaymentStatus = "pending" | "paid" | "failed" | "expired";

export interface BookingRequestRecord {
  id: string;
  couchId: string | null;
  couchTitle: string | null;
  hostId: string | null;
  hostName: string | null;
  renterId: string | null;
  renterName: string | null;
  stayStart: string;
  stayEnd: string;
  nights: number | null;
  pricePerNight: string | null;
  status: BookingRequestStatus;
  createdAt: string;
  paymentStatus: BookingPaymentStatus | null;
  paymentDueAt: string | null;
  paymentIntentId: string | null;
  paymentClientSecret: string | null;
  hasCheckInPhoto: boolean;
  payoutStatus: BookingPayoutStatus | null;
  payoutReleasedAt: string | null;
}

export type BookingRequestRow = {
  id: string;
  couch_id: string | null;
  couch_title: string | null;
  host_id: string | null;
  host_name: string | null;
  renter_id: string | null;
  renter_name: string | null;
  stay_start: string;
  stay_end: string;
  nights: number | null;
  price_per_night: string | null;
  status: BookingRequestStatus | null;
  created_at: string;
  payment_status: BookingPaymentStatus | null;
  payment_due_at: string | null;
  payment_intent_id: string | null;
  payment_client_secret: string | null;
  has_checkin_photo: boolean | null;
  payout_status: BookingPayoutStatus | null;
  payout_released_at: string | null;
};

export const mapRowToBookingRequest = (row: BookingRequestRow): BookingRequestRecord => ({
  id: row.id,
  couchId: row.couch_id,
  couchTitle: row.couch_title,
  hostId: row.host_id,
  hostName: row.host_name,
  renterId: row.renter_id,
  renterName: row.renter_name,
  stayStart: row.stay_start,
  stayEnd: row.stay_end,
  nights: row.nights,
  pricePerNight: row.price_per_night,
  status: row.status ?? "pending",
  createdAt: row.created_at,
  paymentStatus: row.payment_status,
  paymentDueAt: row.payment_due_at,
  paymentIntentId: row.payment_intent_id,
  paymentClientSecret: row.payment_client_secret,
  hasCheckInPhoto: Boolean(row.has_checkin_photo),
  payoutStatus: row.payout_status,
  payoutReleasedAt: row.payout_released_at,
});

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

const DAY_MS = 24 * 60 * 60 * 1000;

const toLocalMidnight = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const normalizeEndExclusive = (value: string, fallbackStart: number) => {
  const end = toLocalMidnight(value);
  return end > fallbackStart ? end : fallbackStart + DAY_MS;
};

export const createBookingRequest = async (input: CreateBookingRequestInput): Promise<BookingRequestRecord> => {
  const payload: Partial<BookingRequestRow> & {
    couch_id: string | null;
    couch_title: string | null;
    host_id: string | null;
    host_name: string | null;
    renter_id: string | null;
    renter_name: string | null;
    stay_start: string;
    stay_end: string;
    nights: number | null;
    price_per_night: string | null;
    status: BookingRequestStatus;
  } = {
    couch_id: input.couchId,
    couch_title: input.couchTitle,
    host_id: toUuidOrNull(input.hostId),
    host_name: input.hostEmail ?? input.hostName,
    renter_id: toUuidOrNull(input.renterId),
    renter_name: input.renterName,
    stay_start: input.stayStart,
    stay_end: input.stayEnd,
    nights: input.nights,
    price_per_night: input.pricePerNight,
    status: input.status ?? "pending",
  };

  if (input.createdAt) {
    payload.created_at = input.createdAt;
  }

  const { data, error } = await supabase
    .from<BookingRequestRow>("booking_requests")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRowToBookingRequest(data);
};

export const getBookingRequestsForRenter = async (
  renterId: string | null,
  renterIdentifiers?: string[],
): Promise<BookingRequestRecord[]> => {
  const sanitizedRenterId = toUuidOrNull(renterId);
  const sanitizedIdentifiers = sanitizeIdentifiers(renterIdentifiers);

  if (!sanitizedRenterId && !sanitizedIdentifiers.length) {
    return [];
  }

  let query = supabase
    .from<BookingRequestRow>("booking_requests")
    .select("*")
    .order("created_at", { ascending: false });

  const filters: string[] = [];
  if (sanitizedRenterId) {
    filters.push(`renter_id.eq.${sanitizedRenterId}`);
  }
  sanitizedIdentifiers.forEach((identifier) => {
    filters.push(`renter_name.ilike.%${escapeForIlike(identifier)}%`);
  });

  if (filters.length === 1 && filters[0].startsWith("renter_id.eq.")) {
    query = query.eq("renter_id", sanitizedRenterId!);
  } else if (filters.length > 0) {
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRowToBookingRequest);
};

export const getBookingRequestsForHost = async (
  hostId: string | null,
  hostIdentifiers?: string[],
  couchIds?: string[],
): Promise<BookingRequestRecord[]> => {
  const sanitizedHostId = toUuidOrNull(hostId);
  const sanitizedIdentifiers = sanitizeIdentifiers(hostIdentifiers);
  const sanitizedCouchIds = sanitizeIdList(couchIds);

  if (!sanitizedHostId && !sanitizedIdentifiers.length && !sanitizedCouchIds.length) {
    return [];
  }

  let query = supabase
    .from<BookingRequestRow>("booking_requests")
    .select("*")
    .order("created_at", { ascending: false });

  const filters: string[] = [];

  if (sanitizedHostId) {
    filters.push(`host_id.eq.${sanitizedHostId}`);
  }

  sanitizedIdentifiers.forEach((identifier) => {
    filters.push(`host_name.ilike.%${escapeForIlike(identifier)}%`);
  });

  sanitizedCouchIds.forEach((id) => {
    filters.push(`couch_id.eq.${escapeForIlike(id)}`);
  });

  if (filters.length === 1 && filters[0].startsWith("host_id.eq.")) {
    query = query.eq("host_id", sanitizedHostId!);
  } else if (filters.length > 0) {
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRowToBookingRequest);
};

export const updateBookingRequestStatus = async (
  id: string,
  status: BookingRequestStatus,
): Promise<BookingRequestRecord> => {
  const { data: existing, error: fetchError } = await supabase
    .from<BookingRequestRow>("booking_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (!existing) {
    throw new Error("Booking request not found.");
  }

  if (
    status === "approved"
    && existing.couch_id
    && existing.stay_start
    && existing.stay_end
  ) {
    const { data: conflicts, error: conflictError } = await supabase
      .from<BookingRequestRow>("booking_requests")
      .select("id, stay_start, stay_end")
      .eq("couch_id", existing.couch_id)
      .eq("status", "approved")
      .neq("id", id);

    if (conflictError) {
      throw conflictError;
    }

    const start = toLocalMidnight(existing.stay_start);
    const end = normalizeEndExclusive(existing.stay_end, start);

    const overlaps = (conflicts ?? []).some((conflict) => {
      const conflictStart = toLocalMidnight(conflict.stay_start);
      const conflictEnd = normalizeEndExclusive(conflict.stay_end, conflictStart);
      return start < conflictEnd && end > conflictStart;
    });

    if (overlaps) {
      throw new Error("Another booking has already been approved for this listing during the selected dates.");
    }
  }

  const updates: Partial<BookingRequestRow> = { status };
  if (status === "approved") {
    const holdUntil = new Date(Date.now() + APPROVAL_HOLD_HOURS * 60 * 60 * 1000).toISOString();
    updates.payment_status = "pending";
    updates.payment_due_at = holdUntil;
  } else if (existing.payment_status !== "paid") {
    updates.payment_status = null;
    updates.payment_due_at = null;
  }

  const { data, error } = await supabase
    .from<BookingRequestRow>("booking_requests")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRowToBookingRequest(data);
};

export const cancelBookingRequestAsRenter = async (
  id: string,
  renterId: string | null,
): Promise<BookingRequestRecord> => {
  const safeRenterId = toUuidOrNull(renterId);
  if (!safeRenterId) {
    throw new Error("Sign in to cancel your booking request.");
  }

  const { data, error } = await supabase.functions.invoke<{ booking?: BookingRequestRow }>("cancel-booking", {
    body: { requestId: id },
  });

  if (error) {
    throw error;
  }

  if (!data?.booking) {
    throw new Error("Unable to cancel booking request.");
  }

  return mapRowToBookingRequest(data.booking);
};
