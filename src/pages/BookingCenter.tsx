import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  getBookingRequestsForRenter,
  type BookingRequestRecord,
} from "@/lib/bookings";
import { format } from "date-fns";
import { uploadCheckInPhoto, listCheckInPhotos } from "@/lib/checkins";

const statusColors: Record<BookingRequestStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  cancelled: "bg-muted text-muted-foreground",
};

const useCheckInPhotos = (bookingId: string) => {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const urls = await listCheckInPhotos(bookingId);
      setPhotos(urls);
    } catch (error) {
      console.warn("Failed to load check-in photos", error);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  return { photos, loading, refresh: load };
};

const CheckInPhotoGallery = ({
  photos,
  loading,
  emptyLabel,
}: {
  photos: string[];
  loading: boolean;
  emptyLabel: string;
}) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-sketch-dark">Check-in photos</p>
    {loading ? (
      <p className="text-xs text-muted-foreground">Loading check-in photos…</p>
    ) : photos.length === 0 ? (
      <p className="text-xs text-muted-foreground">{emptyLabel}</p>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        {photos.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-md border"
          >
            <img src={url} alt="Check-in" className="h-32 w-full object-cover" />
          </a>
        ))}
      </div>
    )}
  </div>
);

const RenterBookingCard = ({ request }: { request: BookingRequestRecord }) => {
  const { toast } = useToast();
  const { photos, loading, refresh } = useCheckInPhotos(request.id);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const stayStart = new Date(request.stayStart);
  const stayEnd = new Date(request.stayEnd);
  const approved = request.status === "approved";
  const hostLabel = useMemo(() => {
    const value = request.hostName?.trim();
    if (!value) return "Community host";
    const looksLikeEmail = /\S+@\S+\.\S+/.test(value);
    if (looksLikeEmail) {
      const first = value.split("@")[0].split(".")[0];
      return first.charAt(0).toUpperCase() + first.slice(1);
    }
    return value.split(" ")[0];
  }, [request.hostName]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      await uploadCheckInPhoto(request.id, file);
      toast({ title: "Photo uploaded", description: "Thanks for checking in!" });
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't upload that photo.";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-white/80 via-blue-50/80 to-white/70 p-4 shadow-sm shadow-blue-100/70 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sketch-dark">{request.couchTitle ?? "Couch request"}</h3>
        <Badge className={statusColors[request.status]}>{request.status.toUpperCase()}</Badge>
      </div>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>Host: {hostLabel}</p>
        <p>
          Stay: {format(stayStart, "MMM d, yyyy")} → {format(stayEnd, "MMM d, yyyy")}
        </p>
        <p className="text-xs">
          Requested {format(new Date(request.createdAt), "MMM d, yyyy h:mm a")}
        </p>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <p>{approved ? "Check-in photos available" : "Waiting for host approval"}</p>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-slate-600"
          onClick={() => setExpanded((prev) => !prev)}
        >
          Details
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && approved && (
        <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/40 p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-sketch-dark">Upload a check-in photo</p>
            <p className="text-xs text-muted-foreground">
              Snap a quick photo once you're at the couch. Hosts will see it instantly.
            </p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleUpload}
              disabled={uploading}
            />
            {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
          </div>

          <CheckInPhotoGallery
            photos={photos}
            loading={loading}
            emptyLabel="No check-in photos uploaded yet."
          />
        </div>
      )}

      {expanded && !approved && (
        <CheckInPhotoGallery
          photos={photos}
          loading={loading}
          emptyLabel="Check-in photos become available once the host approves your stay."
        />
      )}
    </div>
  );
};

const PAGE_SIZE = 4;

const BookingCenter = () => {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [renterRequests, setRenterRequests] = useState<BookingRequestRecord[]>([]);
  const [loadingRenter, setLoadingRenter] = useState(false);
  const [errorRenter, setErrorRenter] = useState<string | null>(null);
  const [visibleRenterCount, setVisibleRenterCount] = useState(PAGE_SIZE);

  const renterId = session?.user?.id ?? profile?.id ?? null;
  const isHost = profile?.user_role === "host";
  const profileIdentity = useMemo(() => [profile?.full_name ?? "", profile?.email ?? ""], [profile?.full_name, profile?.email]);

  const loadRenterRequests = useCallback(async () => {
    if (!renterId) {
      setRenterRequests([]);
      return;
    }
    setLoadingRenter(true);
    try {
      const requests = await getBookingRequestsForRenter(renterId, profileIdentity);
      setRenterRequests(requests);
      setVisibleRenterCount(PAGE_SIZE);
      setErrorRenter(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load requests.";
      setErrorRenter(message);
    } finally {
      setLoadingRenter(false);
    }
  }, [profileIdentity, renterId]);

  useEffect(() => {
    loadRenterRequests();
  }, [loadRenterRequests]);

  useEffect(() => {
    if (isHost) {
      navigate("/host-requests", { replace: true });
    }
  }, [isHost, navigate]);

  if (isHost) {
    return null;
  }

  const renterContent = useMemo(() => {
    if (!renterId) {
      return <p className="text-sm text-muted-foreground">Sign in as a renter to view your requests.</p>;
    }
    if (loadingRenter) {
      return <p className="text-sm text-muted-foreground">Loading your requests…</p>;
    }
    if (errorRenter) {
      return <p className="text-sm text-destructive">{errorRenter}</p>;
    }
    if (!renterRequests.length) {
      return <p className="text-sm text-muted-foreground">You have not submitted any booking requests yet.</p>;
    }
    const visibleRequests = renterRequests.slice(0, visibleRenterCount);
    const showMore = visibleRenterCount < renterRequests.length;
    return (
      <div className="space-y-3">
        {visibleRequests.map((request) => (
          <RenterBookingCard key={request.id} request={request} />
        ))}
        {showMore && (
          <div className="pt-2 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleRenterCount((prev) => Math.min(prev + PAGE_SIZE, renterRequests.length))}
            >
              Show more
            </Button>
          </div>
        )}
      </div>
    );
  }, [errorRenter, loadingRenter, renterId, renterRequests, visibleRenterCount]);

  const greeting = "Welcome back";

  return (
    <main className="dreamy-bg min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-4 rounded-2xl border bg-card/70 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">{greeting}</p>
              <h1 className="text-2xl font-bold text-sketch-dark">Reservations</h1>
              <p className="text-sm text-muted-foreground">Track every request and know when hosts approve your stay.</p>
            </div>
          </div>
        </header>

        <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-sketch-dark">Your bookings</h2>
              <p className="text-sm text-muted-foreground">Track every request and share check-in photos with hosts.</p>
            </div>
          </div>
          {renterContent}
        </section>

      </div>
    </main>
  );
};

export default BookingCenter;
