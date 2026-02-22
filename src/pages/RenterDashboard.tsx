import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getBookingRequestsForRenter, type BookingRequestRecord } from "@/lib/bookings";
import BookingPaymentDialog from "@/components/payments/BookingPaymentDialog";
import { createBookingPaymentIntent, type CreatePaymentIntentResponse } from "@/lib/payments";
import { getPaymentSummary, type PaymentSummary } from "@/lib/bookingPayments";
import {
  createMessage,
  getMessagesForRenter,
  type MessageRecord,
} from "@/lib/messages";
import { useToast } from "@/components/ui/use-toast";
import { MessageThreadDialog, type MessageThread } from "@/components/MessageThreadDialog";
import useRealtimeMessages from "@/hooks/useRealtimeMessages";
import useRealtimeBookings from "@/hooks/useRealtimeBookings";

type PaymentMutationVariables = {
  request: BookingRequestRecord;
  summary: PaymentSummary;
};

const RenterDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const renterId = profile?.id ?? null;

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
  }, [profile?.full_name, profile?.email]);

  const renterIdentifierKey = renterIdentifiers.join("|");

  const renterTokens = useMemo(
    () => renterIdentifiers.map((identifier) => identifier.toLowerCase()),
    [renterIdentifiers],
  );

  const matchesRenterMessage = useCallback(
    (message: MessageRecord) => {
      const renterIdMatch = renterId && message.renterId && message.renterId === renterId;
      const renterName = (message.renterName ?? "").toLowerCase();
      const renterEmail = (message.renterEmail ?? "").toLowerCase();
      const renterTokenMatch = renterTokens.some(
        (token) => renterName.includes(token) || renterEmail.includes(token),
      );
      return Boolean(renterIdMatch || renterTokenMatch);
    },
    [renterId, renterTokens],
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

  const bookingsQuery = useQuery({
    queryKey: ["booking-requests", renterId, renterIdentifierKey],
    queryFn: () => getBookingRequestsForRenter(renterId, renterIdentifiers),
    enabled: Boolean(renterId || renterIdentifiers.length),
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", renterId, renterIdentifierKey],
    queryFn: () => getMessagesForRenter(renterId, renterIdentifiers),
    enabled: Boolean(renterId || renterIdentifiers.length),
  });

  useRealtimeMessages({
    queryKey: ["messages", renterId, renterIdentifierKey],
    matcher: matchesRenterMessage,
  });
  useRealtimeBookings({
    queryKey: ["booking-requests", renterId, renterIdentifierKey],
    matcher: matchesRenterBooking,
  });

  const [activeThread, setActiveThread] = useState<MessageThread | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDialogState, setPaymentDialogState] = useState<{
    booking: BookingRequestRecord | null;
    clientSecret: string | null;
    amountLabel: string;
    paymentDueAt: string | null;
  }>({ booking: null, clientSecret: null, amountLabel: "", paymentDueAt: null });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ thread, text }: { thread: MessageThread; text: string }) => {
      const hostName = thread.hostName ?? "Host";
      const renterName = profile?.full_name ?? profile?.email ?? thread.renterName ?? "You";

      await createMessage({
        couchId: thread.couchId ?? `thread-${thread.threadKey}`,
        hostId: thread.hostId,
        hostName,
        hostEmail: thread.hostEmail ?? null,
        renterId: profile?.id,
        renterName,
        renterEmail: profile?.email ?? null,
        body: text,
        senderRole: "renter",
        senderId: profile?.id,
        senderName: renterName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", renterId, renterIdentifierKey] });
    },
    onError: (error) => {
      console.error("Failed to send message", error);
      toast({
        title: "Unable to send",
        description: "We couldn't deliver your message. Please try again.",
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
      queryClient.invalidateQueries({ queryKey: ["booking-requests", renterId, renterIdentifierKey] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "We couldn't start checkout.";
      toast({
        title: "Payment unavailable",
        description: message,
        variant: "destructive",
      });
    },
  });

  const bookingRequests = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const conversations = useMemo(() => {
    const map = new Map<string, MessageThread>();

    messages.forEach((message) => {
      const hostName = message.hostName ?? "Host";
      const renterName = message.renterName ?? profile?.full_name ?? "You";
      const keyParts = [message.couchId ?? "general", hostName ?? "host", renterName ?? "you"];
      const threadKey = keyParts.join("::");

      const existing = map.get(threadKey);
      if (existing) {
        existing.messages.push(message);
      } else {
        map.set(threadKey, {
          threadKey,
          couchId: message.couchId,
          hostId: message.hostId,
          hostName,
          hostEmail: message.hostEmail,
          renterId: profile?.id ?? message.renterId,
          renterName,
          renterEmail: message.renterEmail ?? profile?.email ?? null,
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

  const handleRequestPayment = useCallback(
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

  const formatDate = (value: string, pattern: string) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return "Unknown date";
    }
    return format(date, pattern);
  };

  return (
    <main className="dreamy-bg min-h-screen px-4 py-6">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sketch-dark">Your dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Track booking status and keep conversations going with hosts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/listings")}>Back to listings</Button>
        </div>
      </header>

      {!renterId && (
        <div className="sketch-card p-4 text-center text-sm text-muted-foreground">
          Sign in as a renter to view your requests and messages.
        </div>
      )}

      {renterId && (
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-sketch-dark">Booking requests</h2>
              <p className="text-sm text-muted-foreground">Pending stays you've requested from hosts.</p>
            </div>

            {bookingsQuery.isLoading && (
              <div className="sketch-card p-4 text-sm text-muted-foreground">Loading your booking requests...</div>
            )}

            {bookingsQuery.isError && (
              <div className="sketch-card p-4 text-sm text-destructive">
                Unable to load booking requests right now. Please refresh the page.
              </div>
            )}

            {!bookingsQuery.isLoading && !bookingsQuery.isError && bookingRequests.length === 0 && (
              <div className="sketch-card p-4 text-sm text-muted-foreground">
                You haven't sent any booking requests yet.
              </div>
            )}

            {!bookingsQuery.isLoading && !bookingsQuery.isError && bookingRequests.length > 0 && (
              <div className="space-y-3">
                {bookingRequests.map((request) => {
                  const paymentSummary = getPaymentSummary(request.pricePerNight ?? null, request.nights);
                  const paymentDueLabel = request.paymentDueAt
                    ? formatDate(request.paymentDueAt, "MMM d, yyyy HH:mm")
                    : null;
                  const paymentStatus = request.paymentStatus;
                  const paymentLoading =
                    paymentIntentMutation.isPending
                    && paymentIntentMutation.variables?.request.id === request.id;
                  const showConfirmation = paymentStatus === "paid";
                  const showPayment = request.status === "approved" && !showConfirmation;
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
                    <div key={request.id} className="sketch-card p-4 grid gap-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-sketch-dark">{request.couchTitle ?? "Couch request"}</h3>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{request.status}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {request.hostName ? `Host: ${request.hostName}` : "Host details pending"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(request.stayStart, "MMM d, yyyy")} → {formatDate(request.stayEnd, "MMM d, yyyy")} · {request.nights ?? "?"} night{request.nights === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested on {formatDate(request.createdAt, "MMM d, yyyy")}
                      </p>

                      {(showPayment || showConfirmation) && (
                        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-emerald-900">
                                {showConfirmation ? "Payment complete" : "Payment required"}
                              </p>
                              <p className="text-xs text-emerald-800">{paymentStatusLabel}</p>
                              {showConfirmation && (
                                <p className="text-xs font-medium text-emerald-900">
                                  Reserved for {formatDate(request.stayStart, "MMM d, yyyy")} · Arrival {formatDate(request.stayStart, "HH:mm")}
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
                              <Button
                                size="sm"
                                className="rounded-full"
                                disabled={paymentLoading}
                                onClick={() => handleRequestPayment(request)}
                              >
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
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-sketch-dark">Conversations</h2>
              <p className="text-sm text-muted-foreground">Chat with hosts in real time.</p>
            </div>

            {messagesQuery.isLoading && (
              <div className="sketch-card p-4 text-sm text-muted-foreground">Loading your messages...</div>
            )}

            {messagesQuery.isError && (
              <div className="sketch-card p-4 text-sm text-destructive">
                Unable to load your messages right now. Please refresh the page.
              </div>
            )}

            {!messagesQuery.isLoading && !messagesQuery.isError && conversations.length === 0 && (
              <div className="sketch-card p-4 text-sm text-muted-foreground">
                Send a note from a couch detail page to start a conversation.
              </div>
            )}

            {!messagesQuery.isLoading && !messagesQuery.isError && conversations.length > 0 && (
              <div className="space-y-3">
                {conversations.map((thread) => {
                  const last = thread.messages[thread.messages.length - 1];
                  const previewPrefix = last.senderRole === "renter" ? "You:" : `${thread.hostName ?? "Host"}:`;
                  return (
                    <button
                      key={thread.threadKey}
                      onClick={() => handleOpenThread(thread)}
                      className="w-full text-left sketch-card p-4 hover:bg-sketch-light transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sketch-dark text-sm">
                            {thread.hostName ?? "Host"}
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
          </section>
        </div>
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
        currentUserRole="renter"
        onSendMessage={handleSendMessage}
        sending={sendMessageMutation.isPending}
      />

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
              ["booking-requests", renterId, renterIdentifierKey],
              markPaid,
            );
            queryClient.setQueryData<BookingRequestRecord[]>(
              ["host-manage-renter", renterId, renterIdentifierKey],
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

export default RenterDashboard;
