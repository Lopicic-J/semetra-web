import Stripe from "stripe";

// Server-side Stripe instance (only used in API routes / server components)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";

// Plans config — used client-side too (no secrets here)
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    currency: "CHF",
    limits: {
      modulesPerSemester: 2,
      stundenplanEntries: 4,
    },
    features: [
      "Bis zu 2 Module pro Semester",
      "Aufgaben & Kalender",
      "Noten & ECTS-Tracking",
      "Studiengänge-Import",
      "Lernziele & Spaced Repetition",
      "Timer",
    ],
    lockedFeatures: [
      "KI-Coach & AI-Features",
      "FFHS Portal Import (Scrap)",
      "Unbegrenzte Module",
      "Desktop ↔ Web Sync",
    ],
  },
  pro: {
    name: "Pro",
    price: 9.9,
    currency: "CHF",
    interval: "Monat",
    limits: {
      modulesPerSemester: Infinity,
      stundenplanEntries: Infinity,
    },
    features: [
      "Alles aus Free",
      "Unbegrenzte Module",
      "KI-Coach & AI-Zusammenfassungen",
      "FFHS Portal Import (Scrap)",
      "Desktop ↔ Web Echtzeit-Sync",
      "Prioritäts-Support",
    ],
  },
} as const;
