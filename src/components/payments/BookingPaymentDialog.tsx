import { useMemo, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BookingRequestRecord } from "@/lib/bookings";
import { getStripePromise, hasStripePublishableKey } from "@/lib/stripe";

interface BookingPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingRequestRecord | null;
  clientSecret: string | null;
  amountLabel: string;
  paymentDueAt: string | null;
  onPaymentSuccess?: () => Promise<void> | void;
}

const PaymentCheckoutForm = ({
  amountLabel,
  paymentDueLabel,
  onPaymentSuccess,
}: {
  amountLabel: string;
  paymentDueLabel: string | null;
  onPaymentSuccess?: () => Promise<void> | void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/renter-dashboard` : undefined;

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: returnUrl ? { return_url: returnUrl } : undefined,
        redirect: "if_required",
      });

      if (result.error) {
        setMessage(result.error.message ?? "The payment could not be completed.");
      } else if (result.paymentIntent?.status === "succeeded") {
        setMessage("Payment successful! You're all set.");
        await onPaymentSuccess?.();
      } else {
        setMessage("Your payment is processing. We'll update you shortly.");
      }
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Unexpected issue while confirming the payment.";
      setMessage(fallback);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 p-3 text-sm text-muted-foreground">
        <p className="font-semibold text-sketch-dark text-base text-left">Total due: {amountLabel}</p>
        {paymentDueLabel && (
          <p className="text-xs text-muted-foreground">Pay before {paymentDueLabel} to keep your approved stay.</p>
        )}
      </div>
      <PaymentElement options={{ layout: "tabs" }} />
      <Button type="submit" className="w-full" disabled={!stripe || submitting}>
        {submitting ? "Processing…" : `Pay ${amountLabel}`}
      </Button>
      {message && <p className="text-sm text-muted-foreground text-center">{message}</p>}
    </form>
  );
};

const BookingPaymentDialog = ({
  open,
  onOpenChange,
  booking,
  clientSecret,
  amountLabel,
  paymentDueAt,
  onPaymentSuccess,
}: BookingPaymentDialogProps) => {
  const stripePromise = getStripePromise();

  const paymentDueLabel = useMemo(() => {
    if (!paymentDueAt) return null;
    const date = new Date(paymentDueAt);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, "MMM d, yyyy HH:mm");
  }, [paymentDueAt]);

  const readyForCheckout = Boolean(open && booking && clientSecret && stripePromise);
  const dialogTitle = booking ? `Pay ${booking.couchTitle ?? "for your stay"}` : "Complete payment";

  let fallbackMessage: string | null = null;
  if (!hasStripePublishableKey) {
    fallbackMessage = "Stripe is not configured in this environment. Add VITE_STRIPE_PUBLISHABLE_KEY to your environment variables.";
  } else if (open && !clientSecret) {
    fallbackMessage = "We couldn't create a payment session. Close this window and try again.";
  }

  const options: StripeElementsOptions | undefined = readyForCheckout
    ? {
        clientSecret: clientSecret!,
        appearance: { theme: "stripe", labels: "floating" },
      }
    : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Complete payment to confirm your approved stay. We only charge after the host accepts your request.
          </DialogDescription>
        </DialogHeader>

        {!readyForCheckout || fallbackMessage ? (
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-4 text-sm text-muted-foreground">
            {fallbackMessage ?? "Preparing checkout…"}
          </div>
        ) : (
          <Elements stripe={stripePromise!} options={options} key={clientSecret!}>
            <PaymentCheckoutForm amountLabel={amountLabel} paymentDueLabel={paymentDueLabel} onPaymentSuccess={onPaymentSuccess} />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingPaymentDialog;
