/**
 * Environment Variable Validation
 *
 * Validates required env vars and provides typed access.
 * Throws at build time if critical vars are missing.
 */

const requiredServer = [
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const requiredPublic = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const optionalServer = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
] as const;

function validateEnv() {
  const missing: string[] = [];

  for (const key of requiredPublic) {
    if (!process.env[key]) missing.push(key);
  }

  // Server vars only checked server-side
  if (typeof window === "undefined") {
    for (const key of requiredServer) {
      if (!process.env[key]) missing.push(key);
    }
  }

  if (missing.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(
      `Missing required environment variables:\n${missing.map(k => `  - ${k}`).join("\n")}\n` +
      `Check .env.local or your deployment settings.`
    );
  }

  if (missing.length > 0) {
    console.warn(
      `[env] Missing environment variables (non-fatal in dev):\n${missing.map(k => `  - ${k}`).join("\n")}`
    );
  }
}

// Run validation on import
validateEnv();

/** Typed env access helpers */
export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    proPriceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  },
  ai: {
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  },
  sentry: {
    dsn: process.env.SENTRY_DSN ?? "",
    authToken: process.env.SENTRY_AUTH_TOKEN ?? "",
  },
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",
} as const;
