import { createBrowserClient } from "@supabase/ssr";

// Guaranteed singleton — prevents multiple client instances across renders
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build-time prerender, env vars may be missing — return a
  // lightweight stub so the page can be generated without crashing.
  if (!url || !key) {
    if (typeof window === "undefined") {
      // SSR / build: return a stub that won't be used at runtime
      return createBrowserClient(
        "https://placeholder.supabase.co",
        "placeholder-key",
      );
    }
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  client = createBrowserClient(url, key);
  return client;
}
