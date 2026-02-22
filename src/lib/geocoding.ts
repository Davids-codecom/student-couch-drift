export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

type CacheEntry = GeocodeResult;

const inMemoryCache = new Map<string, CacheEntry>();

const STORAGE_KEY_PREFIX = "geocode:";

const storeInLocalCache = (key: string, value: CacheEntry) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (error) {
    console.warn("Unable to persist geocode cache", error);
  }
};

const readFromLocalCache = (key: string) => {
  if (inMemoryCache.has(key)) {
    return inMemoryCache.get(key) ?? null;
  }

  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed
      && typeof parsed.lat === "number"
      && typeof parsed.lng === "number"
      && typeof parsed.displayName === "string"
    ) {
      inMemoryCache.set(key, parsed);
      return parsed;
    }
  } catch (error) {
    console.warn("Unable to read geocode cache", error);
  }

  return null;
};

const normaliseKey = (value: string) => value.trim().toLowerCase();

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "student-couch-app/1.0 (support@studentcouch.example)",
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
};

export const geocodeAddress = async (address: string): Promise<GeocodeResult | null> => {
  if (!address?.trim()) {
    return null;
  }

  const key = normaliseKey(address);
  const cached = readFromLocalCache(key);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    q: address,
    format: "json",
    addressdetails: "1",
    limit: "1",
  });

  const results = await fetchJson<Array<{ lat: string; lon: string; display_name: string }>>(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
  );

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const first = results[0];
  const lat = Number.parseFloat(first.lat);
  const lng = Number.parseFloat(first.lon);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const payload: GeocodeResult = {
    lat,
    lng,
    displayName: first.display_name,
  };

  inMemoryCache.set(key, payload);
  storeInLocalCache(key, payload);

  return payload;
};

export const searchAddressSuggestions = async (
  query: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<GeocodeResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    addressdetails: "1",
    limit: "5",
    autocomplete: "1",
  });

  const results = await fetchJson<Array<{ lat: string; lon: string; display_name: string }>>(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { signal },
  );

  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map((item) => {
      const lat = Number.parseFloat(item.lat);
      const lng = Number.parseFloat(item.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
      }
      return {
        lat,
        lng,
        displayName: item.display_name,
      } satisfies GeocodeResult;
    })
    .filter((item): item is GeocodeResult => Boolean(item));
};

export const clearGeocodeCacheForTesting = () => {
  inMemoryCache.clear();
  try {
    if (typeof window === "undefined") return;
    Object.keys(window.localStorage)
      .filter((itemKey) => itemKey.startsWith(STORAGE_KEY_PREFIX))
      .forEach((itemKey) => window.localStorage.removeItem(itemKey));
  } catch (error) {
    console.warn("Unable to clear geocode cache", error);
  }
};
