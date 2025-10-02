import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import couch1 from "@/assets/couch1.jpg";
import couch2 from "@/assets/couch2.jpg";
import couch3 from "@/assets/couch3.jpg";
import couch4 from "@/assets/couch4.jpg";
import couch5 from "@/assets/couch5.jpg";
import couch6 from "@/assets/couch6.jpg";

interface CouchListing {
  id: string;
  image: string;
  price: string;
  title: string;
  host: string;
  location: string;
  availableDates: string;
  description: string;
}

type StoredListing = {
  userId?: string;
  address?: string;
  propertyType?: "house" | "flat";
  pricePerNight?: string;
  checkInTime?: string;
  uploadedAt?: string;
  hostName?: string | null;
};

const propertyTypeImageMap: Record<string, string> = {
  house: couch4,
  flat: couch3,
};

const defaultListings: CouchListing[] = [
  {
    id: "1",
    image: couch1,
    price: "$25",
    title: "Leather Corner Couch",
    host: "Sarah M.",
    location: "Downtown Campus",
    availableDates: "Oct 15-25",
    description: "Comfortable leather couch with plants and natural lighting. Perfect for studying or relaxing near campus."
  },
  {
    id: "2", 
    image: couch2,
    price: "$18",
    title: "Cozy Beige Sectional",
    host: "Mike T.",
    location: "North Dorms",
    availableDates: "Oct 20-30",
    description: "Spacious sectional with great natural light. Great for overnight stays during exam week."
  },
  {
    id: "3",
    image: couch3,
    price: "$22",
    title: "Modern Grey Sectional",
    host: "Emma K.",
    location: "Library District",
    availableDates: "Oct 18-28",
    description: "Perfect spot for late night study sessions. Close to the library and quiet."
  },
  {
    id: "4",
    image: couch4,
    price: "$28",
    title: "Green Corduroy Sectional",
    host: "Alex R.",
    location: "Student Village",
    availableDates: "Oct 16-26",
    description: "Unique green sectional with plants and cozy vibes. Great for extended stays."
  },
  {
    id: "5",
    image: couch5,
    price: "$32",
    title: "Modular Beige Sofa",
    host: "Jamie L.",
    location: "Arts Quarter",
    availableDates: "Oct 22-Nov 1",
    description: "Spacious modular sofa in bright apartment. Perfect for creative students."
  },
  {
    id: "6",
    image: couch6,
    price: "$35",
    title: "Designer Grey Sectional",
    host: "Taylor B.",
    location: "Campus Heights",
    availableDates: "Oct 19-29",
    description: "Modern designer couch in beautiful apartment with exposed beams. Premium comfort."
  }
];

const sanitizePrice = (value?: string) => {
  if (!value) return "$0";
  const trimmed = value.trim();
  if (!trimmed) return "$0";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
};

const createListingFromStorage = (
  data: StoredListing,
  storageKey: string,
  index: number,
): CouchListing => {
  const propertyType = data.propertyType ?? "flat";
  const image = propertyTypeImageMap[propertyType] ?? couch2;
  const friendlyProperty = propertyType === "house" ? "House" : "Flat";
  const hostFirstName = data.hostName?.split(" ")[0];
  const title = hostFirstName
    ? `${hostFirstName}'s ${friendlyProperty} Couch`
    : `New ${friendlyProperty} Couch`;

  const uploadedDate = data.uploadedAt ? new Date(data.uploadedAt) : null;
  const formattedDate = uploadedDate && !isNaN(uploadedDate.getTime())
    ? uploadedDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return {
    id: data.userId ? `local-${data.userId}` : `local-${storageKey}-${index}`,
    image,
    price: sanitizePrice(data.pricePerNight),
    title,
    host: data.hostName ?? "Community Host",
    location: data.address ?? "Address shared after booking",
    availableDates: data.checkInTime
      ? `Check-in after ${data.checkInTime}`
      : "Flexible availability",
    description: formattedDate
      ? `Listing added on ${formattedDate}.`
      : "Recently added listing from our host community.",
  };
};

const getLocalListings = (): CouchListing[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const storedListings: Array<{ data: StoredListing; key: string }> = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith("listing_")) continue;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredListing;
      storedListings.push({ data: parsed, key });
    } catch (error) {
      console.error("Failed to parse stored listing", error);
    }
  }

  storedListings.sort((a, b) => {
    const dateA = a.data.uploadedAt ? new Date(a.data.uploadedAt).getTime() : 0;
    const dateB = b.data.uploadedAt ? new Date(b.data.uploadedAt).getTime() : 0;
    return dateB - dateA;
  });

  return storedListings.map(({ data, key }, index) =>
    createListingFromStorage(data, key, index),
  );
};

const buildListings = () => {
  const local = getLocalListings();
  return local.length ? [...local, ...defaultListings] : defaultListings;
};

const CouchListings = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [listings, setListings] = useState<CouchListing[]>(() => buildListings());

  useEffect(() => {
    const handleUpdate = (_event?: Event) => {
      setListings(buildListings());
    };

    handleUpdate();

    window.addEventListener("storage", handleUpdate);
    window.addEventListener("listings-updated", handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("listings-updated", handleUpdate);
    };
  }, []);

  const handleCouchClick = (couch: CouchListing) => {
    navigate(`/couch/${couch.id}`, { state: { couch } });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center">
        <div className="text-center flex-1">
          <h1 className="text-2xl font-bold text-sketch-dark mb-2">
            Available Couches
          </h1>
          <p className="text-muted-foreground text-sm">
            Welcome back, {profile?.full_name || 'Student'}!
          </p>
        </div>
        <Button onClick={signOut} variant="outline" size="sm">
          Sign Out
        </Button>
      </header>

      {/* Grid of couch listings */}
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        {listings.map((couch) => (
          <div
            key={couch.id}
            onClick={() => handleCouchClick(couch)}
            className="sketch-card p-3 cursor-pointer"
          >
            {/* Couch Image */}
            <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-sketch-light">
              <img
                src={couch.image}
                alt={couch.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Price */}
            <div className="text-center">
              <p className="text-xl font-bold text-sketch-blue mb-1">
                {couch.price}
              </p>
              <p className="text-xs text-muted-foreground">
                per night
              </p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default CouchListings;