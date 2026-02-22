import { supabase } from "@/lib/supabaseClient";

export interface CreatePaymentIntentInput {
  bookingId: string;
  amount: number;
  renterEmail?: string | null;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string | null;
  paymentDue?: string;
}

export const createBookingPaymentIntent = async (
  input: CreatePaymentIntentInput,
): Promise<CreatePaymentIntentResponse> => {
  if (!input.bookingId) {
    throw new Error("Booking request is missing");
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("A positive payment amount is required");
  }

  const { data, error } = await supabase.functions.invoke<CreatePaymentIntentResponse>("create-payment-intent", {
    body: {
      bookingId: input.bookingId,
      amount,
      renterEmail: input.renterEmail ?? undefined,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.clientSecret) {
    throw new Error("We couldn't start checkout. Please try again.");
  }

  return data;
};
