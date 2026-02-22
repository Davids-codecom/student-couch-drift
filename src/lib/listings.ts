import { publicSupabase } from "@/lib/supabasePublic";
import { supabase } from "@/lib/supabaseClient";

interface ListingAvailability {
  hostName?: string | null;
  hostEmail?: string | null;
  start?: string | null;
  end?: string | null;
  checkInTime?: string | null;
  country?: string | null;
  city?: string | null;
  addressLine?: string | null;
  photos?: string[] | null;
  published?: boolean | null;
  coordinates?: {
    lat: number;
    lng: number;
    displayName?: string | null;
  } | null;
  [key: string]: unknown;
}

type ListingRow = {
  id: string;
  host_id: string | null;
  title: string | null;
  image_url: string | null;
  price_per_night: string | null;
  location: string | null;
  description: string | null;
  availability_json: ListingAvailability | null;
  created_at: string | null;
};

export interface ListingRecord {
  id: string;
  hostId: string | null;
  hostName: string | null;
  hostEmail: string | null;
  title: string;
  image: string | null;
  price: string | null;
  location: string | null;
  description: string | null;
  availability: {
    start?: string | null;
    end?: string | null;
    checkInTime?: string | null;
    country?: string | null;
    city?: string | null;
    addressLine?: string | null;
    photos?: string[] | null;
    published?: boolean | null;
    coordinates?: {
      lat: number;
      lng: number;
      displayName?: string;
    } | null;
  } | null;
  createdAt: string | null;
}

const mapListingRow = (row: ListingRow): ListingRecord => ({
  id: row.id,
  hostId: row.host_id,
  hostName: row.availability_json?.hostName ?? null,
  hostEmail: row.availability_json?.hostEmail ?? null,
  title: row.title ?? "New Listing",
  image: row.image_url,
  price: row.price_per_night,
  location: row.location,
  description: row.description,
  availability: row.availability_json ?? null,
  createdAt: row.created_at,
});

const isUuid = (value: string | null | undefined) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
};

const baseListingQuery = () =>
  publicSupabase
    .from<ListingRow>("user_listings")
    .select("*")
    .order("created_at", { ascending: false });

const normalizeValue = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export interface CreateListingInput {
  id?: string;
  hostId: string;
  hostName: string | null;
  hostEmail: string | null;
  title: string;
  imageUrl: string | null;
  pricePerNight: string;
  location: string;
  description: string;
  availability: {
    start?: string | null;
    end?: string | null;
    checkInTime?: string | null;
    country?: string | null;
    city?: string | null;
    addressLine?: string | null;
    coordinates?: {
      lat: number;
      lng: number;
      displayName?: string;
    } | null;
  };
}

export const fetchListings = async (): Promise<ListingRecord[]> => {
  const { data, error } = await publicSupabase
    .from<ListingRow>("user_listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapListingRow);
};

export const fetchListingById = async (listingId: string): Promise<ListingRecord | null> => {
  const { data, error } = await supabase
    .from<ListingRow>("user_listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapListingRow(data) : null;
};

export interface ListingHostLookup {
  listingId?: string | null;
  hostEmail?: string | null;
  hostName?: string | null;
}

export const fetchListingHost = async ({
  listingId,
  hostEmail,
  hostName,
}: ListingHostLookup): Promise<ListingRecord | null> => {
  const normalizedListingId = normalizeValue(listingId);
  const normalizedHostEmail = normalizeValue(hostEmail);
  const normalizedHostName = normalizeValue(hostName);

  if (normalizedListingId && isUuid(normalizedListingId)) {
    const byId = await fetchListingById(normalizedListingId);
    if (byId) {
      return byId;
    }
  }

  if (normalizedListingId && !isUuid(normalizedListingId)) {
    try {
      const { data, error } = await baseListingQuery()
        .eq("id", normalizedListingId)
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (data) {
        return mapListingRow(data);
      }
    } catch (error) {
      console.warn("Failed to fetch listing by non-uuid id", error);
    }
  }

  if (normalizedHostEmail) {
    const exact = await baseListingQuery()
      .eq("availability_json->>hostEmail", normalizedHostEmail)
      .limit(1)
      .maybeSingle();
    if (exact.error) {
      throw exact.error;
    }
    if (exact.data) {
      return mapListingRow(exact.data);
    }

    const loose = await baseListingQuery()
      .ilike("availability_json->>hostEmail", `%${normalizedHostEmail}%`)
      .limit(1)
      .maybeSingle();
    if (loose.error) {
      throw loose.error;
    }
    if (loose.data) {
      return mapListingRow(loose.data);
    }
  }

  if (normalizedHostName) {
    const { data, error } = await baseListingQuery()
      .ilike("availability_json->>hostName", `%${normalizedHostName}%`)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      return mapListingRow(data);
    }
  }

  return null;
};

export const fetchListingsForHost = async (hostId: string): Promise<ListingRecord[]> => {
  const { data, error } = await supabase
    .from<ListingRow>("user_listings")
    .select("*")
    .eq("host_id", hostId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapListingRow);
};

export const upsertListing = async (input: CreateListingInput): Promise<ListingRecord> => {
  const payload = {
    id: input.id,
    host_id: input.hostId,
    title: input.title,
    image_url: input.imageUrl,
    price_per_night: input.pricePerNight,
    location: input.location,
    description: input.description,
    availability_json: {
      ...input.availability,
      hostName: input.hostName,
      hostEmail: input.hostEmail,
    },
  };

  const { data, error } = await supabase
    .from<ListingRow>("user_listings")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapListingRow(data);
};

export const updateListingPublishStatus = async (id: string, published: boolean): Promise<ListingRecord> => {
  const { data: existing, error: fetchError } = await supabase
    .from<ListingRow>("user_listings")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (!existing) {
    throw new Error("Listing not found.");
  }

  const availability = {
    ...(existing.availability_json ?? {}),
    published,
  };

  const { data, error } = await supabase
    .from<ListingRow>("user_listings")
    .update({
      availability_json: availability,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapListingRow(data);
};
