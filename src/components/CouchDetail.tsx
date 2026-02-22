import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar as CalendarIcon, User, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { DateRange } from "react-day-picker";
import { differenceInCalendarDays, endOfDay, format, isAfter, isBefore, startOfDay } from "date-fns";
import { createBookingRequest } from "@/lib/bookings";
import { fetchListingHost } from "@/lib/listings";
import { fetchUserProfileById } from "@/lib/users";
import { fetchDirectMessages, sendDirectMessage, type DirectMessageRecord } from "@/lib/directMessages";
import { supabase } from "@/lib/supabaseClient";
import couch1 from "@/assets/couch1.jpg";
import couch2 from "@/assets/couch2.jpg";
import couch3 from "@/assets/couch3.jpg";
import couch4 from "@/assets/couch4.jpg";
import couch5 from "@/assets/couch5.jpg";
import couch6 from "@/assets/couch6.jpg";
import {
  addToWishlist,
  deriveUserKey,
  fetchWishlist,
  removeFromWishlist,
  resolveWishlistStorageId,
} from "@/lib/wishlist";
import { buildWishlistSnapshot } from "@/lib/wishlistSnapshot";

interface AvailabilityWindow {
  start: string;
  end: string;
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
}

interface HostContext {
  hostId: string;
  hostName: string;
  hostEmail: string | null;
}

const HOST_PROGRAM_TYPE_LABELS: Record<string, string> = {
  bsc: "Bachelor (BSc)",
  msc: "Master (MSc)",
  phd: "Doctorate (PhD)",
  other: "Other program",
};

interface AvailabilityBounds {
  start: Date;
  end: Date;
}

const getAvailabilityBounds = (window?: AvailabilityWindow | null): AvailabilityBounds | null => {
  if (!window?.start || !window?.end) {
    return null;
  }

  const start = startOfDay(new Date(window.start));
  const end = endOfDay(new Date(window.end));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
};

const isRangeWithinBounds = (range: DateRange | undefined, bounds: AvailabilityBounds | null) => {
  if (!range?.from || !range?.to) {
    return false;
  }

  const today = startOfDay(new Date());
  const start = startOfDay(range.from);
  const end = endOfDay(range.to);

  if (isBefore(start, today)) {
    return false;
  }

  if (!bounds) {
    return true;
  }

  return !isBefore(start, bounds.start) && !isAfter(end, bounds.end);
};

const isDateUnavailable = (date: Date, bounds: AvailabilityBounds | null) => {
  const normalized = startOfDay(date);
  const today = startOfDay(new Date());
  if (isBefore(normalized, today)) {
    return true;
  }
  if (!bounds) {
    return false;
  }
  return isBefore(normalized, bounds.start) || isAfter(normalized, bounds.end);
};

const fallbackImages = [couch1, couch2, couch3, couch4, couch5, couch6];

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

const sanitizePrice = (value?: string | null) => {
  if (!value) return "$0";
  const trimmed = value.trim();
  if (!trimmed) return "$0";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
};

const toUuidOrNull = (value: string | null | undefined) => {
  if (!value) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : null;
};

const CouchDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id: string }>();
  const couchFromState = location.state?.couch as CouchListing | undefined;
  const { toast } = useToast();
  const { profile, session } = useAuth();
  const userKey = deriveUserKey(profile, session);

  const [stayRange, setStayRange] = useState<DateRange | undefined>();
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [couchData, setCouchData] = useState<CouchListing | null>(couchFromState ?? null);
  const [loadingCouch, setLoadingCouch] = useState(!couchFromState);
  const [couchError, setCouchError] = useState<string | null>(null);
  const [hostContext, setHostContext] = useState<HostContext | null>(null);
  const [hostProfile, setHostProfile] = useState<{
    name: string;
    role: string | null;
    university: string | null;
    programName: string | null;
    programType: string | null;
    programYear: number | null;
    avatarUrl: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistSyncing, setWishlistSyncing] = useState(false);
  const [wishlistUpdating, setWishlistUpdating] = useState(false);
  const [showFullLocation, setShowFullLocation] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const couch = couchData;
  const availabilityBounds = couch ? getAvailabilityBounds(couch.availability) : null;
  const rangeSelected = stayRange?.from && stayRange?.to;
  const selectionValid = rangeSelected ? isRangeWithinBounds(stayRange, availabilityBounds) : false;
  const nights = rangeSelected
    ? Math.max(1, differenceInCalendarDays(startOfDay(stayRange.to!), startOfDay(stayRange.from)))
    : 0;

  const getHostContext = useCallback(async (): Promise<HostContext> => {
    if (hostContext?.hostId) {
      return hostContext;
    }

    if (!couch) {
      throw new Error("Listing details are not available yet.");
    }

    const fallbackName = couch.host ?? "Host";
    const fallbackEmail = couch.hostEmail ?? null;

    const resolvedHostId = toUuidOrNull(couch.hostId ?? null);
    if (resolvedHostId) {
      return {
        hostId: resolvedHostId,
        hostName: fallbackName,
        hostEmail: fallbackEmail,
      };
    }

    const listing = await fetchListingHost({
      listingId: couch.id,
      hostEmail: fallbackEmail,
      hostName: fallbackName,
    });

    if (listing?.hostId) {
      const normalizedHostId = toUuidOrNull(listing.hostId);
      if (normalizedHostId) {
        return {
          hostId: normalizedHostId,
          hostName: listing.hostName ?? fallbackName,
          hostEmail: listing.hostEmail ?? fallbackEmail,
        };
      }
    }

    throw new Error("Unable to determine host details for this listing.");
  }, [couch, hostContext]);

  useEffect(() => {
    if (couchFromState) {
      setCouchData(couchFromState);
      setLoadingCouch(false);
      return;
    }

    const listingId = params.id;
    if (!listingId) {
      setCouchError("Missing listing identifier.");
      setLoadingCouch(false);
      return;
    }

    let active = true;

    const loadListing = async () => {
      try {
        setLoadingCouch(true);
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, user_id, host_name, host_email, address, property_type, price_per_night, check_in_time, availability_start, availability_end, photos, documents, created_at"
          )
          .eq("id", listingId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error("Listing not found.");
        }

        const availabilityRange = data.availability_start && data.availability_end
          ? {
              start: data.availability_start,
              end: data.availability_end,
            }
          : null;

        const photos = Array.isArray(data.photos) ? data.photos : [];
        const image = photos[0] ?? fallbackImages[0];

        const fallbackTitle = data.property_type
          ? `${data.property_type === "house" ? "House" : "Flat"} couch`
          : "Community couch";

        const mapped: CouchListing = {
          id: data.id,
          image,
          price: sanitizePrice(data.price_per_night ? String(data.price_per_night) : "$0"),
          title: fallbackTitle,
          host: data.host_name ?? "Community host",
          hostEmail: data.host_email ?? null,
          location: data.address ?? "Address shared after booking",
          country: null,
          city: null,
          addressLine: data.address ?? null,
          availableDates: availabilityRange
            ? formatAvailabilityWindow(availabilityRange)
            : data.check_in_time
              ? `Check-in after ${data.check_in_time}`
              : "Flexible availability",
          description: data.created_at
            ? `Listing published on ${new Date(data.created_at).toLocaleDateString()}`
            : "Listing added by our host community.",
          hostId: data.user_id ?? null,
          availability: availabilityRange,
          coordinates: null,
          gallery: photos.length ? photos : image ? [image] : [],
        };

        if (active) {
          setCouchData(mapped);
          setCouchError(null);
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to load listing.";
        setCouchError(message);
        setCouchData(null);
      } finally {
        if (active) {
          setLoadingCouch(false);
        }
      }
    };

    loadListing();

    return () => {
      active = false;
    };
  }, [couchFromState, params.id]);

  useEffect(() => {
    if (couchError) {
      toast({ title: "Listing unavailable", description: couchError, variant: "destructive" });
    }
  }, [couchError, toast]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    let active = true;
    const syncWishlist = async () => {
      if (!userKey || !couch?.id) {
        if (active) {
          setIsWishlisted(false);
        }
        return;
      }
      setWishlistSyncing(true);
      try {
        const items = await fetchWishlist(userKey);
        if (!active) return;
        const storageId = resolveWishlistStorageId(couch.id);
        const hasItem = items.some((item) => item.couchId === couch.id || item.storageId === storageId);
        setIsWishlisted(hasItem);
      } catch (error) {
        if (active) {
          console.warn("Unable to sync wishlist state", error);
          setIsWishlisted(false);
        }
      } finally {
        if (active) {
          setWishlistSyncing(false);
        }
      }
    };

    syncWishlist();
    const handler = () => syncWishlist();
    window.addEventListener("wishlist-updated", handler);
    return () => {
      active = false;
      window.removeEventListener("wishlist-updated", handler);
    };
  }, [couch?.id, userKey]);

  useEffect(() => {
    if (!couch) return;

    let active = true;

    const loadHostAndMessages = async () => {
      try {
        const context = await getHostContext();

        if (!active) return;
        setHostContext(context);

        try {
          const profileRecord = await fetchUserProfileById(context.hostId);
          if (!active) return;
          setHostProfile({
            name: profileRecord?.full_name?.trim()
              ? profileRecord.full_name
              : profileRecord?.email ?? context.hostName,
            role: profileRecord?.user_role ?? null,
            university: profileRecord?.university ?? null,
            programName: profileRecord?.program_name ?? null,
            programType: profileRecord?.program_type ?? null,
            programYear: profileRecord?.program_year ?? null,
            avatarUrl: profileRecord?.avatar_url ?? null,
          });
        } catch (profileError) {
          console.warn("Failed to fetch host profile", profileError);
          if (active) {
            setHostProfile({
              name: context.hostName,
              role: null,
              university: null,
              programName: null,
              programType: null,
              programYear: null,
              avatarUrl: null,
            });
          }
        }

        if (!profile?.id) {
          return;
        }

        setMessagesLoading(true);
        const data = await fetchDirectMessages(profile.id, context.hostId);
        if (!active) return;
        setMessages(data);
        setMessagesError(null);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to load conversation.";
        setMessagesError(message);
      } finally {
        if (active) {
          setMessagesLoading(false);
        }
      }
    };

    loadHostAndMessages();

    return () => {
      active = false;
    };
  }, [couch, profile?.id, getHostContext]);

  useEffect(() => {
    if (!profile?.id || !hostContext?.hostId) {
      return;
    }

    const channel = supabase
      .channel(`direct-messages-${profile.id}-${hostContext.hostId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const record = payload.new as DirectMessageRecord;
          if (
            (record.sender_id === profile.id && record.receiver_id === hostContext.hostId)
            || (record.sender_id === hostContext.hostId && record.receiver_id === profile.id)
          ) {
            setMessages((prev) => {
              if (prev.some((message) => message.id === record.id)) {
                return prev;
              }
              return [...prev, record];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, hostContext?.hostId]);

  if (loadingCouch) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading listing…</p>
      </main>
    );
  }

  if (!couch) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold">Listing not available</h1>
          <p className="text-muted-foreground text-sm">
            {couchError ?? "We couldn't find that couch."}
          </p>
          <Button variant="outline" onClick={() => navigate("/listings", { replace: true })}>
            Back to listings
          </Button>
        </div>
      </main>
    );
  }

  const MAX_LOCATION_PREVIEW_LENGTH = 80;
  const locationNeedsToggle = couch.location.length > MAX_LOCATION_PREVIEW_LENGTH;
  const locationDisplay =
    locationNeedsToggle && !showFullLocation
      ? `${couch.location.slice(0, MAX_LOCATION_PREVIEW_LENGTH).trimEnd()}…`
      : couch.location;
  const renderLocationToggle = (variant: "light" | "dark") => {
    if (!locationNeedsToggle) {
      return null;
    }
    const baseClass =
      variant === "light"
        ? "text-xs font-semibold text-white underline underline-offset-4"
        : "text-xs font-semibold text-sketch-blue underline underline-offset-4";
    return (
      <button
        type="button"
        className={`ml-2 ${baseClass}`}
        onClick={() => setShowFullLocation((prev) => !prev)}
      >
        {showFullLocation ? "Hide full address" : "Show full address"}
      </button>
    );
  };

  const handleRequestBooking = async () => {
    if (!stayRange?.from || !stayRange?.to) {
      toast({
        title: "Select stay dates",
        description: "Pick your check-in and check-out dates before requesting a booking.",
        variant: "destructive",
      });
      return;
    }

    if (!isRangeWithinBounds(stayRange, availabilityBounds)) {
      toast({
        title: "Dates unavailable",
        description: "Please choose dates within the host's availability window.",
        variant: "destructive",
      });
      return;
    }

    if (!profile?.id) {
      toast({
        title: "Sign in required",
        description: "Sign in to request a booking.",
        variant: "destructive",
      });
      return;
    }

    const today = startOfDay(new Date());
    const normalizedStart = startOfDay(stayRange.from);
    if (isBefore(normalizedStart, today)) {
      toast({
        title: "Choose future dates",
        description: "Bookings can only be requested for future stays.",
        variant: "destructive",
      });
      return;
    }

    setBookingSubmitting(true);

    const stayStartIso = startOfDay(stayRange.from).toISOString();
    const stayEndIso = endOfDay(stayRange.to).toISOString();

    try {
      const context = hostContext ?? (await fetchListingHost({
        listingId: couch.id,
        hostEmail: couch.hostEmail ?? null,
        hostName: couch.host,
      }));

      if (!context || !context.hostId) {
        throw new Error("We couldn't find a host for this listing. Try refreshing the listings page.");
      }

      const hostDetails = hostContext ?? {
        hostId: context.hostId,
        hostName: context.hostName ?? couch.host ?? "Host",
        hostEmail: context.hostEmail ?? couch.hostEmail ?? null,
      };

      const normalizedProfileId = profile.id?.trim();
      const normalizedHostId = hostDetails.hostId?.trim();
      if (normalizedProfileId && normalizedHostId && normalizedProfileId === normalizedHostId) {
        toast({
          title: "This is your couch",
          description: "Hosts can't request bookings for their own listings.",
          variant: "destructive",
        });
        return;
      }

      if (!hostContext) {
        setHostContext(hostDetails);
      }

      await createBookingRequest({
        couchId: couch.id,
        couchTitle: couch.title,
        hostId: hostDetails.hostId,
        hostName: hostDetails.hostName,
        hostEmail: hostDetails.hostEmail ?? undefined,
        renterId: toUuidOrNull(profile.id),
        renterName: profile.full_name ?? profile.email ?? "Guest renter",
        stayStart: stayStartIso,
        stayEnd: stayEndIso,
        nights,
        pricePerNight: couch.price,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      toast({
        title: "Booking request sent",
        description: "We'll share your booking request with the host.",
      });
      setStayRange(undefined);
    } catch (error) {
      console.error("Failed to create booking request", error);
      toast({
        title: "Request failed",
        description:
          error instanceof Error ? error.message : "We couldn't share your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleSendDirectMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!profile?.id) {
      setMessagesError("Sign in to message the host.");
      return;
    }

    let context = hostContext;
    if (!context) {
      const listing = await fetchListingHost({
        listingId: couch.id,
        hostEmail: couch.hostEmail ?? null,
        hostName: couch.host,
      });

      if (!listing || !listing.hostId) {
        setMessagesError("Unable to load host details.");
        return;
      }

      context = {
        hostId: listing.hostId,
        hostName: listing.hostName ?? couch.host ?? "Host",
        hostEmail: listing.hostEmail ?? couch.hostEmail ?? null,
      };
      setHostContext(context);
    }

    if (!context) {
      return;
    }

    if (profile.id === context.hostId) {
      setMessagesError("You cannot message yourself as the host.");
      return;
    }

    const content = messageDraft.trim();
    if (!content) {
      setMessagesError("Please enter a message.");
      return;
    }

    setSendingMessage(true);
    setMessagesError(null);

    try {
      const created = await sendDirectMessage(profile.id, context.hostId, content);
      if (created) {
        setMessages((prev) => [...prev, created]);
      }
      setMessageDraft("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message.";
      setMessagesError(message);
    } finally {
      setSendingMessage(false);
    }
  };

  const selectedRangeLabel = rangeSelected
    ? `${format(stayRange.from!, "MMM d, yyyy")} → ${format(stayRange.to!, "MMM d, yyyy")}`
    : "Select stay dates";
  const checkInDisplay = stayRange?.from ? format(stayRange.from, "EEE, MMM d") : "Pick a start date";
  const checkOutDisplay = stayRange?.to
    ? format(stayRange.to, "EEE, MMM d")
    : stayRange?.from
      ? "Select an end date"
      : "Pick an end date";
  const nightsDisplay = selectionValid ? `${nights}` : "—";
  const hostDisplayName = hostProfile?.name?.trim() ? hostProfile.name : couch.host;
  const hostInitial = hostDisplayName ? hostDisplayName.charAt(0).toUpperCase() : "H";
  const hostRoleLabel = hostProfile?.role ?? "Community host";
  const hostAvatarUrl = hostProfile?.avatarUrl ?? null;
  const hostUniversity = hostProfile?.university ?? null;
  const hostProgramName = hostProfile?.programName ?? null;
  const hostProgramTypeLabel = hostProfile?.programType
    ? HOST_PROGRAM_TYPE_LABELS[hostProfile.programType] ?? hostProfile.programType
    : null;
  const hostProgramYearLabel = hostProfile?.programYear ? `Year ${hostProfile.programYear}` : null;
  const listingAvailability = couch.availability;
  const galleryImages = useMemo(() => {
    if (!couch) return [];
    if (Array.isArray(couch.gallery) && couch.gallery.length) {
      return couch.gallery;
    }
    const availabilityPhotos = (couch as { availability?: { photos?: string[] | null } }).availability?.photos;
    if (Array.isArray(availabilityPhotos) && availabilityPhotos.length) {
      return availabilityPhotos;
    }
    return couch.image ? [couch.image] : [];
  }, [couch]);
  const hasMultiplePhotos = galleryImages.length > 1;
  const currentPhoto = galleryImages[activePhotoIndex] ?? couch?.image ?? couch1;
  useEffect(() => {
    setActivePhotoIndex(0);
  }, [couch?.id, galleryImages.length]);
  const showPrevPhoto = useCallback(() => {
    setActivePhotoIndex((prev) => {
      if (!galleryImages.length) return 0;
      return (prev - 1 + galleryImages.length) % galleryImages.length;
    });
  }, [galleryImages.length]);
  const showNextPhoto = useCallback(() => {
    setActivePhotoIndex((prev) => {
      if (!galleryImages.length) return 0;
      return (prev + 1) % galleryImages.length;
    });
  }, [galleryImages.length]);
  const canMessageHost = Boolean(hostContext?.hostId && profile?.id && profile.id !== hostContext.hostId);
  const viewingOwnListing = Boolean(hostContext?.hostId && profile?.id && profile.id === hostContext.hostId);
  const resetStayRange = () => setStayRange(undefined);
  const handleWishlistToggle = async () => {
    if (!couch) return;
    if (!userKey) {
      toast({
        title: "Sign in to save couches",
        description: "Create an account or sign in to keep a wishlist.",
        variant: "destructive",
      });
      return;
    }

    setWishlistUpdating(true);
    try {
      if (isWishlisted) {
        await removeFromWishlist(userKey, couch.id);
        setIsWishlisted(false);
        toast({
          title: "Removed from wishlist",
          description: `${couch.title} is no longer saved.`,
        });
      } else {
        await addToWishlist(userKey, couch.id, buildWishlistSnapshot(couch));
        setIsWishlisted(true);
        toast({
          title: "Saved to wishlist",
          description: `${couch.title} was added for later.`,
        });
      }
    } catch (error) {
      console.error("Wishlist update failed", error);
      toast({
        title: "Unable to update wishlist",
        description: "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setWishlistUpdating(false);
    }
  };

  return (
    <main className="dreamy-bg min-h-screen">
      <header className="border-b border-sketch/70 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/listings")}
            className="rounded-full border border-transparent hover:border-sketch/70"
          >
            <ArrowLeft className="h-5 w-5 text-sketch-blue" />
            <span className="sr-only">Back to listings</span>
          </Button>
          <p className="hidden text-sm text-muted-foreground sm:block">Browse more community couches</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section className="overflow-hidden rounded-[32px] border-2 border-sketch bg-white shadow-[0_25px_80px_rgba(30,64,175,0.12)]">
          <div className="relative h-[260px] sm:h-[360px]">
            <img src={currentPhoto} alt={couch.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            {hasMultiplePhotos && (
              <>
                <button
                  type="button"
                  onClick={showPrevPhoto}
                  className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/50 bg-white/70 p-2 text-slate-700 shadow-md transition hover:bg-white sm:flex"
                >
                  <span className="sr-only">Previous photo</span>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={showNextPhoto}
                  className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/50 bg-white/70 p-2 text-slate-700 shadow-md transition hover:bg-white sm:flex"
                >
                  <span className="sr-only">Next photo</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white">
                  <span>Photo {activePhotoIndex + 1}</span>
                  <span className="opacity-70">/ {galleryImages.length}</span>
                </div>
              </>
            )}
            <div className="absolute right-5 top-5 flex gap-2">
              <button
                type="button"
                onClick={handleWishlistToggle}
                disabled={wishlistUpdating || wishlistSyncing}
                className={`rounded-full border border-white/50 bg-black/30 p-3 text-white backdrop-blur transition hover:bg-black/50 ${
                  isWishlisted ? "text-rose-400" : ""
                }`}
              >
                <Heart className={`h-5 w-5 ${isWishlisted ? "fill-rose-400" : ""}`} />
                <span className="sr-only">{isWishlisted ? "Remove from wishlist" : "Save to wishlist"}</span>
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 space-y-6 px-6 pb-6 pt-10 text-white sm:px-10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Community stay</p>
                  <h1 className="text-3xl font-semibold sm:text-4xl">{couch.title}</h1>
                </div>
                <div className="text-4xl font-bold">
                  {couch.price}
                  <span className="ml-1 text-sm font-normal text-white/80">/night</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-1.5 font-medium backdrop-blur">
                  <MapPin className="h-4 w-4" />
                  <span className="flex items-center gap-2">
                    {locationDisplay}
                    {renderLocationToggle("light")}
                  </span>
                </div>
                {hostDisplayName && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-1.5 font-medium backdrop-blur">
                    <User className="h-4 w-4" />
                    Hosted by {hostDisplayName}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.7fr,1fr]">
          <section className="space-y-6">
            <div className="space-y-6 rounded-[28px] border-2 border-sketch bg-white/95 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border border-sketch/30">
                    <AvatarImage
                      src={hostAvatarUrl ?? undefined}
                      alt={`${hostDisplayName} profile photo`}
                      className="h-full w-full object-cover"
                    />
                    <AvatarFallback className="bg-sketch-blue/10 text-xl font-semibold text-sketch-blue">
                      {hostInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Host</p>
                    <p className="text-xl font-semibold text-sketch-dark">{hostDisplayName}</p>
                    {hostRoleLabel && <p className="text-sm text-muted-foreground">{hostRoleLabel}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Location</p>
                <p className="text-base font-semibold text-sketch-dark">
                  {locationDisplay}
                  {renderLocationToggle("dark")}
                </p>
                <p className="text-xs text-muted-foreground">Exact address shared after booking</p>
              </div>
              <div className="rounded-2xl border border-dashed border-sketch/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
                <p className="text-lg font-semibold text-sketch-dark">{couch.price}</p>
                <p className="mt-1 text-xs text-muted-foreground">Per night</p>
              </div>
              {(hostUniversity || hostProgramName || hostProgramTypeLabel) && (
                <div className="rounded-2xl border border-dashed border-sketch/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Student profile</p>
                  <p className="text-lg font-semibold text-sketch-dark">
                    {hostUniversity ?? "University not shared yet"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hostProgramName ?? "Program details coming soon"}
                    {hostProgramTypeLabel && ` • ${hostProgramTypeLabel}`}
                    {hostProgramYearLabel && ` • ${hostProgramYearLabel}`}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border-2 border-sketch bg-white p-6 space-y-3">
              <h3 className="text-lg font-semibold text-sketch-dark">About this couch</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{couch.description}</p>
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-5 rounded-[28px] border-2 border-sketch bg-white p-6 shadow-lg shadow-sketch-blue/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Request a stay</p>
                  <h3 className="text-2xl font-semibold text-sketch-dark">Plan your visit</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectionValid && rangeSelected ? `${nights} night${nights === 1 ? "" : "s"}` : "Flexible"}
                </p>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <p>Select a start and end date for your stay.</p>
                {rangeSelected && (
                  <button
                    type="button"
                    onClick={resetStayRange}
                    className="text-xs font-medium uppercase tracking-wide text-sketch-blue hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div className="sm:hidden">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between text-left font-normal">
                        <span className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {selectedRangeLabel}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="p-0">
                      <DatePicker
                        initialFocus
                        mode="range"
                        numberOfMonths={1}
                        selected={stayRange}
                        onSelect={setStayRange}
                        disabled={(date) => isDateUnavailable(date, availabilityBounds)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="hidden rounded-2xl border border-dashed border-sketch/60 bg-muted/40 p-3 sm:block">
                      <DatePicker
                        initialFocus
                        mode="range"
                        numberOfMonths={2}
                        selected={stayRange}
                        onSelect={setStayRange}
                        disabled={(date) => isDateUnavailable(date, availabilityBounds)}
                      />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-dashed border-sketch/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-in</p>
                  <p className="text-base font-semibold text-sketch-dark">{checkInDisplay}</p>
                </div>
                <div className="rounded-2xl border border-dashed border-sketch/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-out</p>
                  <p className="text-base font-semibold text-sketch-dark">{checkOutDisplay}</p>
                </div>
                <div className="rounded-2xl border border-dashed border-sketch/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nights</p>
                  <p className="text-3xl font-semibold text-sketch-dark">{nightsDisplay}</p>
                </div>
              </div>

              {rangeSelected && selectionValid && (
                <div className="rounded-2xl bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                  You're requesting {nights} night{nights === 1 ? "" : "s"} from {format(stayRange.from!, "MMM d")} to {format(stayRange.to!, "MMM d")}.
                </div>
              )}

              {rangeSelected && !selectionValid && (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  The selected dates are outside the host's availability.
                </div>
              )}

              <Button
                className="w-full rounded-full text-base font-semibold"
                size="lg"
                onClick={handleRequestBooking}
                disabled={!selectionValid || bookingSubmitting}
              >
                {bookingSubmitting ? "Sending request..." : "Request booking"}
              </Button>
            </div>

            <section className="space-y-4 rounded-[28px] border-2 border-sketch bg-white p-6">
              <header className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Chat with {hostDisplayName}</p>
                <h3 className="text-xl font-semibold text-sketch-dark">Coordinate details</h3>
                <p className="text-sm text-muted-foreground">
                  Start a direct conversation with the host to make sure the stay fits what you need.
                </p>
              </header>

              {!hostContext?.hostId && (
                <p className="text-sm text-muted-foreground">Messaging is unavailable for this listing.</p>
              )}

              {viewingOwnListing && (
                <p className="text-sm text-muted-foreground">
                  You are viewing your own listing. Guests will be able to message you here.
                </p>
              )}

              {canMessageHost && (
                <div className="space-y-4">
                  <div className="h-64 space-y-3 overflow-y-auto rounded-2xl border border-dashed border-sketch/60 bg-muted/40 p-3">
                    {messagesLoading && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
                    {!messagesLoading && messages.length === 0 && (
                      <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                    )}
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                          message.sender_id === profile.id
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "mr-auto bg-card"
                        }`}
                      >
                        <p className="whitespace-pre-line break-words">{message.content}</p>
                        <p className="mt-1 text-[11px] opacity-70">
                          {format(new Date(message.created_at), "MMM d, yyyy · h:mm a")}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendDirectMessage} className="space-y-2">
                    <Textarea
                      value={messageDraft}
                      onChange={(event) => {
                        setMessageDraft(event.target.value);
                        if (messagesError) setMessagesError(null);
                      }}
                      placeholder="Write a message to the host"
                      rows={3}
                    />
                    {messagesError && <p className="text-sm text-destructive">{messagesError}</p>}
                    <Button type="submit" disabled={sendingMessage || !messageDraft.trim()}>
                      {sendingMessage ? "Sending…" : "Send message"}
                    </Button>
                  </form>
                </div>
              )}

              {!profile?.id && hostContext?.hostId && !viewingOwnListing && (
                <p className="text-sm text-destructive">Sign in to start a conversation with this host.</p>
              )}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
};

export default CouchDetail;
