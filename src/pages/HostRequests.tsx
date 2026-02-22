import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelBookingRequestAsRenter,
  getBookingRequestsForHost,
  getBookingRequestsForRenter,
  updateBookingRequestStatus,
  type BookingRequestRecord,
  type BookingRequestStatus,
} from "@/lib/bookings";
import { format } from "date-fns";
import useRealtimeBookings from "@/hooks/useRealtimeBookings";
import { fetchListingsForHost } from "@/lib/listings";
import { uploadCheckInPhoto } from "@/lib/checkins";
import BookingPaymentDialog from "@/components/payments/BookingPaymentDialog";
import { createBookingPaymentIntent, type CreatePaymentIntentResponse } from "@/lib/payments";
import { getPaymentSummary, type PaymentSummary } from "@/lib/bookingPayments";

const STATUS_FILTERS: Array<{ label: string; value: BookingRequestStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Declined", value: "declined" },
  { label: "Cancelled", value: "cancelled" },
];

const STATUS_BADGE_STYLES: Record<BookingRequestStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

type ViewMode = "host" | "renter";
const PAGE_SIZE = 4;

type PaymentMutationVariables = {
  request: BookingRequestRecord;
  summary: PaymentSummary;
};

const HostRequests = () => {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const hostId = session?.user?.id ?? profile?.id ?? null;
  const renterId = session?.user?.id ?? profile?.id ?? null;

  const hostListingsQuery = useQuery({
    queryKey: ["host-requests-listings", hostId],
    queryFn: () => (hostId ? fetchListingsForHost(hostId) : []),
    enabled: Boolean(hostId),
    staleTime: 1000 * 30,
  });

  const hostListings = useMemo(() => hostListingsQuery.data ?? [], [hostListingsQuery.data]);

  const hostIdentifiers = useMemo(() => {
    const identifiers = new Set<string>();
    const addIdentifier = (value?: string | null) => {
      if (!value) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      identifiers.add(trimmed);
    };

    addIdentifier(profile?.full_name);
    if (profile?.full_name) {
      addIdentifier(profile.full_name.split(" ")[0]);
    }

    addIdentifier(profile?.email);
    if (profile?.email) {
      addIdentifier(profile.email.split("@")[0]);
    }

    hostListings.forEach((listing) => {
      addIdentifier(listing.hostName);
      addIdentifier(listing.hostEmail);
    });

    return Array.from(identifiers);
  }, [hostListings, profile?.email, profile?.full_name]);

  const hostCouchIds = useMemo(() => {
    const ids = new Set<string>();
    hostListings.forEach((listing) => {
      if (listing.id) {
        ids.add(listing.id);
      }
    });
    return Array.from(ids);
  }, [hostListings]);

  const hostIdentifierKey = hostIdentifiers.join("|");
  const hostCouchKey = hostCouchIds.join("|");

  const hostTokens = useMemo(
    () => hostIdentifiers.map((identifier) => identifier.toLowerCase()),
    [hostIdentifiers],
  );
  const hostCouchSet = useMemo(
    () => new Set(hostCouchIds.filter(Boolean)),
    [hostCouchIds],
  );

  const renterIdentifiers = useMemo(() => {
    const identifiers = new Set<string>();
    const addIdentifier = (value?: string | null) => {
      if (!value) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      identifiers.add(trimmed);
    };

    addIdentifier(profile?.full_name);
    if (profile?.full_name) {
      addIdentifier(profile.full_name.split(" ")[0]);
    }

    addIdentifier(profile?.email);
    if (profile?.email) {
      addIdentifier(profile.email.split("@")[0]);
    }

    return Array.from(identifiers);
  }, [profile?.email, profile?.full_name]);

  const renterIdentifierKey = renterIdentifiers.join("|");
  const renterTokens = useMemo(
    () => renterIdentifiers.map((identifier) => identifier.toLowerCase()),
    [renterIdentifiers],
  );

  const requestsQuery = useQuery({
    queryKey: ["host-manage-requests", hostId, hostIdentifierKey, hostCouchKey],
    queryFn: () => getBookingRequestsForHost(hostId, hostIdentifiers, hostCouchIds),
    enabled: Boolean(hostId || hostIdentifiers.length || hostCouchIds.length),
  });

  const renterRequestsQuery = useQuery({
    queryKey: ["host-manage-renter", renterId, renterIdentifierKey],
    queryFn: () => getBookingRequestsForRenter(renterId, renterIdentifiers),
    enabled: Boolean(renterId || renterIdentifiers.length),
  });

  const matchesHostBooking = useCallback(
    (request: BookingRequestRecord) => {
      const hostIdMatch = hostId && request.hostId && request.hostId === hostId;
      const hostName = (request.hostName ?? "").toLowerCase();
      const hostTokenMatch = hostTokens.some((token) => hostName.includes(token));
      const couchMatch = request.couchId ? hostCouchSet.has(request.couchId) : false;
      return Boolean(hostIdMatch || hostTokenMatch || couchMatch);
    },
    [hostId, hostTokens, hostCouchSet],
  );

  const matchesRenterBooking = useCallback(
    (request: BookingRequestRecord) => {
      const renterIdMatch = renterId && request.renterId && request.renterId === renterId;
      const renterName = (request.renterName ?? "").toLowerCase();
      const renterTokenMatch = renterTokens.some((token) => renterName.includes(token));
      return Boolean(renterIdMatch || renterTokenMatch);
    },
    [renterId, renterTokens],
  );

  useRealtimeBookings({
    queryKey: ["host-manage-requests", hostId, hostIdentifierKey, hostCouchKey],
    matcher: matchesHostBooking,
  });
  useRealtimeBookings({
    queryKey: ["host-manage-renter", renterId, renterIdentifierKey],
    matcher: matchesRenterBooking,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingRequestStatus }) =>
      updateBookingRequestStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["host-manage-requests", hostId, hostIdentifierKey, hostCouchKey],
      });
      toast({
        title: "Request updated",
        description: `Marked request as ${variables.status}.`,
      });
    },
    onError: (error) => {
      console.error("Failed to update booking request", error);
      const conflict = error instanceof Error
        && /approved for this listing during the selected dates/i.test(error.message);
      toast({
        title: conflict ? "Booking dates overlap" : "Update failed",
        description: conflict
          ? "Another reservation has already been approved for these dates. Choose a different request or adjust the stay."
          : "We couldn't change that booking request. Please try again.",
        variant: "destructive",
      });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBookingRequestAsRenter(id, renterId),
    onSuccess: (updated) => {
      queryClient.setQueryData<BookingRequestRecord[]>(
        ["host-manage-renter", renterId, renterIdentifierKey],
        (existing) =>
          Array.isArray(existing)
            ? existing.map((request) => (request.id === updated.id ? updated : request))
            : existing,
      );
      queryClient.setQueryData<BookingRequestRecord[]>(
        ["host-manage-requests", hostId, hostIdentifierKey, hostCouchKey],
        (existing) =>
          Array.isArray(existing)
            ? existing.map((request) => (request.id === updated.id ? updated : request))
            : existing,
      );
      toast({
        title: "Request cancelled",
        description: "This booking request was cancelled.",
      });
    },
    onError: (error) => {
      console.error("Failed to cancel booking request", error);
      toast({
        title: "Unable to cancel",
        description: "We couldn't cancel that request. Please refresh and try again.",
        variant: "destructive",
      });
    },
  });

  const paymentIntentMutation = useMutation<CreatePaymentIntentResponse, Error, PaymentMutationVariables>({
    mutationFn: async ({ request, summary }) => {
      if (request.paymentStatus === "paid") {
        throw new Error("This stay has already been paid for.");
      }

      if (request.paymentClientSecret && request.paymentStatus !== "expired") {
        return {
          clientSecret: request.paymentClientSecret,
          paymentDue: request.paymentDueAt ?? undefined,
        } satisfies CreatePaymentIntentResponse;
      }

      return createBookingPaymentIntent({
        bookingId: request.id,
        amount: summary.totalDue,
        renterEmail: profile?.email ?? null,
      });
    },
    onSuccess: (payload, variables) => {
      setPaymentDialogState({
        booking: variables.request,
        clientSecret: payload.clientSecret,
        amountLabel: variables.summary.amountLabel,
        paymentDueAt: payload.paymentDue ?? variables.request.paymentDueAt ?? null,
      });
      setPaymentDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ["host-manage-renter", renterId, renterIdentifierKey] });
      queryClient.invalidateQueries({ queryKey: ["booking-requests", renterId, renterIdentifierKey] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "We couldn't start checkout.";
      toast({ title: "Payment unavailable", description: message, variant: "destructive" });
    },
  });

const [statusFilter, setStatusFilter] = useState<BookingRequestStatus | "all">("pending");
const canViewHost = Boolean(hostId) && profile?.user_role === "host";
const [viewMode, setViewMode] = useState<ViewMode>(canViewHost ? "host" : "renter");
const [visibleCounts, setVisibleCounts] = useState<Record<ViewMode, number>>({
  host: PAGE_SIZE,
  renter: PAGE_SIZE,
});
const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
const [paymentDialogState, setPaymentDialogState] = useState<{
  booking: BookingRequestRecord | null;
  clientSecret: string | null;
  amountLabel: string;
  paymentDueAt: string | null;
}>({ booking: null, clientSecret: null, amountLabel: "", paymentDueAt: null });
  const [checkInUploading, setCheckInUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!canViewHost) {
      setViewMode("renter");
    }
  }, [canViewHost]);


  const viewModeOptions: Array<{ label: string; value: ViewMode }> = canViewHost
    ? [
        { label: "Received", value: "host" },
        { label: "Sent", value: "renter" },
      ]
    : [{ label: "Your requests", value: "renter" }];

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const hostOwnedRequests = useMemo(
    () =>
      requests.filter((request) => {
        const idMatch = hostId && request.hostId === hostId;
        const couchMatch = request.couchId ? hostCouchSet.has(request.couchId) : false;
        return Boolean(idMatch || couchMatch);
      }),
    [requests, hostCouchSet, hostId],
  );
  const renterRequests = useMemo(() => renterRequestsQuery.data ?? [], [renterRequestsQuery.data]);

  useEffect(() => {
    setVisibleCounts((prev) => ({
      ...prev,
      [viewMode]: PAGE_SIZE,
    }));
  }, [viewMode, statusFilter, hostOwnedRequests.length, renterRequests.length]);

  const filteredRequests = useMemo(() => {
    const source = viewMode === "host" ? hostOwnedRequests : renterRequests;
    if (statusFilter === "all") return source;
    return source.filter((request) => request.status === statusFilter);
  }, [hostOwnedRequests, renterRequests, statusFilter, viewMode]);

  const handleStatusChange = useCallback(
    (request: BookingRequestRecord, desiredStatus: BookingRequestStatus) => {
      if (viewMode !== "host") {
        if (desiredStatus !== "cancelled") {
          return;
        }
        if (request.status === "cancelled" || cancelMutation.isPending) {
          return;
        }
        cancelMutation.mutate(request.id);
        return;
      }

      if (request.status === "declined" && desiredStatus === "approved") {
        toast({
          title: "Can't approve a declined request",
          description: "Declined bookings stay closed. Ask the renter to submit a new request if plans change.",
        });
        return;
      }

      const nextStatus: BookingRequestStatus =
        request.status === "approved" && desiredStatus === "declined" ? "cancelled" : desiredStatus;

      if (request.status === nextStatus) return;
      updateMutation.mutate({ id: request.id, status: nextStatus });
    },
    [cancelMutation, toast, updateMutation, viewMode],
  );

  const handleRenterPayment = useCallback(
    (request: BookingRequestRecord) => {
      if (request.status !== "approved") {
        toast({
          title: "Host approval pending",
          description: "Your host needs to approve the stay before you can pay.",
        });
        return;
      }

      if (request.paymentStatus === "paid") {
        toast({ title: "Already paid", description: "Thanks! We've already received payment for this stay." });
        return;
      }

      if (request.paymentStatus === "expired") {
        toast({
          title: "Payment window expired",
          description: "Ask your host to re-approve the booking to reopen payment.",
          variant: "destructive",
        });
        return;
      }

      const summary = getPaymentSummary(request.pricePerNight ?? null, request.nights);
      if (!summary) {
        toast({
          title: "Payment unavailable",
          description: "We couldn't calculate the total for this stay yet. Please check with your host.",
          variant: "destructive",
        });
        return;
      }

      paymentIntentMutation.mutate({ request, summary });
    },
    [paymentIntentMutation, toast],
  );

  const handleCheckInUpload = useCallback(
    async (request: BookingRequestRecord, file: File | null) => {
      if (!file) {
        return;
      }
      setCheckInUploading((prev) => ({ ...prev, [request.id]: true }));
      try {
        await uploadCheckInPhoto(request.id, file);
        toast({ title: "Photo uploaded", description: "Check-in proof added." });
        queryClient.invalidateQueries({ queryKey: ["host-manage-requests", hostId, hostIdentifierKey, hostCouchKey] });
        queryClient.invalidateQueries({ queryKey: ["booking-requests", renterId, renterIdentifierKey] });
      } catch (error) {
        console.error("check-in upload failed", error);
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Unable to upload check-in photo",
          variant: "destructive",
        });
      } finally {
        setCheckInUploading((prev) => ({ ...prev, [request.id]: false }));
      }
    },
    [hostCouchKey, hostId, hostIdentifierKey, queryClient, renterId, renterIdentifierKey, toast],
  );

  const safeFormat = (value: string, pattern: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }
    return format(date, pattern);
  };

  if (!hostId) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Sign in to manage booking requests.</p>
        <Button onClick={() => navigate("/auth")}>Go to sign in</Button>
      </main>
    );
  }

  return (
    <main className="dreamy-bg min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-lg shadow-blue-100/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">Manage</p>
              <h1 className="text-3xl font-semibold text-sketch-dark">Booking requests</h1>
              <p className="text-sm text-muted-foreground">
                Review every booking in one place and respond when you're ready.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl shadow-blue-100/40 space-y-4">
          <div className="flex flex-wrap gap-2">
            {viewModeOptions.map((mode) => {
              const active = viewMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setViewMode(mode.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                    active
                      ? "bg-slate-900 text-white shadow-lg shadow-blue-200/60"
                      : "border border-slate-200/80 bg-white/80 text-slate-600"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const active = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                    active
                      ? "bg-blue-600 text-white shadow"
                      : "border border-slate-200/70 bg-white/80 text-slate-500"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </section>

        {!canViewHost && (
          <div className="rounded-[1.75rem] border border-white/60 bg-white/85 p-5 text-sm text-slate-600 shadow">
            Only approved hosts can manage booking requests from this page. If you need hosting enabled on your account,
            reach out to our team.
          </div>
        )}

        {canViewHost && hostListingsQuery.isSuccess && hostListings.length === 0 && (
          <div className="rounded-[1.75rem] border border-white/60 bg-white/85 p-5 text-sm text-slate-600 shadow space-y-3">
            <p>You haven't published a couch yet. Add one so renters can get in touch.</p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() =>
                navigate("/listings", {
                  state: { listingScope: "mine" },
                })}
            >
              Go to your listing
            </Button>
          </div>
        )}

        {viewMode === "host" && requestsQuery.isLoading && (
          <div className="rounded-[1.75rem] border border-white/60 bg-white/85 p-5 text-sm text-slate-600 shadow">
            Loading your booking requests…
          </div>
        )}

        {viewMode === "renter" && renterRequestsQuery.isLoading && (
          <div className="rounded-[1.75rem] border border-white/60 bg-white/85 p-5 text-sm text-slate-600 shadow">
            Loading your sent requests…
          </div>
        )}

        {viewMode === "host" && requestsQuery.isError && (
          <div className="rounded-[1.75rem] border border-rose-200 bg-white/90 p-5 text-sm text-rose-600 shadow">
            We couldn't load booking requests. Please refresh and try again.
          </div>
        )}

        {viewMode === "renter" && renterRequestsQuery.isError && (
          <div className="rounded-[1.75rem] border border-rose-200 bg-white/90 p-5 text-sm text-rose-600 shadow">
            We couldn't load your reservations. Please refresh and try again.
          </div>
        )}

        {!requestsQuery.isLoading
          && !requestsQuery.isError
          && !renterRequestsQuery.isLoading
          && !renterRequestsQuery.isError
          && filteredRequests.length === 0 && (
          <div className="rounded-[1.75rem] border border-white/60 bg-white/85 p-5 text-sm text-slate-600 shadow">
            {viewMode === "host"
              ? statusFilter === "pending"
                ? "You're all caught up! New booking requests will appear here."
                : "No requests match this filter."
              : statusFilter === "pending"
                ? "You haven't sent any booking requests yet."
                : "No sent requests match this filter."}
          </div>
        )}

        {!requestsQuery.isLoading
          && !requestsQuery.isError
          && !renterRequestsQuery.isLoading
          && !renterRequestsQuery.isError
          && filteredRequests.length > 0 && (
          <div className="space-y-4">
            {filteredRequests
              .slice(0, visibleCounts[viewMode])
              .map((request) => (
                <div
                  key={request.id}
                  className="rounded-[1.75rem] border border-white/60 bg-white/85 p-6 shadow-lg shadow-blue-100/40 space-y-4"
                >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                    {viewMode === "host" ? "Host booking" : "Sent booking"}
                  </p>
                    <h3 className="text-lg font-semibold text-sketch-dark">{request.couchTitle ?? "Couch request"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {viewMode === "host"
                        ? `Requested by ${request.renterName ?? "Unknown renter"}`
                        : `Hosted by ${request.hostName ?? "Unknown host"}`}
                    </p>
                  </div>
                  <Badge className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${STATUS_BADGE_STYLES[request.status]}`}>
                    {request.status}
                  </Badge>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <span>Price per night: {request.pricePerNight ?? "—"}</span>
                  <span>Submitted: {safeFormat(request.createdAt, "MMM d, yyyy HH:mm")}</span>
                  <span>
                    Stay: {safeFormat(request.stayStart, "MMM d, yyyy")} → {safeFormat(request.stayEnd, "MMM d, yyyy")}
                    {request.nights ? ` · ${request.nights} night${request.nights === 1 ? "" : "s"}` : ""}
                  </span>
                  <span>
                    {viewMode === "host"
                      ? `Host: ${request.hostName ?? "You"}`
                      : `Host: ${request.hostName ?? "Unknown"}`}
                  </span>
                  {viewMode === "renter" && (
                    <span>Renter: {request.renterName ?? "You"}</span>
                  )}
                </div>

                {viewMode === "host" && request.status === "approved" && (
                  <div className="rounded-xl border border-dashed border-slate-200/70 bg-slate-50/60 p-4 space-y-2">
                    <p className="text-sm font-semibold text-slate-800">Check-in photo</p>
                    <p className="text-xs text-slate-500">
                      Upload a photo when the renter arrives. Payment information stays private and is never shown to the public.
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={checkInUploading[request.id]}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (file) {
                          handleCheckInUpload(request, file);
                        }
                        event.target.value = "";
                      }}
                    />
                    {checkInUploading[request.id] && (
                      <p className="text-xs text-slate-500">Uploading photo…</p>
                    )}
                  </div>
                )}

                {viewMode === "renter" && (() => {
                  const paymentSummary = getPaymentSummary(request.pricePerNight ?? null, request.nights);
                  const paymentStatus = request.paymentStatus;
                  const paymentDueLabel = request.paymentDueAt
                    ? safeFormat(request.paymentDueAt, "MMM d, yyyy HH:mm")
                    : null;
                  const paymentLoading =
                    paymentIntentMutation.isPending
                    && paymentIntentMutation.variables?.request.id === request.id;
                  const showConfirmation = paymentStatus === "paid";
                  const showPayment = request.status === "approved" && !showConfirmation;
                  if (!showPayment && !showConfirmation) return null;

                  const paymentStatusLabel = (() => {
                    if (paymentStatus === "paid") {
                      return "Payment received. You're all set!";
                    }
                    if (paymentStatus === "failed") {
                      return "Your last payment attempt failed. Try again when you're ready.";
                    }
                    if (paymentStatus === "pending") {
                      return paymentDueLabel
                        ? `Finish payment by ${paymentDueLabel} to keep this reservation.`
                        : "Finish payment to confirm your stay.";
                    }
                    if (paymentStatus === "expired") {
                      return "Payment window expired. Ask your host to reopen it.";
                    }
                    return "Complete payment to confirm your approved stay.";
                  })();

                  return (
                    <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">
                            {showConfirmation ? "Payment complete" : "Payment required"}
                          </p>
                          <p className="text-xs text-emerald-800">{paymentStatusLabel}</p>
                          {paymentStatus === "paid" && (
                            <p className="text-xs font-medium text-emerald-900">
                              Reserved for {safeFormat(request.stayStart, "MMM d, yyyy")} · Arrival {safeFormat(request.stayStart, "HH:mm")}
                            </p>
                          )}
                        </div>
                        {paymentSummary && (
                          <div className="text-right">
                            <p className="text-base font-semibold text-emerald-900">{paymentSummary.amountLabel}</p>
                            <p className="text-xs text-emerald-800">
                              {paymentSummary.nights} night{paymentSummary.nights === 1 ? "" : "s"} at {request.pricePerNight ?? "—"}
                            </p>
                          </div>
                        )}
                      </div>

                      {showPayment && paymentSummary && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" className="rounded-full" disabled={paymentLoading} onClick={() => handleRenterPayment(request)}>
                            {paymentLoading ? "Preparing checkout…" : "Pay now"}
                          </Button>
                        </div>
                      )}

                      {!paymentSummary && (
                        <p className="text-xs text-emerald-800">
                          The host hasn't set a nightly rate yet, so we can't calculate the total.
                        </p>
                      )}

                      {paymentStatus === "expired" && (
                        <p className="text-xs text-rose-700">
                          Payment window expired. Ask the host to re-approve the request to try again.
                        </p>
                      )}

                      {paymentStatus === "failed" && (
                        <p className="text-xs text-rose-700">
                          Payment failed. Double-check your card or try another method.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {viewMode === "host" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={
                        request.status === "approved"
                        || request.status === "declined"
                        || request.status === "cancelled"
                        || updateMutation.isPending
                      }
                      onClick={() => handleStatusChange(request, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={
                        request.status === "declined"
                        || request.status === "cancelled"
                        || updateMutation.isPending
                      }
                      onClick={() => handleStatusChange(request, "declined")}
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={
                        request.status !== "pending"
                        || cancelMutation.isPending
                      }
                      onClick={() => handleStatusChange(request, "cancelled")}
                    >
                      Cancel request
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {visibleCounts[viewMode] < filteredRequests.length && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setVisibleCounts((prev) => ({
                      ...prev,
                      [viewMode]: Math.min(prev[viewMode] + PAGE_SIZE, filteredRequests.length),
                    }))}
                >
                  Show more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <BookingPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={(next) => {
          setPaymentDialogOpen(next);
          if (!next) {
            setPaymentDialogState({ booking: null, clientSecret: null, amountLabel: "", paymentDueAt: null });
          }
        }}
        booking={paymentDialogState.booking}
        clientSecret={paymentDialogState.clientSecret}
        amountLabel={paymentDialogState.amountLabel}
        paymentDueAt={paymentDialogState.paymentDueAt}
        onPaymentSuccess={async () => {
          const bookingId = paymentDialogState.booking?.id;
          if (bookingId) {
            const markPaid = (existing?: BookingRequestRecord[]) =>
              Array.isArray(existing)
                ? existing.map((item) => (
                  item.id === bookingId
                    ? { ...item, paymentStatus: "paid", status: "approved" }
                    : item
                ))
                : existing;
            queryClient.setQueryData<BookingRequestRecord[]>(
              ["host-manage-renter", renterId, renterIdentifierKey],
              markPaid,
            );
            queryClient.setQueryData<BookingRequestRecord[]>(
              ["host-manage-requests", hostId, hostIdentifierKey, hostCouchKey],
              markPaid,
            );
            queryClient.setQueryData<BookingRequestRecord[]>(
              ["booking-requests", renterId, renterIdentifierKey],
              markPaid,
            );
          }
          toast({ title: "Payment successful", description: "Your stay is confirmed—check your email for the receipt." });
          setPaymentDialogOpen(false);
          setPaymentDialogState({ booking: null, clientSecret: null, amountLabel: "", paymentDueAt: null });
        }}
      />
    </main>
  );
};

export default HostRequests;
