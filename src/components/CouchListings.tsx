import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import couch1 from "@/assets/couch1.jpg";
import couch2 from "@/assets/couch2.jpg";
import couch3 from "@/assets/couch3.jpg";
import couch4 from "@/assets/couch4.jpg";
import couch5 from "@/assets/couch5.jpg";
import couch6 from "@/assets/couch6.jpg";
import { format } from "date-fns";
import { Heart, MapPin, Calendar as CalendarIcon, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  addToWishlist,
  deriveUserKey,
  fetchWishlist,
  removeFromWishlist,
  resolveWishlistStorageId,
  type WishlistItem,
} from "@/lib/wishlist";
import { geocodeAddress, searchAddressSuggestions, type GeocodeResult } from "@/lib/geocoding";
import { fetchListings, upsertListing, updateListingPublishStatus } from "@/lib/listings";
import { SEARCH_LOCATION_LIMITS, CITY_REGION_KEYWORDS } from "@/lib/locationOptions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ListingPoint } from "./ListingsMap";
const ListingsMap = lazy(() => import("./ListingsMap"));
import type { DateRange } from "react-day-picker";
import { buildWishlistSnapshot } from "@/lib/wishlistSnapshot";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { fetchUserProfilesByIds } from "@/lib/users";

interface AvailabilityWindow {
  start?: string | null;
  end?: string | null;
  checkInTime?: string | null;
  country?: string | null;
  city?: string | null;
  addressLine?: string | null;
  published?: boolean | null;
  photos?: string[] | null;
  coordinates?: {
    lat: number;
    lng: number;
    displayName?: string | null;
  } | null;
}

interface CouchListing {
  id: string;
  image: string;
  price: string;
  title: string;
  host: string;
  hostEmail?: string | null;
  location: string;
  country?: string | null;
  city?: string | null;
  addressLine?: string | null;
  availableDates: string;
  description: string;
  hostId?: string | null;
  availability?: AvailabilityWindow | null;
  coordinates?: { lat: number; lng: number } | null;
  gallery?: string[];
  hostBio?: string | null;
  isPublished?: boolean;
}

const formatListingLocation = (listing: CouchListing) => {
  const city = listing.city?.trim();
  const country = listing.country?.trim();
  if (city && country) {
    return `${city}, ${country}`;
  }
  if (city) {
    return city;
  }
  if (country) {
    return country;
  }
  return listing.location;
};

const formatAvailabilityWindow = (window?: AvailabilityWindow | null) => {
  if (!window?.start || !window?.end) {
    return "Flexible availability";
  }

  const startDate = new Date(window.start);
  const endDate = new Date(window.end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Flexible availability";
  }

  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const startLabel = format(startDate, "MMM d");
  const endLabel = sameMonth ? format(endDate, "d") : format(endDate, "MMM d");
  return `${startLabel}-${endLabel}`;
};

const ADDRESS_PREVIEW_LIMIT = 70;

const formatAddressPreview = (value?: string | null, maxLength = ADDRESS_PREVIEW_LIMIT) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
};

const DEFAULT_STREET_ADDRESS = "Route de Geneve 15, Lausanne";
const DEFAULT_LOCATION_DESCRIPTION = "Calm neighborhood";
const DEFAULT_LISTING_DESCRIPTION = "Cozy couch and a kitchen to share";
const DEFAULT_PRICE_PER_NIGHT = "30";

const isValidListingPhotoUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Ignore stale build-time asset paths persisted in DB (e.g. /assets/couch1-<hash>.jpg).
  if (trimmed.startsWith("/assets/")) return false;
  return true;
};

const resolveListingPhotos = (listing: CouchListing) => {
  if (listing.gallery?.length) {
    const validGallery = listing.gallery.filter((photo) => isValidListingPhotoUrl(photo));
    if (validGallery.length) {
      return validGallery;
    }
  }
  const availabilityPhotos = listing.availability?.photos;
  if (Array.isArray(availabilityPhotos) && availabilityPhotos.length) {
    const validAvailabilityPhotos = availabilityPhotos.filter((photo) => isValidListingPhotoUrl(photo));
    if (validAvailabilityPhotos.length) {
      return validAvailabilityPhotos;
    }
  }
  return listing.image && isValidListingPhotoUrl(listing.image) ? [listing.image] : [];
};

const HOST_PROGRAM_TYPE_LABELS: Record<string, string> = {
  bsc: "Bachelor (BSc)",
  msc: "Master (MSc)",
  phd: "Doctorate (PhD)",
  other: "Other program",
};

const PHOTO_BUCKET = "couch-photos";

const generateFileName = (file: File) => {
  const ext = file.name.split(".").pop();
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${random}${ext ? `.${ext}` : ""}`;
};

const uploadListingPhoto = async (file: File, userId: string) => {
  const fileName = generateFileName(file);
  const filePath = `${userId}/${fileName}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: true });

  if (error) {
    throw new Error(error.message ?? "Failed to upload listing photo.");
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("Unable to fetch uploaded listing photo URL.");
  }
  return data.publicUrl;
};

type EditFormState = {
  title: string;
  price: string;
  description: string;
  location: string;
  country: string;
  city: string;
  addressLine: string;
  checkInTime: string;
};

const createEmptyEditForm = (): EditFormState => ({
  title: "",
  price: DEFAULT_PRICE_PER_NIGHT,
  description: DEFAULT_LISTING_DESCRIPTION,
  location: DEFAULT_LOCATION_DESCRIPTION,
  country: "Switzerland",
  city: "",
  addressLine: DEFAULT_STREET_ADDRESS,
  checkInTime: "",
});

const mapListingToEditForm = (listing: CouchListing): EditFormState => ({
  title: listing.title ?? "",
  price: (() => {
    const source = listing.price ?? `$${DEFAULT_PRICE_PER_NIGHT}`;
    const numeric = source.replace(/[^0-9.]/g, "");
    return numeric || DEFAULT_PRICE_PER_NIGHT;
  })(),
  description: listing.description ?? DEFAULT_LISTING_DESCRIPTION,
  location: listing.location ?? DEFAULT_LOCATION_DESCRIPTION,
  country: listing.country ?? listing.availability?.country ?? "Switzerland",
  city: listing.city ?? listing.availability?.city ?? "",
  addressLine: listing.addressLine ?? listing.availability?.addressLine ?? DEFAULT_STREET_ADDRESS,
  checkInTime: listing.availability?.checkInTime ?? "",
});

const sanitizePrice = (value?: string) => {
  if (!value) return "$0";
  const trimmed = value.trim();
  if (!trimmed) return "$0";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
};

const extractPriceValue = (price: string) => {
  const numeric = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const toWishlistRecord = (items: WishlistItem[]) => {
  return items.reduce<Record<string, WishlistItem>>((acc, item) => {
    acc[item.couchId] = item;
    if (item.storageId) {
      acc[item.storageId] = item;
    }
    const hashed = resolveWishlistStorageId(item.couchId);
    acc[hashed] = item;
    return acc;
  }, {});
};

type HostProfileSummary = {
  bio: string | null;
  university: string | null;
  programName: string | null;
  programYear: number | null;
  programType: string | null;
  avatarUrl: string | null;
};

const CouchListings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as { listingScope?: "all" | "mine" } | null) ?? null;
  const { signOut, profile, session } = useAuth();
  const { toast } = useToast();
  const userKey = deriveUserKey(profile, session);
  const isHost = profile?.user_role === "host";
  const [wishlistItems, setWishlistItems] = useState<Record<string, WishlistItem>>({});

  const wishlistIds = useMemo(() => new Set(Object.keys(wishlistItems)), [wishlistItems]);

  const [remoteListings, setRemoteListings] = useState<CouchListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [listingScope, setListingScope] = useState<"all" | "mine">("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<CouchListing | null>(null);
  const [editGallery, setEditGallery] = useState<string[]>([]);
  const [editGalleryFiles, setEditGalleryFiles] = useState<File[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [creatingListing, setCreatingListing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(() => createEmptyEditForm());
  const [expandedAddresses, setExpandedAddresses] = useState<Record<string, boolean>>({});
  const [galleryIndices, setGalleryIndices] = useState<Record<string, number>>({});
  const [hostProfiles, setHostProfiles] = useState<Record<string, HostProfileSummary>>({});
  const [visibilityUpdating, setVisibilityUpdating] = useState<Record<string, boolean>>({});
  const [editAddressQuery, setEditAddressQuery] = useState("");
  const [editAddressSuggestions, setEditAddressSuggestions] = useState<GeocodeResult[]>([]);
  const [editAddressSelected, setEditAddressSelected] = useState<GeocodeResult | null>(null);
  const [editAddressSearching, setEditAddressSearching] = useState(false);
  const dateFilterLabel = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`;
    }
    if (dateRange?.from) {
      return `Starting ${format(dateRange.from, "MMM d")}`;
    }
    return "Select date range";
  }, [dateRange]);
  const showClearFilters =
    searchQuery.trim().length > 0
    || countryFilter !== "all"
    || cityFilter !== "all"
    || priceMin.trim().length > 0
    || priceMax.trim().length > 0
    || Boolean(dateRange?.from || dateRange?.to);
  const showHostOnlyView = listingScope === "mine";

  useEffect(() => {
    if (!locationState?.listingScope) {
      return;
    }
    if (listingScope !== locationState.listingScope) {
      setListingScope(locationState.listingScope);
    }
  }, [listingScope, locationState?.listingScope]);

  useEffect(() => {
    if (listingScope === "mine" && viewMode !== "list") {
      setViewMode("list");
    }
  }, [listingScope, viewMode]);

  const handleEditFieldChange = useCallback((field: keyof EditFormState, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleEditCountryChange = useCallback((value: string) => {
    setEditForm((prev) => ({
      ...prev,
      country: value,
      city: prev.city && (SEARCH_LOCATION_LIMITS.citiesByCountry[value] ?? []).includes(prev.city)
        ? prev.city
        : "",
    }));
  }, []);

  const toggleAddressExpansion = useCallback((listingId: string) => {
    setExpandedAddresses((prev) => ({
      ...prev,
      [listingId]: !prev[listingId],
    }));
  }, []);
  const updateGalleryIndex = useCallback((listingId: string, nextIndex: number) => {
    setGalleryIndices((prev) => ({
      ...prev,
      [listingId]: nextIndex,
    }));
  }, []);
  const closeEditDialog = useCallback(() => {
    setEditDialogOpen(false);
    setEditingListing(null);
    setEditGallery([]);
    setEditGalleryFiles([]);
    setEditSaving(false);
    setEditForm(createEmptyEditForm());
    setEditAddressQuery("");
    setEditAddressSelected(null);
    setEditAddressSuggestions([]);
  }, []);

  const handleEditGalleryFilesChange = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) {
        setEditGalleryFiles([]);
        return;
      }
      const availableSlots = Math.max(0, 7 - editGallery.length);
      if (availableSlots <= 0) {
        toast({
          title: "Gallery is full",
          description: "You can upload up to 7 photos.",
          variant: "destructive",
        });
        return;
      }
      const nextFiles = Array.from(files).slice(0, availableSlots);
      if (nextFiles.length === 0) {
        toast({
          title: "Too many photos",
          description: "You can only have up to 7 photos total.",
          variant: "destructive",
        });
        return;
      }
      setEditGalleryFiles(nextFiles);
    },
    [editGallery.length, toast],
  );

  const handleRemoveGalleryImage = useCallback((imageUrl: string) => {
    setEditGallery((prev) => prev.filter((item) => item !== imageUrl));
  }, []);

  const handleGalleryDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      handleEditGalleryFilesChange(event.dataTransfer.files);
    },
    [handleEditGalleryFilesChange],
  );

  const handleEditListing = useCallback(
    (listing: CouchListing) => {
      if (!profile?.id) {
        toast({
          title: "Sign in to edit",
          description: "Hosts must be signed in to update a listing.",
          variant: "destructive",
        });
        return;
      }

      if (listing.hostId && listing.hostId !== profile.id) {
        toast({
          title: "Can't edit this listing",
          description: "Switch to My listing to edit your space.",
          variant: "destructive",
        });
        return;
      }

      setEditingListing(listing);
      setEditGallery(listing.gallery?.slice(0, 3) ?? (listing.image ? [listing.image] : []));
      setEditGalleryFiles([]);
      setEditForm(mapListingToEditForm(listing));
      setEditAddressQuery(listing.addressLine ?? listing.location ?? DEFAULT_STREET_ADDRESS);
      setEditAddressSelected(null);
      setEditAddressSuggestions([]);
      setEditDialogOpen(true);
    },
    [profile?.id, toast],
  );

  const handleEditSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editingListing) {
        return;
      }

      if (!profile?.id) {
        toast({
          title: "Sign in to edit",
          description: "Hosts must be signed in to update a listing.",
          variant: "destructive",
        });
        return;
      }

      if (editingListing.hostId && editingListing.hostId !== profile.id) {
        toast({
          title: "Can't edit this listing",
          description: "Switch to My listing to edit your space.",
          variant: "destructive",
        });
        return;
      }

      const trimmedTitle = editForm.title.trim();
      if (!trimmedTitle) {
        toast({
          title: "Add a title",
          description: "Give your listing a short name before saving.",
          variant: "destructive",
        });
        return;
      }

      let trimmedLocation = editForm.location.trim();
      if (!trimmedLocation) {
        trimmedLocation = DEFAULT_LOCATION_DESCRIPTION;
      }
      if (!trimmedLocation) {
        toast({
          title: "Add your location",
          description: "Let renters know where they'll be staying.",
          variant: "destructive",
        });
        return;
      }

      if (!editGallery.length && !editGalleryFiles.length) {
        toast({
          title: "Add a photo",
          description: "Upload at least one photo of your couch.",
          variant: "destructive",
        });
        return;
      }

      setEditSaving(true);

      try {
        let galleryUrls = [...editGallery];
        if (editGalleryFiles.length) {
          const availableSlots = Math.max(0, 7 - galleryUrls.length);
          const filesToUpload = editGalleryFiles.slice(0, availableSlots);
          for (const file of filesToUpload) {
            const uploadedUrl = await uploadListingPhoto(file, profile.id);
            galleryUrls.push(uploadedUrl);
          }
        }

        if (!galleryUrls.length) {
          throw new Error("At least one photo is required.");
        }

        galleryUrls = galleryUrls.slice(0, 7);
        const primaryImage = galleryUrls[0] ?? editingListing.image;
        const sanitizedPrice = sanitizePrice(
          editForm.price.trim() || editingListing.price || DEFAULT_PRICE_PER_NIGHT,
        );
        const normalizedDescription = editForm.description.trim()
          || editingListing.description
          || DEFAULT_LISTING_DESCRIPTION;
        const cityInput = editForm.city.trim();
        const countryInput = (editForm.country.trim() || "Switzerland").trim();
        const addressInput = editAddressQuery.trim()
          || editingListing.addressLine
          || editingListing.availability?.addressLine
          || DEFAULT_STREET_ADDRESS;
        const checkInInput = editForm.checkInTime.trim();
        const availability = {
          start: editingListing.availability?.start ?? null,
          end: editingListing.availability?.end ?? null,
          checkInTime: (checkInInput || editingListing.availability?.checkInTime) ?? null,
          country: countryInput
            || editingListing.country
            || editingListing.availability?.country
            || null,
          city: cityInput || editingListing.city || editingListing.availability?.city || null,
          addressLine: addressInput
            || editingListing.addressLine
            || editingListing.availability?.addressLine
            || null,
          coordinates:
            editAddressSelected
            ?? editingListing.availability?.coordinates
            ?? (editingListing.coordinates
              ? {
                  lat: editingListing.coordinates.lat,
                  lng: editingListing.coordinates.lng,
                }
              : null),
          photos: galleryUrls,
          published:
            typeof editingListing.availability?.published === "boolean"
              ? editingListing.availability.published
              : editingListing.isPublished ?? true,
        };

        await upsertListing({
          id: editingListing.id,
          hostId: profile.id,
          hostName: profile.full_name ?? profile.email ?? editingListing.host ?? "Host",
          hostEmail: profile.email ?? session?.user.email ?? editingListing.hostEmail ?? null,
          title: trimmedTitle,
          imageUrl: primaryImage,
          pricePerNight: sanitizedPrice,
          location: trimmedLocation,
          description: normalizedDescription,
          availability,
        });

        toast({
          title: "Listing updated",
          description: "Your couch details have been saved.",
        });

        window.dispatchEvent(new Event("listings-updated"));
        closeEditDialog();
      } catch (error) {
        console.error("Failed to update listing", error);
        toast({
          title: "Unable to update listing",
          description: error instanceof Error ? error.message : "Please try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setEditSaving(false);
      }
    },
    [closeEditDialog, editForm, editGallery, editGalleryFiles, editingListing, profile, session, toast],
  );

  const handleClearFilters = () => {
    setSearchQuery("");
    setCountryFilter("all");
    setCityFilter("all");
    setPriceMin("");
    setPriceMax("");
    setDateRange(undefined);
  };

  const loadWishlist = useCallback(async () => {
    if (!userKey) {
      setWishlistItems({});
      return;
    }
    try {
      const items = await fetchWishlist(userKey);
      setWishlistItems(toWishlistRecord(items));
    } catch (error) {
      console.warn("Failed to load wishlist", error);
    }
  }, [userKey]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => loadWishlist();
    window.addEventListener("wishlist-updated", handler);
    return () => window.removeEventListener("wishlist-updated", handler);
  }, [loadWishlist]);

  const handleCountryChange = useCallback((value: string) => {
    setCountryFilter(value);
    if (value === "all") {
      setCityFilter("all");
    }
  }, []);

  const handleCityChange = useCallback((value: string) => {
    setCityFilter(value);
  }, []);

  const handleCouchClick = useCallback(
    (couch: CouchListing, event?: React.SyntheticEvent) => {
      if (event?.defaultPrevented) {
        return;
      }
      navigate(`/couch/${couch.id}`, { state: { couch } });
    },
    [navigate],
  );
  const handleToggleWishlist = useCallback(
    async (event: React.MouseEvent, couch: CouchListing) => {
      event.stopPropagation();
      event.preventDefault();

      if (!userKey) {
        toast({
          title: "Sign in to save couches",
          description: "Create an account or sign in to build your wishlist.",
          variant: "destructive",
        });
        return;
      }

      const storageId = resolveWishlistStorageId(couch.id);
      const existing = wishlistItems[couch.id] ?? wishlistItems[storageId];

      try {
        if (existing) {
          await removeFromWishlist(userKey, couch.id);
          setWishlistItems((prev) => {
            const next = { ...prev };
            delete next[couch.id];
            delete next[storageId];
            return next;
          });
          toast({
            title: "Removed from wishlist",
            description: `${couch.title} is no longer saved.`,
          });
          return;
        }

        const snapshot = buildWishlistSnapshot(couch);
        const saved = await addToWishlist(userKey, couch.id, snapshot);
        if (saved) {
          setWishlistItems((prev) => ({
            ...prev,
            [saved.couchId]: saved,
            [saved.storageId]: saved,
            [resolveWishlistStorageId(saved.couchId)]: saved,
          }));
          toast({
            title: "Saved to wishlist",
            description: `${couch.title} was added for later.`,
          });
        }
      } catch (error) {
        console.error("Wishlist toggle failed", error);
        toast({
          title: "Unable to update wishlist",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      }
    },
    [toast, userKey, wishlistItems],
  );
  const geocodeProcessedRef = useRef<Set<string>>(new Set());
  const locationWarningRef = useRef(false);
  const fetchedHostProfilesRef = useRef<Set<string>>(new Set());
  const touchStartRef = useRef<Record<string, number>>({});

  const fetchRemoteListings = useCallback(async () => {
    try {
      setLoadingListings(true);
      const listings = await fetchListings();
      const fallbackImages = [couch1, couch2, couch3, couch4, couch5, couch6];

      const mapped: CouchListing[] = listings.map((listing, index) => {
        const availability: AvailabilityWindow | null = listing.availability
          ? {
              start: listing.availability.start ?? null,
              end: listing.availability.end ?? null,
              checkInTime: listing.availability.checkInTime ?? null,
              published:
                typeof listing.availability.published === "boolean"
                  ? listing.availability.published
                  : null,
              country: listing.availability.country ?? null,
              city: listing.availability.city ?? null,
              addressLine: listing.availability.addressLine ?? null,
              photos: Array.isArray(listing.availability.photos)
                ? listing.availability.photos.filter(
                    (photo): photo is string =>
                      typeof photo === "string" && isValidListingPhotoUrl(photo),
                  )
                : null,
              coordinates:
                listing.availability.coordinates
                && typeof listing.availability.coordinates.lat === "number"
                && typeof listing.availability.coordinates.lng === "number"
                  ? {
                      lat: listing.availability.coordinates.lat,
                      lng: listing.availability.coordinates.lng,
                      displayName: listing.availability.coordinates.displayName ?? null,
                    }
                  : null,
            }
          : null;

        const hasRange = availability?.start && availability?.end;
        const published = typeof availability?.published === "boolean" ? availability.published : true;
        const galleryPhotos = Array.isArray(availability?.photos) ? availability.photos : [];
        const image = listing.image ?? galleryPhotos[0] ?? fallbackImages[index % fallbackImages.length];
        const structuredCountry = availability?.country?.trim() || null;
        const structuredCity = availability?.city?.trim() || null;
        const structuredAddress = availability?.addressLine?.trim() || listing.location?.trim() || null;
        const mapCoordinates =
          availability?.coordinates
          && typeof availability.coordinates.lat === "number"
          && typeof availability.coordinates.lng === "number"
            ? {
                lat: availability.coordinates.lat,
                lng: availability.coordinates.lng,
              }
            : null;

        const availableDates = hasRange
          ? formatAvailabilityWindow(availability)
          : availability?.checkInTime
            ? `Check-in after ${availability.checkInTime}`
            : "Flexible availability";

        return {
          id: listing.id,
          image,
          price: sanitizePrice(listing.price ?? "0"),
          title: listing.title ?? `Community couch ${index + 1}`,
          host: listing.hostName ?? "Community host",
          hostEmail: listing.hostEmail ?? null,
          location: listing.location ?? "Address shared after booking",
          country: structuredCountry,
          city: structuredCity,
          addressLine: structuredAddress,
          availableDates,
          description:
            listing.description
            ?? (listing.createdAt
              ? `Listing published on ${new Date(listing.createdAt).toLocaleDateString()}`
              : "Listing added by our host community."),
          hostId: listing.hostId,
          availability,
          coordinates: mapCoordinates,
          gallery: galleryPhotos.length
            ? galleryPhotos
            : image
              ? [image]
              : [],
          hostBio: null,
          isPublished: published,
        };
      });

      setRemoteListings(mapped);
    } catch (error) {
      console.error("Failed to fetch listings", error);
    } finally {
      setLoadingListings(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (error) => {
        if (!locationWarningRef.current) {
          console.warn("Unable to determine user location", error);
          locationWarningRef.current = true;
        }
      },
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  useEffect(() => {
    fetchRemoteListings();
  }, [fetchRemoteListings]);

  useEffect(() => {
    const trimmed = editAddressQuery.trim();
    if (!trimmed || trimmed.length < 3) {
      setEditAddressSuggestions([]);
      setEditAddressSearching(false);
      return;
    }

    if (editAddressSelected && editAddressSelected.displayName === trimmed) {
      setEditAddressSuggestions([]);
      setEditAddressSearching(false);
      return;
    }

    const controller = new AbortController();
    setEditAddressSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await searchAddressSuggestions(trimmed, { signal: controller.signal });
        setEditAddressSuggestions(results);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Address lookup failed", error);
        }
      } finally {
        setEditAddressSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [editAddressQuery, editAddressSelected]);

  const handleToggleVisibility = useCallback(
    async (listing: CouchListing, nextState: boolean) => {
      if (!listing.id) return;
      setVisibilityUpdating((prev) => ({ ...prev, [listing.id]: true }));
      try {
        await updateListingPublishStatus(listing.id, nextState);
        setRemoteListings((prev) =>
          prev.map((item) =>
            item.id === listing.id
              ? {
                  ...item,
                  isPublished: nextState,
                  availability: {
                    ...item.availability,
                    published: nextState,
                  },
                }
              : item,
          ),
        );
        await fetchRemoteListings();
        toast({
          title: nextState ? "Listing published" : "Listing unpublished",
          description: nextState
            ? "Your listing is live and visible to renters."
            : "Your listing is hidden until you publish it again.",
        });
        if (nextState && listingScope === "all") {
          setListingScope("all");
        }
      } catch (error) {
        console.error("Failed to toggle listing visibility", error);
        toast({
          title: "Unable to update listing",
          description: error instanceof Error ? error.message : "Please try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setVisibilityUpdating((prev) => {
          const next = { ...prev };
          delete next[listing.id];
          return next;
        });
      }
    },
    [fetchRemoteListings, toast],
  );

  const handleCreateListingShell = useCallback(async () => {
    if (!profile?.id) {
      toast({
        title: "Sign in required",
        description: "Hosts need to sign in before creating a listing.",
        variant: "destructive",
      });
      return;
    }

    setCreatingListing(true);
    try {
      const listingId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${profile.id}-${Date.now()}`;
      await upsertListing({
        id: listingId,
        hostId: profile.id,
        hostName: profile.full_name ?? profile.email ?? "Host",
        hostEmail: profile.email ?? session?.user.email ?? null,
        title: profile.full_name ? `${profile.full_name}'s couch` : "Hosted couch",
        imageUrl: null,
        pricePerNight: sanitizePrice(DEFAULT_PRICE_PER_NIGHT),
        location: DEFAULT_LOCATION_DESCRIPTION,
        description: DEFAULT_LISTING_DESCRIPTION,
        availability: {
          start: null,
          end: null,
          checkInTime: null,
          country: null,
          city: null,
          addressLine: DEFAULT_STREET_ADDRESS,
          coordinates: null,
          published: false,
        },
      });
      await fetchRemoteListings();
      setListingScope("mine");
      toast({
        title: "Listing created",
        description: "Open “Edit listing” to add your address, couch photos, and description.",
      });
    } catch (error) {
      console.error("Failed to create placeholder listing", error);
      toast({
        title: "Unable to create listing",
        description: error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setCreatingListing(false);
    }
  }, [fetchRemoteListings, profile?.email, profile?.full_name, profile?.id, session?.user.email, toast]);

  useEffect(() => {
    const missingIds = remoteListings
      .map((listing) => listing.hostId)
      .filter((id): id is string => Boolean(id) && !fetchedHostProfilesRef.current.has(id));
    if (!missingIds.length) {
      return;
    }

    let cancelled = false;
    const loadProfiles = async () => {
      try {
        const profiles = await fetchUserProfilesByIds(Array.from(new Set(missingIds)));
        if (cancelled) {
          return;
        }
        setHostProfiles((prev) => {
          const next = { ...prev };
          profiles.forEach((profile) => {
            fetchedHostProfilesRef.current.add(profile.id);
            next[profile.id] = {
              bio: profile.bio ?? null,
              university: profile.university ?? null,
              programName: profile.program_name ?? null,
              programYear: profile.program_year ?? null,
              programType: profile.program_type ?? null,
              avatarUrl: profile.avatar_url ?? null,
            };
          });
          return next;
        });
      } catch (error) {
        console.warn("Failed to load host bios", error);
      }
    };

    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [remoteListings]);

  useEffect(() => {
    setGalleryIndices((prev) => {
      let changed = false;
      const next = { ...prev };
      remoteListings.forEach((listing) => {
        const photos = resolveListingPhotos(listing);
        if (!photos.length) {
          if (listing.id in next) {
            delete next[listing.id];
            changed = true;
          }
          return;
        }
        const currentIndex = next[listing.id] ?? 0;
        if (currentIndex >= photos.length) {
          next[listing.id] = 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [remoteListings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handler = () => {
      fetchRemoteListings();
    };

    window.addEventListener("listings-updated", handler);
    return () => window.removeEventListener("listings-updated", handler);
  }, [fetchRemoteListings]);

  useEffect(() => {
    const pending = remoteListings.filter(
      (listing) =>
        !listing.coordinates
        && Boolean(listing.location)
        && !geocodeProcessedRef.current.has(listing.id),
    );

    if (!pending.length) {
      setGeoLoading(false);
      return;
    }

    let cancelled = false;
    setGeoLoading(true);

    const run = async () => {
      for (const listing of pending) {
        geocodeProcessedRef.current.add(listing.id);
        try {
          const coords = await geocodeAddress(listing.location);
          if (!coords || cancelled) {
            continue;
          }

          setRemoteListings((prev) =>
            prev.map((item) =>
              item.id === listing.id
                ? {
                    ...item,
                    coordinates: coords,
                  }
                : item,
            ),
          );
        } catch (error) {
          console.warn("Unable to geocode address", error);
        }
      }

      if (!cancelled) {
        setGeoLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [remoteListings]);

  const allListings = useMemo(() => remoteListings, [remoteListings]);

  const myListings = useMemo(() => {
    if (!profile?.id) {
      return [];
    }
    return remoteListings.filter((listing) => listing.hostId === profile.id);
  }, [profile?.id, remoteListings]);

  const scopedListings = useMemo(() => {
    if (listingScope === "mine") {
      return myListings;
    }
    return allListings;
  }, [allListings, listingScope, myListings]);

  const countryOptions = SEARCH_LOCATION_LIMITS.countries;

  const cityOptions = useMemo(() => {
    if (countryFilter === "all") {
      return [];
    }
    return SEARCH_LOCATION_LIMITS.citiesByCountry[countryFilter] ?? [];
  }, [countryFilter]);

  const editCityOptions = useMemo(() => {
    const country = editForm.country.trim() || "Switzerland";
    return SEARCH_LOCATION_LIMITS.citiesByCountry[country] ?? [];
  }, [editForm.country]);

  useEffect(() => {
    if (countryFilter === "all") {
      setCityFilter("all");
      return;
    }
    const allowedCities = SEARCH_LOCATION_LIMITS.citiesByCountry[countryFilter] ?? [];
    if (cityFilter === "all") {
      return;
    }
    if (!allowedCities.includes(cityFilter)) {
      setCityFilter("all");
    }
  }, [cityFilter, countryFilter]);

  const filteredListings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const normalizedCountry = countryFilter === "all" ? null : countryFilter.toLowerCase();
    const normalizedCity = cityFilter === "all" ? null : cityFilter.toLowerCase();
    const minPriceValue = priceMin.trim() ? Number(priceMin) : null;
    const maxPriceValue = priceMax.trim() ? Number(priceMax) : null;
    const hasMinPrice = minPriceValue !== null && Number.isFinite(minPriceValue);
    const hasMaxPrice = maxPriceValue !== null && Number.isFinite(maxPriceValue);

    return scopedListings.filter((listing) => {
      const matchesQuery = query
        ? [listing.title, listing.location, listing.host, listing.city, listing.country, listing.addressLine]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(query))
        : true;
      const matchesVisibility = listingScope === "mine" ? true : listing.isPublished !== false;
      const matchesPrice = (() => {
        const numericPrice = extractPriceValue(listing.price);
        if (hasMinPrice && numericPrice < (minPriceValue as number)) {
          return false;
        }
        if (hasMaxPrice && numericPrice > (maxPriceValue as number)) {
          return false;
        }
        return true;
      })();
      const matchesDate = true;
      const matchesCountry = (() => {
        if (!normalizedCountry) return true;
        const explicit = listing.country?.trim().toLowerCase();
        if (explicit) {
          return explicit === normalizedCountry;
        }
        const locationText = listing.location?.toLowerCase() ?? "";
        return locationText.includes(normalizedCountry);
      })();
      const matchesCity = (() => {
        if (!normalizedCity) return true;
        const explicit = listing.city?.trim().toLowerCase();
        if (explicit && explicit === normalizedCity) {
          return true;
        }
        const locationText = [
          listing.city,
          listing.addressLine,
          listing.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (locationText.includes(normalizedCity)) {
          return true;
        }
        const regionalKeywords = CITY_REGION_KEYWORDS[normalizedCity] ?? [];
        if (regionalKeywords.length && locationText) {
          return regionalKeywords.some((keyword) => locationText.includes(keyword));
        }
        return false;
      })();
      return (
        matchesQuery
        && matchesVisibility
        && matchesPrice
        && matchesDate
        && matchesCountry
        && matchesCity
      );
    });
  }, [scopedListings, cityFilter, countryFilter, dateRange, priceMax, priceMin, searchQuery, listingScope]);

  const mapListings = useMemo(
    () => filteredListings.filter((listing) => Boolean(listing.coordinates)),
    [filteredListings],
  );

  const mapPoints = useMemo<ListingPoint[]>(
    () =>
      mapListings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        coordinates: listing.coordinates as { lat: number; lng: number },
        location: formatListingLocation(listing),
        host: listing.host,
        image: listing.image,
      })),
    [mapListings],
  );

  const greeting = "Welcome back";

  return (
    <div className="relative min-h-screen overflow-hidden dreamy-bg text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-blue-200/40 blur-[140px]" />
        <div className="absolute bottom-0 left-[-10%] h-80 w-80 rounded-full bg-indigo-200/30 blur-[160px]" />
      </div>
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-slate-500">{greeting}</p>
            <h1 className="text-3xl font-semibold text-slate-900">
              {showHostOnlyView ? "Manage your listing" : "Find calming couches near campus"}
            </h1>
            <p className="text-sm text-slate-500">
              {showHostOnlyView
                ? "Preview how your space appears to renters and edit the details below."
                : "Browse calming couches and use the filters below to find the right match."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>
              Signed in as <span className="font-semibold text-slate-800">{profile?.full_name ?? "student"}</span>
            </span>
          </div>
        </header>

        {!showHostOnlyView && (
        <section className="mb-8 space-y-4 rounded-[2rem] border border-white/50 bg-white/85 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-full border border-slate-100 bg-white px-4 py-2 shadow-sm">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by host, city, or address"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="w-full">
              <Select value={countryFilter} onValueChange={handleCountryChange}>
                <SelectTrigger className="w-full rounded-full border border-slate-100 bg-white px-4 py-2 text-left text-sm font-medium text-slate-600">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {countryOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full">
              <Select value={cityFilter} onValueChange={handleCityChange} disabled={countryFilter === "all"}>
                <SelectTrigger
                  className="w-full rounded-full border border-slate-100 bg-white px-4 py-2 text-left text-sm font-medium text-slate-600"
                  disabled={countryFilter === "all"}
                >
                  <SelectValue placeholder={countryFilter === "all" ? "Choose Switzerland first" : "City"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities in Switzerland</SelectItem>
                  {cityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="w-full rounded-[1.5rem] border border-slate-100 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price range</p>
                <div className="mt-3 flex items-center gap-3">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="Min"
                    value={priceMin}
                    onChange={(event) => setPriceMin(event.target.value)}
                    className="rounded-full border-slate-200 bg-slate-50 text-sm"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="Max"
                    value={priceMax}
                    onChange={(event) => setPriceMax(event.target.value)}
                    className="rounded-full border-slate-200 bg-slate-50 text-sm"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">Set any minimum or maximum nightly rate.</p>
              </div>
              <div className="w-full rounded-[1.5rem] border border-slate-100 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stay dates</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="mt-3 flex w-full items-center justify-between rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-left text-sm font-medium text-slate-600 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <span>{dateFilterLabel}</span>
                      <CalendarIcon className="h-4 w-4 text-slate-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-2xl border bg-white p-4 shadow-xl" align="start">
                    <DatePicker
                      mode="range"
                      numberOfMonths={2}
                      selected={dateRange}
                      onSelect={(range) => setDateRange(range)}
                      initialFocus
                    />
                    <div className="mt-3 flex justify-between border-t pt-3">
                      <p className="text-xs text-slate-400">Select a start and end date.</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-600"
                        onClick={() => setDateRange(undefined)}
                      >
                        Clear
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {showClearFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-medium text-slate-500 underline underline-offset-4"
                >
                  Clear filters
                </button>
              )}
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 text-sm font-medium text-slate-600">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`rounded-full px-4 py-1.5 transition ${
                    viewMode === "list" ? "bg-slate-900 text-white shadow" : "text-slate-500"
                  }`}
                >
                  List view
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`rounded-full px-4 py-1.5 transition ${
                    viewMode === "map" ? "bg-slate-900 text-white shadow" : "text-slate-500"
                  }`}
                >
                  Map view
                </button>
              </div>
            </div>
          </div>
        </section>
        )}

        {viewMode === "map" ? (
          mapPoints.length > 0 ? (
            <Suspense>
              <ListingsMap
                listings={mapPoints}
                userLocation={userLocation}
                isLoading={geoLoading || loadingListings}
                onSelect={(id) => {
                  const selected = filteredListings.find((item) => item.id === id);
                  if (selected) {
                    handleCouchClick(selected);
                  }
                }}
              />
            </Suspense>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500">
              {geoLoading || loadingListings
                ? "Locating calming couches near you…"
                : "No plotted couches for the current filters. Try switching back to the list view or clearing filters."}
            </div>
          )
        ) : (
          <section className="space-y-6">
            {(loadingListings || geoLoading) && (
              <p className="text-center text-sm text-slate-500">
                {loadingListings ? "Loading the latest couches…" : "Pinning couch locations…"}
              </p>
            )}
            {!filteredListings.length && !(loadingListings || geoLoading) ? (
              listingScope === "mine" ? (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 p-10 text-center space-y-3">
                  <p className="text-base font-semibold text-slate-900">You haven't published a listing yet.</p>
                  <p className="text-sm text-slate-500">
                    Create your listing shell and then use “Edit listing” to add your address, couch photos, and
                    description.
                  </p>
                  <Button
                    className="rounded-full"
                    disabled={creatingListing}
                    onClick={handleCreateListingShell}
                  >
                    {creatingListing ? "Creating..." : "Create my listing"}
                  </Button>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 p-10 text-center">
                  <p className="text-base font-semibold text-slate-900">No calming stays match that search</p>
                  <p className="mt-2 text-sm text-slate-500">Try clearing filters or searching a nearby neighborhood.</p>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((couch) => {
                  const primaryLocation = formatListingLocation(couch);
                  const secondaryLocation =
                    couch.addressLine && couch.addressLine !== primaryLocation ? couch.addressLine : null;
                  const isAddressExpanded = expandedAddresses[couch.id] ?? false;
                  const shouldTruncateAddress =
                    Boolean(secondaryLocation) && (secondaryLocation as string).length > ADDRESS_PREVIEW_LIMIT;
                  const addressDisplay = isAddressExpanded || !secondaryLocation
                    ? secondaryLocation
                    : formatAddressPreview(secondaryLocation);
                  const isExampleAddress = Boolean(
                    secondaryLocation
                      && secondaryLocation.trim().toLowerCase() === DEFAULT_STREET_ADDRESS.toLowerCase(),
                  );
                  const hostProfile = couch.hostId ? hostProfiles[couch.hostId] ?? null : null;
                  const hostUniversity = hostProfile?.university?.trim() || null;
                  const hostProgramName = hostProfile?.programName?.trim() || null;
                  const hostProgramTypeLabel = hostProfile?.programType
                    ? HOST_PROGRAM_TYPE_LABELS[hostProfile.programType] ?? hostProfile.programType
                    : null;
                  const hostProgramYear = hostProfile?.programYear ? `Year ${hostProfile.programYear}` : null;
                  const hostProgramDetails = [hostProgramName, hostProgramTypeLabel, hostProgramYear]
                    .filter(Boolean)
                    .join(" · ");

                  const photos = resolveListingPhotos(couch);
                  const activePhotoIndex = galleryIndices[couch.id] ?? 0;
                  const currentPhoto = photos[activePhotoIndex] ?? couch.image;
                  const hasMultiplePhotos = photos.length > 1;
                  const changePhoto = (direction: "prev" | "next") => {
                    if (!hasMultiplePhotos) return;
                    const nextIndex = direction === "prev"
                      ? (activePhotoIndex - 1 + photos.length) % photos.length
                      : (activePhotoIndex + 1) % photos.length;
                    updateGalleryIndex(couch.id, nextIndex);
                  };
                  const handleGalleryButtonClick = (
                    event: React.MouseEvent<HTMLButtonElement>,
                    direction: "prev" | "next",
                  ) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (typeof event.nativeEvent.stopImmediatePropagation === "function") {
                      event.nativeEvent.stopImmediatePropagation();
                    }
                    changePhoto(direction);
                  };

                  return (
                    <article
                      key={couch.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => handleCouchClick(couch, event)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleCouchClick(couch, event);
                        }
                      }}
                      className="group cursor-pointer rounded-[1.75rem] border border-white/60 bg-white/80 shadow-xl shadow-blue-100/60 backdrop-blur transition duration-300 hover:-translate-y-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
                    >
                      <div
                        className="relative h-64 overflow-hidden rounded-[1.5rem]"
                        onTouchStart={(event) => {
                          touchStartRef.current[couch.id] = event.touches[0]?.clientX ?? 0;
                        }}
                        onTouchEnd={(event) => {
                          const start = touchStartRef.current[couch.id];
                          if (typeof start !== "number") {
                            return;
                          }
                          const endX = event.changedTouches[0]?.clientX ?? start;
                          const delta = endX - start;
                          if (Math.abs(delta) > 40) {
                            event.stopPropagation();
                            changePhoto(delta > 0 ? "prev" : "next");
                          }
                          delete touchStartRef.current[couch.id];
                        }}
                      >
                      {userKey && (
                        <button
                          className={`absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                            wishlistIds.has(couch.id) ? "text-rose-500" : ""
                          }`}
                          aria-label={
                            wishlistIds.has(couch.id)
                              ? "Remove from wishlist"
                              : "Save to wishlist"
                          }
                          onClick={(event) => handleToggleWishlist(event, couch)}
                        >
                          <Heart className={`h-5 w-5 ${wishlistIds.has(couch.id) ? "fill-rose-500" : ""}`} />
                        </button>
                      )}
                      <img src={currentPhoto ?? couch.image} alt={couch.title} className="h-full w-full object-cover" />
                      {hasMultiplePhotos && (
                        <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white sm:flex">
                          Photo {activePhotoIndex + 1} / {photos.length}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10" />
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                        <div>
                          <p className="text-lg font-semibold">{couch.price}</p>
                          <p className="text-xs text-white/80">per night</p>
                        </div>
                        <p className="text-xs text-white/80">Hosted by {couch.host}</p>
                      </div>
                    </div>
                    <div className="space-y-3 p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">{couch.title}</h3>
                        <span className="text-sm font-semibold text-slate-700">{couch.price}</span>
                      </div>
                      {isHost && listingScope === "mine" && couch.hostId === profile?.id && (
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            couch.isPublished === false ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          {couch.isPublished === false ? "Draft · Not published" : "Published"}
                        </p>
                      )}
                      {(hostUniversity || hostProgramDetails) && (
                        <div className="space-y-0.5 text-xs text-slate-500">
                          {hostUniversity && (
                            <p className="font-semibold text-slate-700">{hostUniversity}</p>
                          )}
                          {hostProgramDetails && <p>{hostProgramDetails}</p>}
                        </div>
                      )}
                      <p className="flex items-center gap-2 text-sm text-slate-500">
                        <MapPin className="h-4 w-4" />
                        <span className="flex flex-wrap items-center gap-1">
                          {primaryLocation}
                          {secondaryLocation && (
                            <span className={`ml-1 text-xs ${isExampleAddress ? "text-slate-300 italic" : "text-slate-400"}`}>
                              · {addressDisplay}
                              {shouldTruncateAddress && (
                                <button
                                  type="button"
                                  className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:underline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    toggleAddressExpansion(couch.id);
                                  }}
                                >
                                  {isAddressExpanded ? "Hide" : "Full address"}
                                </button>
                              )}
                            </span>
                          )}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="flex items-center gap-2">
                          {isHost && listingScope === "mine" && couch.hostId === profile?.id && (
                            <Button
                              size="sm"
                              className="rounded-full bg-blue-600 text-xs text-white shadow hover:bg-blue-500"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleEditListing(couch);
                              }}
                            >
                              Edit listing
                            </Button>
                          )}
                          {isHost && listingScope === "mine" && couch.hostId === profile?.id && (
                            <Button
                              size="sm"
                              variant={couch.isPublished !== false ? "outline" : "default"}
                              className="rounded-full text-xs"
                              disabled={Boolean(visibilityUpdating[couch.id])}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleVisibility(couch, couch.isPublished === false);
                              }}
                            >
                              {visibilityUpdating[couch.id]
                                ? "Saving..."
                                : couch.isPublished === false
                                  ? "Publish listing"
                                  : "Unpublish"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                          className="rounded-full bg-slate-800 text-white hover:bg-slate-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCouchClick(couch, event);
                          }}
                        >
                          View stay
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
              </div>
            )}
          </section>
        )}
      </main>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit listing</DialogTitle>
            <DialogDescription>Fine-tune your couch details. Updates go live immediately.</DialogDescription>
          </DialogHeader>
          {editingListing ? (
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Listing title</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(event) => handleEditFieldChange("title", event.target.value)}
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Price per night</Label>
                  <Input
                    id="edit-price"
                    value={editForm.price}
                    onChange={(event) => handleEditFieldChange("price", event.target.value)}
                    placeholder="25"
                    disabled={editSaving}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={editForm.country || "Switzerland"} onValueChange={handleEditCountryChange} disabled={editSaving}>
                    <SelectTrigger className="rounded-2xl border-slate-200 bg-white">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countryOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select
                    value={editForm.city || undefined}
                    onValueChange={(value) => handleEditFieldChange("city", value)}
                    disabled={editSaving || !editCityOptions.length}
                  >
                    <SelectTrigger className="rounded-2xl border-slate-200 bg-white">
                      <SelectValue placeholder={editCityOptions.length ? "Select city" : "Choose country first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {editCityOptions.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-address">Street address</Label>
                <Input
                  id="edit-address"
                  value={editAddressQuery}
                  onChange={(event) => {
                    setEditAddressQuery(event.target.value);
                    setEditAddressSelected(null);
                  }}
                  placeholder="Enter your street"
                  disabled={editSaving}
                />
                <p className="text-xs text-slate-500">Exact details stay private until you approve a booking.</p>
                {(() => {
                  const trimmed = editAddressQuery.trim();
                  const shouldShow = trimmed.length >= 3 && (editAddressSearching || editAddressSuggestions.length > 0 || !editAddressSelected);
                  if (!shouldShow) return null;
                  return (
                    <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                      {editAddressSearching && <p className="px-3 py-2 text-xs text-slate-500">Searching addresses…</p>}
                      {!editAddressSearching && editAddressSuggestions.length === 0 && !editAddressSelected && (
                        <p className="px-3 py-2 text-xs text-slate-500">No matches yet. Keep typing.</p>
                      )}
                      {editAddressSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.lat}-${suggestion.lng}`}
                          type="button"
                          className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-blue-50 ${
                            editAddressSelected?.displayName === suggestion.displayName ? "bg-blue-50" : ""
                          }`}
                          onClick={() => {
                            setEditAddressSelected(suggestion);
                            setEditAddressQuery(suggestion.displayName);
                            setEditAddressSuggestions([]);
                          }}
                        >
                          {suggestion.displayName}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {editAddressSelected && (
                  <p className="text-xs font-medium text-emerald-600">Address confirmed ✔️</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Location description</Label>
                <Input
                  id="edit-location"
                  value={editForm.location}
                  onChange={(event) => handleEditFieldChange("location", event.target.value)}
                  placeholder="Near Downtown Campus"
                  disabled={editSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(event) => handleEditFieldChange("description", event.target.value)}
                  rows={4}
                  disabled={editSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-checkin">Check-in time</Label>
                <Input
                  id="edit-checkin"
                  type="time"
                  value={editForm.checkInTime}
                  onChange={(event) => handleEditFieldChange("checkInTime", event.target.value)}
                  disabled={editSaving}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Photos (up to 7)</Label>
                  <span className="text-xs text-slate-500">{editGallery.length}/7 uploaded</span>
                </div>
                <div className="flex flex-wrap gap-3">
                {editGallery.length === 0 && (
                  <p className="text-xs text-slate-500">Add at least one photo so renters can see your couch.</p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {editGallery.map((photoUrl, index) => (
                    <div
                      key={photoUrl}
                      className="relative h-20 w-full cursor-move overflow-hidden rounded-xl border"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", index.toString());
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                        const toIndex = index;
                        if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) {
                          return;
                        }
                        setEditGallery((prev) => {
                          const next = [...prev];
                          const [moved] = next.splice(fromIndex, 1);
                          next.splice(toIndex, 0, moved);
                          return next;
                        });
                      }}
                    >
                      <img src={photoUrl} alt="Listing gallery" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-[10px] font-semibold text-slate-700 shadow"
                        onClick={() => handleRemoveGalleryImage(photoUrl)}
                        disabled={editSaving}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                </div>
                <div
                  className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-center"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleGalleryDrop}
                >
                  <p className="text-sm font-semibold text-slate-700">Drag and drop photos here</p>
                  <p className="text-xs text-slate-500">or click to browse files (PNG/JPG)</p>
                  <Input
                    id="edit-photos"
                    type="file"
                    accept="image/*"
                    multiple
                    className="mt-2 cursor-pointer"
                    disabled={editSaving || editGallery.length >= 7}
                    onChange={(event) => handleEditGalleryFilesChange(event.target.files)}
                  />
                </div>
                {editGalleryFiles.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Ready to upload: {editGalleryFiles.map((file) => file.name).join(", ")}
                  </p>
                )}
                <p className="text-xs text-slate-500">Upload up to 7 photos. Drag tiles to reorder; the first one becomes your cover image.</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeEditDialog} disabled={editSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Select a listing to edit.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

};

export default CouchListings;
