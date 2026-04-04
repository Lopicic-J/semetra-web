import Stripe from "stripe";

// Server-side Stripe instance (only used in API routes / server components)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

// ─── Pro Basic Subscription Tiers ─── (4.90 CHF/mo — alle Features, 10 KI/Monat)
export const PRO_BASIC_PRICES = {
  monthly: {
    priceId: "price_1TG9kaRNHcFqFbgIthnElTOy",
    price: 4.9,
    currency: "CHF",
    interval: "Monat",
    intervalCount: 1,
    label: "1 Monat",
    perMonth: 4.9,
    aiPerMonth: 10,
    aiTotal: 10,
    aiLabel: "10 Requests / Monat",
  },
  halfYearly: {
    priceId: "price_1TG9kdRNHcFqFbgIlTDxPRla",
    price: 24.9,
    currency: "CHF",
    interval: "6 Monate",
    intervalCount: 6,
    label: "6 Monate",
    perMonth: 4.15,
    savings: 15,
    aiPerMonth: 10,
    aiTotal: 60,
    aiLabel: "60 Requests / 6 Monate",
  },
  yearly: {
    priceId: "price_1TG9kZRNHcFqFbgI6F0O2tqs",
    price: 39.9,
    currency: "CHF",
    interval: "Jahr",
    intervalCount: 12,
    label: "12 Monate",
    perMonth: 3.33,
    savings: 32,
    popular: true,
    aiPerMonth: 10,
    aiTotal: 120,
    aiLabel: "120 Requests / 12 Monate",
  },
} as const;

// ─── Pro Full Subscription Tiers ─── (9.90 CHF/mo — alle Features, 100 KI/Monat)
export const PRO_FULL_PRICES = {
  monthly: {
    priceId: "price_1TIZvpRNHcFqFbgIR9miASA6",
    price: 9.9,
    currency: "CHF",
    interval: "Monat",
    intervalCount: 1,
    label: "1 Monat",
    perMonth: 9.9,
    aiPerMonth: 100,
    aiTotal: 100,
    aiLabel: "100 Requests / Monat",
  },
  halfYearly: {
    priceId: "price_1TIZxJRNHcFqFbgIqiptOa6o",
    price: 49.9,
    currency: "CHF",
    interval: "6 Monate",
    intervalCount: 6,
    label: "6 Monate",
    perMonth: 8.32,
    savings: 16,
    aiPerMonth: 100,
    aiTotal: 600,
    aiLabel: "600 Requests / 6 Monate",
  },
  yearly: {
    priceId: "price_1TIZzGRNHcFqFbgIB1I4KOMC",
    price: 94.9,
    currency: "CHF",
    interval: "Jahr",
    intervalCount: 12,
    label: "12 Monate",
    perMonth: 7.9,
    savings: 20,
    popular: true,
    aiPerMonth: 100,
    aiTotal: 1200,
    aiLabel: "1200 Requests / 12 Monate",
  },
} as const;

// ─── Pro Full Payment Links ───
export const PRO_FULL_PAYMENT_LINKS = {
  monthly: "https://buy.stripe.com/bJe7sN68c1Kk7uicmDfYY05",
  halfYearly: "https://buy.stripe.com/7sYcN7548ex63e20DVfYY06",
  yearly: "https://buy.stripe.com/5kQ6oJbswbkU9CqbizfYY07",
} as const;

// Legacy alias — keep for backward compatibility
export const PRO_PRICES = PRO_BASIC_PRICES;
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";

// ─── Lifetime Purchases ───
export const LIFETIME_BASIC_PRICE = {
  priceId: "price_1THv6MRNHcFqFbgItC6BE1E1",
  productId: "prod_UGS0z0EogksIbg",
  price: 89.9,
  currency: "CHF",
  label: "Lifetime Basic",
  note: "Alle Features — keine KI inkludiert, Add-on möglich",
  paymentLink: "https://buy.stripe.com/4gM3cx7cg3Ss15U3Q7fYY04",
  tier: "basic" as const,
} as const;

export const LIFETIME_FULL_PRICE = {
  priceId: "price_1TIa6bRNHcFqFbgIJnssi2NB",
  productId: "prod_UH8NFpGnl2G3QD",
  price: 129.9,
  currency: "CHF",
  label: "Lifetime Full",
  note: "Alle Features + 20 KI-Requests/Monat",
  paymentLink: "https://buy.stripe.com/eVq28t1RW74E3e2dqHfYY08",
  tier: "full" as const,
} as const;

// Legacy alias
export const LIFETIME_PRICE = LIFETIME_BASIC_PRICE;

// ─── KI Add-on (Einzelkauf, jederzeit nachkaufbar) ───
export const AI_ADDON_PRICE = {
  priceId: "price_1TIa3PRNHcFqFbgIQmYFON6Z",
  productId: "prod_UH8KY5vd45x0Mi",
  credits: 200,
  price: 6.9,
  currency: "CHF",
  label: "+200 KI-Requests",
  note: "Einmalig — jederzeit nachkaufbar",
  paymentLink: "https://buy.stripe.com/bJe8wRbsw9cMaGu1HZfYY09",
} as const;

export type PriceTier = keyof typeof PRO_BASIC_PRICES;

// All valid subscription price IDs (both Basic and Full)
const ALL_SUB_PRICE_IDS: Set<string> = new Set([
  ...Object.values(PRO_BASIC_PRICES).map(t => t.priceId),
  ...Object.values(PRO_FULL_PRICES).map(t => t.priceId),
]);

/** Validate that a given price ID belongs to one of our subscription tiers */
export function isValidProPrice(priceId: string): boolean {
  return ALL_SUB_PRICE_IDS.has(priceId);
}

/** Check if price is a Pro Basic subscription */
export function isProBasicPrice(priceId: string): boolean {
  return Object.values(PRO_BASIC_PRICES).some(t => t.priceId === priceId);
}

/** Check if price is a Pro Full subscription */
export function isProFullPrice(priceId: string): boolean {
  return Object.values(PRO_FULL_PRICES).some(t => t.priceId === priceId);
}

/** Check if price ID is the AI add-on */
export function isAiAddonPrice(priceId: string): boolean {
  return priceId === AI_ADDON_PRICE.priceId;
}

/** Check if price is Lifetime Basic */
export function isLifetimeBasicPrice(priceId: string): boolean {
  return priceId === LIFETIME_BASIC_PRICE.priceId;
}

/** Check if price is Lifetime Full */
export function isLifetimeFullPrice(priceId: string): boolean {
  return priceId === LIFETIME_FULL_PRICE.priceId;
}

/** Determine plan tier from a price ID */
export function getTierFromPriceId(priceId: string): "basic" | "full" | null {
  if (isProBasicPrice(priceId) || isLifetimeBasicPrice(priceId)) return "basic";
  if (isProFullPrice(priceId) || isLifetimeFullPrice(priceId)) return "full";
  return null;
}

// ─── Plans Display Config ───
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    currency: "CHF",
    features: [
      "Bis zu 3 Module",
      "Unbegrenzte Noten (Basisansicht)",
      "Stundenplan & Kalender",
      "Aufgaben & ECTS-Tracking",
      "Lernziele & Pomodoro-Timer",
      "Bis zu 10 Notizen",
      "Bis zu 2 Mind Maps",
      "Bis zu 3 Karteikarten-Sets",
      "3 KI-Requests pro Tag",
    ],
    lockedFeatures: [
      "Unbegrenzte Module & Wissens-Tools",
      "10–100 KI-Requests / Monat",
      "Mathe-Raum unbegrenzt",
      "Notenprognosen & Trendanalyse",
      "Semester-Report PDF Export",
      "Smart Spaced Repetition",
      "Desktop ↔ Web Sync",
    ],
  },
  proBasic: {
    name: "Pro Basic",
    price: 4.9,
    currency: "CHF",
    interval: "Monat",
    features: [
      "Alles aus Free — ohne Limits",
      "Unbegrenzte Module, Notizen & Karteikarten",
      "10 KI-Requests / Monat",
      "Mathe-Raum ohne Tageslimit",
      "Notenprognosen & Trendanalyse",
      "Semester-Report PDF Export",
      "Smart Spaced Repetition",
      "Desktop ↔ Web Echtzeit-Sync",
      "Benutzerdefinierte Themes",
      "Add-on: +200 Requests (CHF 6.90, nachkaufbar)",
    ],
  },
  proFull: {
    name: "Pro Full",
    price: 9.9,
    currency: "CHF",
    interval: "Monat",
    features: [
      "Alles aus Pro Basic",
      "100 KI-Requests / Monat",
      "KI-Lernassistent: Erklären, Quiz, Zusammenfassen",
      "Mathe-Raum ohne Tageslimit",
      "Notenprognosen & Trendanalyse",
      "Semester-Report PDF Export",
      "Smart Spaced Repetition",
      "Desktop ↔ Web Echtzeit-Sync",
      "Benutzerdefinierte Themes",
      "Prioritäts-Support",
    ],
  },
  lifetimeBasic: {
    name: "Lifetime Basic",
    price: 89.9,
    currency: "CHF",
    features: [
      "Alle Pro-Features — für immer",
      "Keine monatlichen Kosten",
      "Keine KI inkludiert",
      "KI-Requests über Add-on (+200 für CHF 6.90)",
    ],
  },
  lifetimeFull: {
    name: "Lifetime Full",
    price: 129.9,
    currency: "CHF",
    features: [
      "Alle Pro-Features — für immer",
      "Keine monatlichen Kosten",
      "20 KI-Requests / Monat inkludiert",
      "Erweiterbar über Add-on (+200 für CHF