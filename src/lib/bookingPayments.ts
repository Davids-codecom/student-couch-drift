export type PaymentSummary = {
  nightlyRate: number;
  nights: number;
  totalDue: number;
  amountLabel: string;
};

const FALLBACK_CURRENCY = "CHF";

export const parsePriceValue = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digitsOnly = trimmed.replace(/[^0-9.,-]/g, "");
  if (!digitsOnly) return null;
  const hasComma = digitsOnly.includes(",");
  const hasDot = digitsOnly.includes(".");
  let normalized = digitsOnly;
  if (hasComma && hasDot) {
    normalized = normalized.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    normalized = normalized.replace(/,/g, ".");
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const deriveCurrencyToken = (value?: string | null) => {
  if (!value) return FALLBACK_CURRENCY;
  const trimmed = value.trim();
  if (!trimmed) return FALLBACK_CURRENCY;
  const prefixMatch = trimmed.match(/^[^0-9-]+/);
  const token = prefixMatch ? prefixMatch[0].trim() : "";
  if (token) return token;
  if (trimmed.startsWith("$")) return "$";
  return FALLBACK_CURRENCY;
};

export const formatTotalLabel = (priceLabel: string | null, total: number) => {
  const token = deriveCurrencyToken(priceLabel);
  const needsSpace = /[A-Za-z]/.test(token) && token.length > 1;
  const prefix = token ? `${token}${needsSpace ? " " : ""}` : "";
  return `${prefix}${total.toFixed(2)}`;
};

export const getPaymentSummary = (pricePerNight: string | null, nightsValue: number | string | null): PaymentSummary | null => {
  const nightlyRate = parsePriceValue(pricePerNight);
  if (!nightlyRate) return null;
  const nightsRaw = typeof nightsValue === "number" ? nightsValue : Number(nightsValue ?? 0);
  const nights = Math.max(1, Number.isFinite(nightsRaw) ? nightsRaw : 1);
  const totalDue = nightlyRate * nights;
  return {
    nightlyRate,
    nights,
    totalDue,
    amountLabel: formatTotalLabel(pricePerNight, totalDue),
  };
};
