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

  // Route redirects for Phase 2 sidebar consolidation
  async redirects() {
    return [
      // Calendar + Stundenplan → /schedule
      { source: "/calendar", destination: "/schedule?tab=calendar", permanent: true },
      { source: "/stundenplan", destination: "/schedule?tab=stundenplan", permanent: true },
      // Lernplan + Flashcards + Knowledge + Timer → /learning
      { source: "/lernplan", destination: "/learning?tab=lernplan", permanent: true },
      { source: "/flashcards", destination: "/learning?tab=flashcards", permanent: true },
      { source: "/knowledge", destination: "/learning?tab=knowledge", permanent: true },
      { source: "/timer", destination: "/learning?tab=timer", permanent: true },
      // Notes + Documents → /materials
      { source: "/notes", destination: "/materials?tab=notes", permanent: true },
      { source: "/documents", destination: "/materials?tab=documents", permanent: true },
      // Mindmaps + Brainstorming → /creative
      { source: "/mindmaps", destination: "/creative?tab=mindmaps", permanent: true },
      { source: "/brainstorming", destination: "/creative?tab=brainstorming", permanent: true },
      // Studienplan + Timeline → /progress
      { source: "/studienplan", destination: "/progress?tab=studienplan", permanent: true },
      { source: "/timeline", destination: "/progress?tab=timeline", permanent: true },
      // Credits + Transcript → /grades
      { source: "/credits", destination: "/grades?tab=credits", permanent: true },
      { source: "/transcript", destination: "/grades?tab=transcript", permanent: true },
      // Leaderboard → /achievements
      { source: "/leaderboard", destination: "/achievements?tab=leaderboard", permanent: true },
      // Navigator → Dashboard
      { source: "/navigator", destination: "/dashboard", permanent: true },
      // About → Settings (about tab)
      { source: "/about", destination: "/settings", permanent: true },
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
  },
};

export default nextConfig;
