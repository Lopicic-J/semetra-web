import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Sapphire brand palette ─────────────────────────────
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",   // ← Primary
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // ── Warm slate neutrals (statt kaltem gray) ───────────
        surface: {
          50:  "#f8fafc",   // Page background
          100: "#f1f5f9",   // Subtle card bg / hover
          200: "#e2e8f0",   // Borders
          300: "#cbd5e1",   // Disabled / muted borders
          400: "#94a3b8",   // Placeholder text
          500: "#64748b",   // Secondary text
          600: "#475569",   // Body text
          700: "#334155",   // Strong text
          800: "#1e293b",   // Headings
          900: "#0f172a",   // Darkest text
        },
        // ── Semantic accents (muted & harmonisch) ─────────────
        success: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        warning: {
          50:  "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          50:  "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
        },
        info: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "card":     "0 1px 3px 0 rgba(15,23,42,.04), 0 1px 2px -1px rgba(15,23,42,.04)",
        "card-md":  "0 4px 6px -1px rgba(15,23,42,.06), 0 2px 4px -2px rgba(15,23,42,.04)",
        "card-lg":  "0 10px 15px -3px rgba(15,23,42,.06), 0 4px 6px -4px rgba(15,23,42,.04)",
        "modal":    "0 20px 60px -10px rgba(15,23,42,.2)",
        "sidebar":  "1px 0 0 0 rgba(15,23,42,.06)",
        "inner":    "inset 0 1px 2px 0 rgba(15,23,42,.04)",
      },
      animation: {
        "fade-in":    "fadeIn 0.2s ease-out",
        "slide-up":   "slideUp 0.25s ease-out",
        "slide-left": "slideLeft 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:   { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideLeft: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
