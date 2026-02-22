import { differenceInCalendarDays } from "date-fns";
import {
  createBookingRequest,
  getBookingRequestsForRenter,
  type BookingRequestRecord,
  type BookingRequestStatus,
} from "@/lib/bookings";
import { createMessage, getMessagesForRenter, type MessageRecord } from "@/lib/messages";
import { supabase } from "@/lib/supabaseClient";
import { upsertListing, type CreateListingInput } from "@/lib/listings";

interface RenterProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

type HostProfile = RenterProfile;

interface TableIssue {
  table: string;
  error: string;
}

interface LegacyBookingRequest {
  renterId?: string;
  stayStart?: string;
  start?: string;
  checkIn?: string;
  stayEnd?: string;
  end?: string;
  checkOut?: string;
  checkout?: string;
  couchId?: string;
  couchTitle?: string;
  title?: string;
  hostId?: string;
  hostEmail?: string;
  hostName?: string;
  renterName?: string;
  pricePerNight?: string | number;
  price?: string | number;
  status?: BookingRequestStatus;
  createdAt?: string;
  created_at?: string;
  submittedAt?: string;
}

interface LegacyMessageRecord {
  renterId?: string;
  couchId?: string;
  hostId?: string;
  hostEmail?: string;
  hostName?: string;
  renterName?: string;
  text?: string;
  body?: string;
  sentAt?: string;
  sent_at?: string;
  created_at?: string;
  senderRole?: string;
  senderId?: string;
  senderName?: string;
}

interface LegacyListingRecord {
  listingId?: string;
  propertyType?: string;
  title?: string;
  address?: string;
  country?: string | null;
  city?: string | null;
  uploadedAt?: string;
  checkInTime?: string;
  availability?: {
    start?: string | null;
    end?: string | null;
    checkInTime?: string | null;
  } | null;
  imageUrl?: string | null;
  pricePerNight?: string | number | null;
  price?: string | number | null;
  location?: string | null;
  description?: string | null;
  userId?: string;
}

const LEGACY_BOOKING_KEY = "booking_requests";
const LEGACY_MESSAGE_PREFIX = "messages_";
const SYNC_VERSION = "legacy-sync-v1";
const LEGACY_LISTING_PREFIX = "listing_";
const LISTING_SYNC_VERSION = "legacy-listings-v1";

export const verifySupabaseTables = async (): Promise<{ ok: boolean; issues: TableIssue[] }> => {
  const tables: Array<"booking_requests" | "messages" | "user_listings"> = [
    "booking_requests",
    "messages",
    "user_listings",
  ];
  const issues: TableIssue[] = [];

  await Promise.all(
    tables.map(async (table) => {
      const { error } = await supabase
        .from(table)
        .select("id")
        .limit(1);
      if (error) {
        issues.push({ table, error: error.message ?? "Unknown error" });
      }
    }),
  );

  return { ok: issues.length === 0, issues };
};

const wasSynced = (profileId: string) => {
  return localStorage.getItem(`${SYNC_VERSION}-${profileId}`) === "complete";
};

const markSynced = (profileId: string) => {
  localStorage.setItem(`${SYNC_VERSION}-${profileId}`, "complete");
};

const wasListingsSynced = (profileId: string) => {
  return localStorage.getItem(`${LISTING_SYNC_VERSION}-${profileId}`) === "complete";
};

const markListingsSynced = (profileId: string) => {
  localStorage.setItem(`${LISTING_SYNC_VERSION}-${profileId}`, "complete");
};

const ensureDateString = (value: string | null | undefined) => {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const getExistingBookingFingerprints = (records: BookingRequestRecord[]) => {
  return new Set(records.map((record) => `${record.couchId ?? ""}|${record.stayStart}|${record.stayEnd}|${record.status}`));
};

const getExistingMessageFingerprints = (records: MessageRecord[]) => {
  return new Set(records.map((record) => `${record.hostId ?? ""}|${record.sentAt}|${record.text}`));
};

const migrateLegacyBookings = async (profile: RenterProfile): Promise<number> => {
  const raw = localStorage.getItem(LEGACY_BOOKING_KEY);
  if (!raw) return 0;

  let parsed: LegacyBookingRequest[] = [];
  try {
    const candidate = JSON.parse(raw) as unknown;
    parsed = Array.isArray(candidate) ? (candidate as LegacyBookingRequest[]) : [];
  } catch (error) {
    console.error("Failed to parse legacy booking requests", error);
    localStorage.removeItem(LEGACY_BOOKING_KEY);
    return 0;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    localStorage.removeItem(LEGACY_BOOKING_KEY);
    return 0;
  }

  let existing: BookingRequestRecord[] = [];
  try {
    existing = await getBookingRequestsForRenter(profile.id, [profile.full_name ?? undefined, profile.email ?? undefined]);
  } catch (error) {
    console.warn("Unable to load existing booking requests from Supabase", error);
    existing = [];
  }
  const fingerprints = getExistingBookingFingerprints(existing);

  let migrated = 0;
  const remaining: LegacyBookingRequest[] = [];

  for (const request of parsed) {
    if (request?.renterId && request.renterId !== profile.id) {
      continue;
    }

    const stayStart = ensureDateString(request?.stayStart ?? request?.start ?? request?.checkIn);
    const stayEnd = ensureDateString(request?.stayEnd ?? request?.end ?? request?.checkOut ?? request?.checkout);
    const fingerprint = `${request?.couchId ?? ""}|${stayStart}|${stayEnd}|${request?.status ?? "pending"}`;
    if (fingerprints.has(fingerprint)) {
      continue;
    }

    const nights = request?.nights
      ?? Math.max(1, differenceInCalendarDays(new Date(stayEnd), new Date(stayStart)));

    try {
      await createBookingRequest({
        couchId: request?.couchId ?? "legacy-couch",
        couchTitle: request?.couchTitle ?? request?.title ?? "Couch booking",
        hostId: request?.hostId ?? null,
        hostName: request?.hostEmail ?? request?.hostName ?? "Community Host",
        hostEmail: request?.hostEmail ?? null,
        renterId: profile.id,
        renterName: request?.renterName ?? profile.full_name ?? profile.email ?? "Renter",
        stayStart,
        stayEnd,
        nights,
        pricePerNight: request?.pricePerNight ?? request?.price ?? "$0",
        status: (request?.status as BookingRequestStatus | undefined) ?? "pending",
        createdAt: ensureDateString(request?.createdAt ?? request?.created_at ?? request?.submittedAt),
      });
      fingerprints.add(fingerprint);
      migrated += 1;
    } catch (error) {
      console.error("Failed to migrate legacy booking request", error);
      remaining.push(request);
    }
  }

  if (remaining.length) {
    localStorage.setItem(LEGACY_BOOKING_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(LEGACY_BOOKING_KEY);
  }
  return migrated;
};

const migrateLegacyMessages = async (profile: RenterProfile): Promise<number> => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_MESSAGE_PREFIX)) {
      keys.push(key);
    }
  }

  if (!keys.length) {
    return 0;
  }

  const existing = await getMessagesForRenter(profile.id, [profile.full_name ?? undefined, profile.email ?? undefined]);
  const fingerprints = getExistingMessageFingerprints(existing);
  let migrated = 0;

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

  let parsed: LegacyMessageRecord[] = [];
  try {
    const candidate = JSON.parse(raw) as unknown;
    parsed = Array.isArray(candidate) ? (candidate as LegacyMessageRecord[]) : [];
  } catch (error) {
    console.error("Failed to parse legacy messages", error);
    localStorage.removeItem(key);
    continue;
  }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(key);
      continue;
    }

    const remaining: LegacyMessageRecord[] = [];

    for (const message of parsed) {
      if (message?.renterId && message.renterId !== profile.id) {
        remaining.push(message);
        continue;
      }

      const sentAt = ensureDateString(message?.sentAt ?? message?.sent_at ?? message?.created_at);
      const fingerprint = `${message?.hostId ?? ""}|${sentAt}|${message?.text ?? message?.body ?? ""}`;
      if (fingerprints.has(fingerprint)) {
        continue;
      }

      try {
        await createMessage({
          couchId: message?.couchId ?? "legacy-couch",
          hostId: message?.hostId ?? null,
          hostName: message?.hostEmail ?? message?.hostName ?? "Community Host",
          hostEmail: message?.hostEmail ?? null,
          renterId: profile.id,
          renterName: message?.renterName ?? profile.full_name ?? profile.email ?? "Renter",
          body: message?.text ?? message?.body ?? "",
          sentAt,
          senderRole: message?.senderRole ?? 'renter',
          senderId: message?.senderId ?? profile.id,
          senderName: message?.senderName ?? (message?.senderRole === 'host'
            ? message?.hostName ?? 'Host'
            : message?.renterName ?? profile.full_name ?? profile.email ?? 'Renter'),
        });
        fingerprints.add(fingerprint);
        migrated += 1;
      } catch (error) {
        console.error("Failed to migrate legacy message", error);
      }
    }

    if (remaining.length) {
      localStorage.setItem(key, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(key);
    }
  }

  return migrated;
};

export const syncLegacyDataForRenter = async (profile: RenterProfile) => {
  if (typeof window === "undefined") {
    return { bookings: 0, messages: 0 };
  }

  if (wasSynced(profile.id)) {
    return { bookings: 0, messages: 0 };
  }

  let bookings = 0;
  let messages = 0;
  let success = true;

  try {
    bookings = await migrateLegacyBookings(profile);
  } catch (error) {
    success = false;
    console.error("Legacy booking migration failed", error);
  }

  try {
    messages = await migrateLegacyMessages(profile);
  } catch (error) {
    success = false;
    console.error("Legacy message migration failed", error);
  }

  if (success) {
    markSynced(profile.id);
  }

  return { bookings, messages };
};

const sanitizePrice = (value?: string | null) => {
  if (!value) return "$0";
  const trimmed = value.toString().trim();
  if (!trimmed) return "$0";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
};

const buildLegacyListingInput = (
  profile: HostProfile,
  legacy: LegacyListingRecord,
): CreateListingInput => {
  const propertyLabel = legacy.propertyType === "house" ? "House" : "Flat";
  const fallbackTitle = profile.full_name
    ? `${profile.full_name.split(" ")[0] || "Host"}'s ${propertyLabel} couch`
    : `${propertyLabel} couch`;
  const derivedTitle = legacy.title ?? (legacy.address ? `${propertyLabel} couch at ${legacy.address}` : null);
  const uploadedLabel = legacy.uploadedAt
    ? `Listing added on ${new Date(legacy.uploadedAt).toLocaleDateString()}`
    : null;
  const checkInTime = legacy.checkInTime ?? legacy.availability?.checkInTime ?? null;
  const defaultDescription = checkInTime
    ? `${profile.full_name ?? "Your host"} welcomes you. Check-in after ${checkInTime}.`
    : `${profile.full_name ?? "Your host"} welcomes you.`;

  return {
    id: legacy.listingId && typeof legacy.listingId === "string" ? legacy.listingId : undefined,
    hostId: profile.id,
    hostName: profile.full_name,
    hostEmail: profile.email,
    title: derivedTitle ?? fallbackTitle,
    imageUrl: legacy.imageUrl ?? null,
    pricePerNight: sanitizePrice(legacy.pricePerNight ?? legacy.price),
    location: legacy.address ?? legacy.location ?? "Address shared after booking",
    description: legacy.description ?? uploadedLabel ?? defaultDescription,
    availability: {
      start: legacy.availability?.start ?? null,
      end: legacy.availability?.end ?? null,
      checkInTime,
      country: legacy.country ?? null,
      city: legacy.city ?? null,
      addressLine: legacy.address ?? legacy.location ?? null,
    },
  };
};

export const syncLegacyListingsForHost = async (profile: HostProfile) => {
  if (typeof window === "undefined") {
    return { listings: 0 };
  }

  if (!profile.id) {
    return { listings: 0 };
  }

  if (wasListingsSynced(profile.id)) {
    return { listings: 0 };
  }

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_LISTING_PREFIX)) {
      keys.push(key);
    }
  }

  if (!keys.length) {
    markListingsSynced(profile.id);
    return { listings: 0 };
  }

  let migrated = 0;
  let success = true;

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw as string) as unknown;
      if (!parsed || typeof parsed !== "object") {
        continue;
      }

      const legacy = parsed as LegacyListingRecord;
      const ownerId = legacy?.userId ?? key.replace(LEGACY_LISTING_PREFIX, "");
      if (ownerId && ownerId !== profile.id) {
        continue;
      }

      const listingInput = buildLegacyListingInput(profile, legacy ?? {});
      const saved = await upsertListing(listingInput);
      if (saved) {
        migrated += 1;
        localStorage.removeItem(key);
      }
    } catch (error) {
      success = false;
      console.error("Failed to migrate legacy listing", { key, error });
    }
  }

  if (success) {
    markListingsSynced(profile.id);
  }

  if (typeof window !== "undefined" && migrated > 0) {
    window.dispatchEvent(new Event("listings-updated"));
  }

  return { listings: migrated };
};
