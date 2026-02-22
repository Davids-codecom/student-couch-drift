import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  deriveUserKey,
  fetchWishlist,
  removeFromWishlist,
  type WishlistItem,
} from "@/lib/wishlist";
import { Calendar as CalendarIcon, Heart, MapPin } from "lucide-react";
import couchFallback from "@/assets/couch1.jpg";

const Wishlist = () => {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const userKey = deriveUserKey(profile, session);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const items = await fetchWishlist(userKey);
        setWishlist(items);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handler = () => {
      if (userKey) {
        fetchWishlist(userKey).then(setWishlist).catch(() => {});
      }
    };
    window.addEventListener("wishlist-updated", handler);
    return () => window.removeEventListener("wishlist-updated", handler);
  }, [userKey]);

  const removeItem = async (item: WishlistItem) => {
    if (!userKey) return;
    setWishlist((prev) => prev.filter((entry) => entry.couchId !== item.couchId));
    try {
      await removeFromWishlist(userKey, item.couchId);
    } catch (error) {
      console.error("Failed to remove wishlist item", error);
      toast({
        title: "Couldn't remove",
        description: "Please try again.",
        variant: "destructive",
      });
      setWishlist((prev) => [item, ...prev]);
    }
  };

  const normalizedWishlist = useMemo(() => {
    return wishlist
      .map((item) => {
        const snapshot = item.snapshot ?? {
          id: item.couchId,
          image: couchFallback,
          price: "$0",
          title: "Saved couch",
          host: "Community host",
          hostEmail: null,
          location: "Location shared after booking",
          availableDates: "Flexible availability",
          description: "",
          hostId: null,
          availability: null,
          coordinates: null,
        };
        return {
          ...item,
          snapshot: {
            ...snapshot,
            id: snapshot.id ?? item.couchId,
            image: snapshot.image || couchFallback,
            title: snapshot.title || "Saved couch",
            price: snapshot.price || "$0",
            host: snapshot.host || "Community host",
            location: snapshot.location || "Location shared after booking",
            availableDates: snapshot.availableDates || "Flexible availability",
            description: snapshot.description ?? "",
          },
        };
      })
      .filter((item) => Boolean(item.snapshot?.id));
  }, [wishlist]);

  const emptyState = useMemo(() => !loading && normalizedWishlist.length === 0, [loading, normalizedWishlist]);

  if (!userKey) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Sign in to build your wishlist.</p>
        <Button onClick={() => navigate("/auth")}>Go to sign in</Button>
      </main>
    );
  }

  const renderSkeletons = () => (
    <div className="grid gap-6 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`wishlist-skeleton-${index}`}
          className="animate-pulse rounded-[2rem] border border-white/70 bg-white/60 p-4 shadow-lg shadow-blue-100/30"
        >
          <div className="h-48 rounded-2xl bg-slate-200" />
          <div className="mt-4 h-4 rounded bg-slate-200" />
          <div className="mt-2 h-3 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="rounded-[2.5rem] border border-dashed border-white/70 bg-white/70 p-10 text-center shadow-xl shadow-blue-100/50">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500">
        <Heart className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-900">Start building your wishlist</h2>
      <p className="mt-2 text-sm text-slate-500">
        Tap the heart icon on any couch to keep it handy. We’ll sync them across all your devices.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button className="rounded-full px-6" onClick={() => navigate("/listings")}>
          Browse calming couches
        </Button>
        <Button variant="outline" className="rounded-full px-6" onClick={() => navigate("/profile")}>
          Update profile
        </Button>
      </div>
    </div>
  );

  return (
    <main className="dreamy-bg min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-[2.5rem] border border-white/60 bg-white/85 p-6 backdrop-blur-lg shadow-2xl shadow-blue-100/50">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.5em] text-slate-500">Collection</p>
            <h1 className="text-3xl font-semibold text-slate-900">Your wishlist</h1>
            <p className="text-sm text-slate-500">
              Save cozy couches as you browse. You can come back anytime to compare and decide.
            </p>
          </div>
          <div className="mt-6">
            <Button
              variant="outline"
              className="rounded-full border-white/70 bg-white/90"
              onClick={() => navigate("/profile")}
            >
              Update profile
            </Button>
          </div>
        </section>

        {loading && renderSkeletons()}
        {emptyState && !loading && renderEmptyState()}

        {!loading && normalizedWishlist.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2">
            {normalizedWishlist.map((item) => (
              <Card
                key={item.id}
                className="group relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/95 shadow-2xl shadow-blue-100/40 transition hover:-translate-y-1.5"
              >
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-rose-500 shadow"
                >
                  <Heart className="h-5 w-5 fill-rose-500" />
                  <span className="sr-only">Remove from wishlist</span>
                </button>
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={item.snapshot.image}
                    alt={item.snapshot.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0" />
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 pb-4 text-white">
                    <div>
                      <p className="text-lg font-semibold">{item.snapshot.price}</p>
                      <p className="text-xs text-white/70">{item.snapshot.host}</p>
                    </div>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">
                      Saved couch
                    </span>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{item.snapshot.title}</h3>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                      <MapPin className="h-4 w-4" />
                      {item.snapshot.location}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      <CalendarIcon className="h-3 w-3" /> {item.snapshot.availableDates}
                    </span>
                    {item.snapshot.description && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                        {item.snapshot.description.slice(0, 32)}
                        {item.snapshot.description.length > 32 ? "…" : ""}
                      </span>
                    )}
                  </div>
                  <Button
                    className="flex-1 rounded-full"
                    onClick={() => navigate(`/couch/${item.snapshot.id}`, { state: { couch: item.snapshot } })}
                  >
                    View details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Wishlist;
