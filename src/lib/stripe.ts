import Stripe from "stripe";

// Server-side Stripe instance (only used in API routes / server components)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

// Default price (1 month) — used as fallback
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";

// All Pro pricing tiers
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
    limits: {
      totalModules: 6,
      grades: 3,
      stundenplanEntries: 4,
    },
    features: [
      "Bis zu 6 Module",
      "Bis zu 3 Noten",
      "Bis zu 4 Stundenplan-Einträge",
      "Aufgaben & Kalender",
      "ECTS-Tracking",
      "Lernziele & Timer",
    ],
    lockedFeatures: [
      "Studiengänge-Import (FH)",
      "KI-Coach (Desktop)",
      "Unbegrenzte Module & Noten",
      "Desktop ↔ Web Sync",
    ],
  },
  pro: {
    name: "Pro",
    price: 4.9,
    currency: "CHF",
    interval: "Monat",
    limits: {
      totalModules: Infinity,
      grades: Infinity,
      stundenplanEntries: Infinity,
    },
    features: [
      "Alles aus Free — ohne Limits",
      "Unbegrenzte Module & Noten",
      "Studiengänge-Import (FH)",
      "KI-Coach (Desktop-App)",
      "Desktop ↔ Web Echtzeit-Sync",
      "Prioritäts-Support",
    ],
  },
} as const;
