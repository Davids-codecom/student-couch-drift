import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  getBookingRequestsForHost,
  updateBookingRequestStatus,
  type BookingRequestRecord,
  type BookingRequestStatus,
} from "@/lib/bookings";
import {
  createMessage,
  getMessagesForHost,
  type MessageRecord,
} from "@/lib/messages";
import useRealtimeMessages from "@/hooks/useRealtimeMessages";
import useRealtimeBookings from "@/hooks/useRealtimeBookings";
import { MessageThreadDialog, type MessageThread } from "@/components/MessageThreadDialog";
import { format } from "date-fns";
import { fetchListingsForHost } from "@/lib/listings";

const statusLabels: Record<BookingRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
};

const statusTone: Record<BookingRequestStatus, string> = {
  pending: "text-amber-600",
  approved: "text-emerald-600",
  declined: "text-rose-600",
  cancelled: "text-muted-foreground",
};

const HostDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const hostId = profile?.id ?? null;

  const hostListingsQuery = useQuery({
    queryKey: ["host-dashboard-listings", hostId],
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
      addIdentifier(listing.title);
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

  const matchesHostMessage = useCallback(
    (message: MessageRecord) => {
      const hostIdMatch = hostId && message.hostId && message.hostId === hostId;
      const hostName = (message.hostName ?? "").toLowerCase();
      const hostEmail = (message.hostEmail ?? "").toLowerCase();
      const hostTokenMatch = hostTokens.some(
        (token) => hostName.includes(token) || hostEmail.includes(token),
      );
      const couchMatch = message.couchId ? hostCouchSet.has(message.couchId) : false;
      return Boolean(hostIdMatch || hostTokenMatch || couchMatch);
    },
    [hostId, hostTokens, hostCouchSet],
  );

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

  const requestsQuery = useQuery({
    queryKey: ["host-booking-requests", hostId, hostIdentifierKey, hostCouchKey],
    queryFn: () => getBookingRequestsForHost(hostId, hostIdentifiers, hostCouchIds),
    enabled: Boolean(hostId || hostIdentifiers.length || hostCouchIds.length),
  });

  const messagesQuery = useQuery({
    queryKey: ["host-messages", hostId, hostIdentifierKey, hostCouchKey],
    queryFn: () => getMessagesForHost(hostId, hostIdentifiers, hostCouchIds),
    enabled: Boolean(hostId || hostIdentifiers.length || hostCouchIds.length),
  });

  useRealtimeMessages({
    queryKey: ["host-messages", hostId, hostIdentifierKey, hostCouchKey],
    matcher: matchesHostMessage,
  });
  useRealtimeBookings({
    queryKey: ["host-booking-requests", hostId, hostIdentifierKey, hostCouchKey],
    matcher: matchesHostBooking,
  });

  const [activeThread, setActiveThread] = useState<MessageThread | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingRequestStatus }) =>
      updateBookingRequestStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["host-booking-requests", hostId, hostIdentifierKey, hostCouchKey],
      });
      toast({
        title: "Request updated",
        description: `Marked request as ${statusLabels[variables.status].toLowerCase()}.`,
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

  const sendMessageMutation = useMutation({
    mutationFn: async ({ thread, text }: { thread: MessageThread; text: string }) => {
      const hostName = profile?.full_name ?? profile?.email ?? thread.hostName ?? "Host";
      const hostEmail = profile?.email ?? thread.hostEmail ?? null;
      const renterName = thread.renterName ?? "Guest";

      await createMessage({
        couchId: thread.couchId ?? `thread-${thread.threadKey}`,
        hostId: profile?.id,
        hostName,
        hostEmail,
        renterId: thread.renterId,
        renterName,
        renterEmail: thread.renterEmail ?? null,
        body: text,
        senderRole: "host",
        senderId: profile?.id,
        senderName: hostName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["host-messages", hostId, hostIdentifierKey, hostCouchKey],
      });
    },
    onError: (error) => {
      console.error("Failed to send message", error);
      toast({
        title: "Unable to send",
        description: "We couldn't send that reply. Please try again.",
        variant: "destructive",
      });
    },
  });

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const conversations = useMemo(() => {
    const map = new Map<string, MessageThread>();

    messages.forEach((message) => {
      const hostName = message.hostName ?? profile?.full_name ?? profile?.email ?? "Host";
      const hostEmail = message.hostEmail ?? profile?.email ?? null;
      const renterName = message.renterName ?? "Guest";
      const keyParts = [message.couchId ?? "general", hostName ?? "host", renterName ?? "guest"];
      const threadKey = keyParts.join("::");

      const existing = map.get(threadKey);
      if (existing) {
        existing.messages.push(message);
      } else {
        map.set(threadKey, {
          threadKey,
          couchId: message.couchId,
          hostId: message.hostId ?? profile?.id ?? null,
          hostName,
          hostEmail,
          renterId: message.renterId,
          renterName,
          renterEmail: message.renterEmail,
          messages: [message],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const lastA = a.messages[a.messages.length - 1];
      const lastB = b.messages[b.messages.length - 1];
      return new Date(lastB.sentAt).getTime() - new Date(lastA.sentAt).getTime();
    });
  }, [messages, profile?.full_name, profile?.email, profile?.id]);

  const handleOpenThread = (thread: MessageThread) => {
    setActiveThread(thread);
    setChatOpen(true);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeThread) return;
    await sendMessageMutation.mutateAsync({ thread: activeThread, text });
  };

  return (
    <main className="dreamy-bg min-h-screen px-4 py-6">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sketch-dark">Host dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Review renter requests, reply to messages, and keep conversations moving.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/host-requests")}>Manage requests</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/listings")}>Back to listings</Button>
        </div>
      </header>

      {!hostId && (
        <div className="sketch-card p-4 text-sm text-muted-foreground text-center">
          Sign in as a host to view incoming booking requests and messages.
        </div>
      )}

      {hostId && profile?.user_role !== "host" && (
        <div className="sketch-card p-4 text-sm text-muted-foreground">
          Your account isn't marked as a host yet. Complete the onboarding flow to start receiving booking requests.
        </div>
      )}

      {hostId && profile?.user_role === "host" && (
        <section className="space-y-6">
          {requestsQuery.isLoading && (
            <div className="sketch-card p-4 text-sm text-muted-foreground">Loading booking requests...</div>
          )}

          {requestsQuery.isError && (
            <div className="sketch-card p-4 text-sm text-destructive">
              We couldn't load your booking requests. Please refresh and try again.
            </div>
          )}

          {!requestsQuery.isLoading && !requestsQuery.isError && requests.length === 0 && (
            <div className="sketch-card p-4 text-sm text-muted-foreground">
              You're all caught up! New booking requests will appear here.
            </div>
          )}

          {!requestsQuery.isLoading && !requestsQuery.isError && requests.length > 0 && (
            <div className="space-y-3">
              {requests.map((request) => (
                <HostRequestCard
                  key={request.id}
                  request={request}
                  isUpdating={updateMutation.isPending}
                  onUpdate={(status) => updateMutation.mutate({ id: request.id, status })}
                />
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-sketch-dark">Conversations</h2>
              <p className="text-sm text-muted-foreground">
                Keep chatting with renters just like you would on WhatsApp.
              </p>
            </div>

            {messagesQuery.isLoading && (
              <div className="sketch-card p-4 text-sm text-muted-foreground">Loading messages...</div>
            )}

            {messagesQuery.isError && (
              <div className="sketch-card p-4 text-sm text-destructive">
                We couldn't load your messages. Please refresh and try again.
              </div>
            )}

            {!messagesQuery.isLoading && !messagesQuery.isError && conversations.length === 0 && (
              <div className="sketch-card p-4 text-sm text-muted-foreground">
                You'll see renter conversations here as soon as they reach out.
              </div>
            )}

            {!messagesQuery.isLoading && !messagesQuery.isError && conversations.length > 0 && (
              <div className="space-y-3">
                {conversations.map((thread) => {
                  const last = thread.messages[thread.messages.length - 1];
                  const previewPrefix = last.senderRole === "host" ? "You:" : `${thread.renterName ?? "Guest"}:`;
                  return (
                    <button
                      key={thread.threadKey}
                      onClick={() => handleOpenThread(thread)}
                      className="w-full text-left sketch-card p-4 hover:bg-sketch-light transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sketch-dark text-sm">
                            {thread.renterName ?? "Guest"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {previewPrefix} {last.text}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(last.sentAt), "MMM d, HH:mm")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <MessageThreadDialog
        open={chatOpen}
        onOpenChange={(next) => {
          setChatOpen(next);
          if (!next) {
            setActiveThread(null);
          }
        }}
        thread={activeThread}
        currentUserRole="host"
        onSendMessage={handleSendMessage}
        sending={sendMessageMutation.isPending}
      />
    </main>
  );
};

const HostRequestCard = ({
  request,
  onUpdate,
  isUpdating,
}: {
  request: BookingRequestRecord;
  onUpdate: (status: BookingRequestStatus) => void;
  isUpdating: boolean;
}) => {
  const canAct = request.status === "pending";

  const safeFormat = (value: string, pattern: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }
    return format(date, pattern);
  };

  return (
    <div className="sketch-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-sketch-dark">
          {request.couchTitle ?? "Couch request"}
        </h2>
        <span className={`text-xs uppercase tracking-wide ${statusTone[request.status]}`}>
          {statusLabels[request.status]}
        </span>
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>Renter: {request.renterName ?? "Unknown renter"}</p>
        <p>
          Stay: {safeFormat(request.stayStart, "MMM d, yyyy")} → {safeFormat(request.stayEnd, "MMM d, yyyy")} ·
          {` ${request.nights ?? "?"} night${request.nights === 1 ? "" : "s"}`}
        </p>
        <p>Requested: {safeFormat(request.createdAt, "MMM d, yyyy HH:mm")}</p>
        {request.pricePerNight && <p>Rate: {request.pricePerNight}</p>}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onUpdate("approved")}
          disabled={!canAct || isUpdating}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => onUpdate("declined")}
          disabled={!canAct || isUpdating}
        >
          Decline
        </Button>
      </div>
    </div>
  );
};

export default HostDashboard;
