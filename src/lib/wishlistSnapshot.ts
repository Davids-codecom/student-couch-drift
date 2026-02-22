import type { WishlistSnapshot } from "@/lib/wishlist";

export interface WishlistSource {
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

export const buildWishlistSnapshot = (source: WishlistSource): WishlistSnapshot => ({
  id: source.id,
  image: source.image,
  price: source.price,
  title: source.title,
  host: source.host,
  hostEmail: source.hostEmail ?? null,
  location: source.location,
  availableDates: source.availableDates,
  description: source.description,
  hostId: source.hostId ?? null,
  availability: source.availability ?? null,
  coordinates: source.coordinates ?? null,
});
