import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import couch1 from "@/assets/couch1.jpg";

const DEFAULT_CENTER: LatLngExpression = [46.5197, 6.6323];
const DEFAULT_ZOOM = 13;
const FALLBACK_IMAGE = couch1;

export interface ListingPoint {
  id: string;
  title: string;
  price: string;
  coordinates: { lat: number; lng: number };
  location: string;
  host: string;
  image: string | null;
}

interface ListingsMapProps {
  listings: ListingPoint[];
  userLocation?: { lat: number; lng: number } | null;
  isLoading?: boolean;
  onSelect?: (listingId: string) => void;
}

const ListingsMap = ({ listings, userLocation, isLoading = false, onSelect }: ListingsMapProps) => {
  const isBrowser = typeof window !== "undefined";

  const createListingIcon = (listing: ListingPoint) =>
    L.divIcon({
      className: "listing-marker",
      html: `
        <div style="width:72px;height:72px;border-radius:16px;overflow:hidden;box-shadow:0 8px 16px rgba(15,23,42,0.25);position:relative;background:#fff;">
          <img src="${(listing.image ?? FALLBACK_IMAGE).replace(/"/g, '&quot;')}" alt="${listing.title.replace(/"/g, '&quot;')}" style="width:100%;height:100%;object-fit:cover;" />
          <div style="position:absolute;bottom:6px;left:6px;padding:2px 8px;border-radius:9999px;background:rgba(15,23,42,0.85);color:#fff;font-size:12px;font-weight:600;line-height:1;">
            ${listing.price}
          </div>
        </div>
      `,
      iconAnchor: [36, 72],
      popupAnchor: [0, -72],
    });

  const center = useMemo<LatLngExpression>(() => {
    const preferred = listings.find((listing) => {
      const { lat, lng } = listing.coordinates;
      return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    });

    if (preferred) {
      return [preferred.coordinates.lat, preferred.coordinates.lng];
    }

    if (userLocation) {
      return [userLocation.lat, userLocation.lng];
    }

    return DEFAULT_CENTER;
  }, [listings, userLocation]);

  const zoom = userLocation ? 13 : listings.length > 1 ? 12 : DEFAULT_ZOOM;

  if (!isBrowser) {
    return null;
  }

  return (
    <div className="relative mx-auto h-[70vh] w-full max-w-5xl">
      <MapContainer
        key={`${center.toString()}-${zoom}`}
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full overflow-hidden rounded-lg shadow-sm"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={300}
            pathOptions={{ color: "#2563eb", fillColor: "#60a5fa", fillOpacity: 0.25 }}
          />
        )}

        {listings.map((listing) => (
          <Marker
            key={listing.id}
            position={[listing.coordinates.lat, listing.coordinates.lng]}
            icon={createListingIcon(listing)}
            eventHandlers={{
              click: () => {
                onSelect?.(listing.id);
              },
            }}
          >
            <Popup>
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold">{listing.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {listing.price} · {listing.location}
                  </p>
                  <p className="text-xs text-muted-foreground">Host: {listing.host}</p>
                </div>
                <Button size="sm" className="w-full" onClick={() => onSelect?.(listing.id)}>
                  View details
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
          Updating map…
        </div>
      )}
    </div>
  );
};

export default ListingsMap;
