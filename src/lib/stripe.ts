import Stripe from "stripe";

// Server-side Stripe instance (only used in API routes / server components)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

// Default price (yearly) — used as fallback
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";

// All Pro pricing tiers — Unified (Web + Desktop)
export const PRO_PRICES = {
  monthly: {
    priceId: "price_1TG9kaRNHcFqFbgIthnElTOy",
    price: 4.9,
    currency: "CHF",
    interval: "Monat",
    intervalCount: 1,
    label: "1 Monat",
    perMonth: 4.9,
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
  },
} as const;

// Lifetime one-time purchase (separate from subscriptions)
export const LIFETIME_PRICE = {
  priceId: "price_1THv6MRNHcFqFbgItC6BE1E1",
  productId: "prod_UGS0z0EogksIbg",
  price: 89.9,
  currency: "CHF",
  label: "Lifetime",
  paymentLink: "https://buy.stripe.com/4gM3cx7cg3Ss15U3Q7fYY04",
} as const;

export type PriceTier = keyof typeof PRO_PRICES;

// Validate that a given price ID belongs to one of our tiers
export function isValidProPrice(priceId: string): boolean {
  return Object.values(PRO_PRICES).some((t) => t.priceId === priceId);
}

// Plans config — used client-side too (no secrets here)
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    currency: "CHF",
    features: [
      "Bis zu 8 Module",
      "Unbegrenzte Noten (Basisansicht)",
      "Stundenplan & Kalender",
      "Aufgaben & ECTS-Tracking",
      "Lernziele & Pomodoro-Timer",
      "Mathe-Raum (5 Berechnungen/Tag)",
      "Bis zu 15 Notizen",
      "Bis zu 3 Mind Maps",
      "Bis zu 5 Karteikarten-Sets",
      "KI-Features (Beta)",
    ],
    lockedFeatures: [
      "Unbegrenzte Module & Wissens-Tools",
      "Mathe-Raum unbegrenzt",
      "Notenprognosen & Trendanalyse",
      "Semester-Report PDF Export",
      "Smart Spaced Repetition",
      "FH-Voreinstellungen Import",
      "Desktop ↔ Web Sync",
    ],
  },
  pro: {
    name: "Pro",
    price: 4.9,
    currency: "CHF",
    interval: "Monat",
    features: [
      "Alles aus Free — ohne Limits",
      "Unbegrenzte Module",
      "Unbegrenzte Notizen, Mind Maps & Karteikarten",
      "Unbegrenzte Dokumente & Brainstorming",
      "Mathe-Raum ohne Tageslimit",
      "Notenprognosen & Trendanalyse",
      "Semester-Report PDF Export",
      "Smart Spaced Repetition (Algorithmus)",
      "FH-Voreinstellungen Import",
      "Desktop ↔ Web Echtzeit-Sync",
      "Benutzerdefinierte Themes",
      "Prioritäts-Support",
    ],
  },
} as const;
