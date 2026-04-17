/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable X-Powered-By header
  poweredByHeader: false,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "semetra.ch",
      },
      {
        protocol: "https",
        hostname: "www.semetra.ch",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), document-domain=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), speaker-selection=(), sync-xhr=(), usb=(), vr=(), xr-spatial-tracking=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  // Route redirects — only legacy routes that no longer have standalone pages
  async redirects() {
    return [
      // Old hub routes → redirect to their first child (standalone pages now exist)
      { source: "/creative", destination: "/mindmaps", permanent: true },
      { source: "/about", destination: "/settings", permanent: true },
      // Consolidated routes — reduce duplicate pages
      { source: "/leaderboard", destination: "/bestenliste", permanent: true },
      { source: "/grades", destination: "/noten", permanent: true },
      { source: "/achievements", destination: "/erfolge", permanent: true },
      { source: "/schedule", destination: "/calendar", permanent: true },
      { source: "/insights", destination: "/review", permanent: true },
      { source: "/progress", destination: "/overview", permanent: true },
      { source: "/fortschritt", destination: "/overview", permanent: true },
    ];
  },

  // Compiler optimizations
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  // Server actions
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "clsx",
      "date-fns",
    ],
  },

  // Bundle analyzer (enable with ANALYZE=true)
  ...(process.env.ANALYZE === "true" ? { webpack: (config) => config } : {}),
};

export default nextConfig;
