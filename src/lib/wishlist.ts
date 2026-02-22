import { supabase } from "@/lib/supabaseClient";

export interface WishlistSnapshot {
  id: string;
  image: string;
  price: string;
  title: string;
  host: string;
  hostEmail?: string | null;
  location: string;
  availableDates: string;
  description: string;
  hostId?: string | null;
  availability?: unknown;
  coordinates?: { lat: number; lng: number } | null;
}

export interface WishlistItem {
  id: string;
  userKey: string;
  couchId: string;
  storageId: string;
  snapshot: WishlistSnapshot;
  createdAt: string;
}

type WishlistRow = {
  id: string;
  user_key: string;
  couch_id: string;
  snapshot: WishlistSnapshot;
  created_at: string;
};

const TABLE = "user_wishlist";

const mapRowToItem = (row: WishlistRow): WishlistItem => {
  const snapshot: WishlistSnapshot = {
    ...row.snapshot,
    id: row.snapshot?.id ?? row.couch_id,
  };

  return {
    id: row.id,
    userKey: row.user_key,
    couchId: snapshot.id,
    storageId: row.couch_id,
    snapshot,
    createdAt: row.created_at,
  };
};

const toUuidOrNull = (value?: string | null) => {
  if (!value) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : null;
};

const stringToDeterministicUuid = (value: string): string => {
  const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const bytes = encoder
    ? Array.from(encoder.encode(value))
    : Array.from(value).map((char) => char.charCodeAt(0) & 0xff);

  if (!bytes.length) {
    return "00000000-0000-0000-0000-000000000000";
  }

  const hex = bytes
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const padded = (hex.length >= 32 ? hex.slice(0, 32) : hex.padEnd(32, "0")).toLowerCase();

  return `${padded.slice(0, 8)}-${padded.slice(8, 12)}-${padded.slice(12, 16)}-${padded.slice(16, 20)}-${padded.slice(20, 32)}`;
};

const normalizeCouchIdForStorage = (value: string): string => {
  const resolved = toUuidOrNull(value);
  if (resolved) return resolved;
  return stringToDeterministicUuid(value);
};

export const resolveWishlistStorageId = normalizeCouchIdForStorage;

const MAX_WISHLIST_ITEMS = 20;

export const deriveUserKey = (
  profile?: { id?: string | null; email?: string | null },
  session?: { user?: { id?: string | null; email?: string | null } | null },
): string | null => {
  const candidateId = session?.user?.id ?? profile?.id ?? null;
  const uuid = toUuidOrNull(candidateId);
  if (uuid) return uuid;
  return session?.user?.email ?? profile?.email ?? null;
};

export const fetchWishlist = async (userKey: string | null): Promise<WishlistItem[]> => {
  if (!userKey) return [];

  try {
    const { data, error } = await supabase
      .from<WishlistRow>(TABLE)
      .select("*")
      .eq("user_key", userKey)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRowToItem);
  } catch (error) {
    console.error("Failed to fetch wishlist from Supabase", error);
    throw error;
  }
};

export const addToWishlist = async (
  userKey: string | null,
  couchId: string,
  snapshot: WishlistSnapshot,
): Promise<WishlistItem | null> => {
  if (!userKey) return null;

  const storageId = normalizeCouchIdForStorage(couchId);

  const { data: existing, error: existingError } = await supabase
    .from<WishlistRow>(TABLE)
    .select("*")
    .eq("user_key", userKey)
    .eq("couch_id", storageId)
    .maybeSingle();
  if (existingError) {
    throw existingError;
  }
  if (existing) {
    throw new Error("This couch is already in your wishlist.");
  }

  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_key", userKey);
  if (countError) {
    console.error("Failed to count wishlist items", countError);
    throw countError;
  }
  if ((count ?? 0) >= MAX_WISHLIST_ITEMS) {
    throw new Error("You can save up to 20 couches. Remove one to add more.");
  }

  const payload = {
    user_key: userKey,
    couch_id: storageId,
    snapshot,
  };

  try {
    const { data, error } = await supabase
      .from<WishlistRow>(TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    const item = mapRowToItem(data);
    if (!item.snapshot.id) {
      item.snapshot.id = couchId;
    }
    item.couchId = item.snapshot.id;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("wishlist-updated"));
    }
    return item;
  } catch (error) {
    console.error("Supabase wishlist upsert failed", error);
    throw error;
  }
};

export const removeFromWishlist = async (
  userKey: string | null,
  couchId: string,
): Promise<void> => {
  if (!userKey) return;

  const storageId = normalizeCouchIdForStorage(couchId);

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("user_key", userKey)
      .eq("couch_id", storageId);

    if (error) throw error;
  } catch (error) {
    console.error("Supabase wishlist remove failed", error);
    throw error;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("wishlist-updated"));
  }
};
