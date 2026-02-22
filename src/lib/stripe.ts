import { loadStripe, type Stripe } from "@stripe/stripe-js";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ?? (typeof process !== "undefined" ? process.env?.VITE_STRIPE_PUBLISHABLE_KEY : undefined)
  ?? (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : undefined);

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripePromise = () => {
  if (!publishableKey || typeof window === "undefined") {
    return null;
  }
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

export const hasStripePublishableKey = Boolean(publishableKey);
