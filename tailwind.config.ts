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
        // ── Brand / Accent (via CSS variables → dynamic accent switching) ──
        brand: {
          50:  "rgb(var(--accent-50)  / <alpha-value>)",
          100: "rgb(var(--accent-100) / <alpha-value>)",
          200: "rgb(var(--accent-200) / <alpha-value>)",
          300: "rgb(var(--accent-300) / <alpha-value>)",
          400: "rgb(var(--accent-400) / <alpha-value>)",
          500: "rgb(var(--accent-500) / <alpha-value>)",
          600: "rgb(var(--accent-600) / <alpha-value>)",
          700: "rgb(var(--accent-700) / <alpha-value>)",
          800: "rgb(var(--accent-800) / <alpha-value>)",
          900: "rgb(var(--accent-900) / <alpha-value>)",
          950: "rgb(var(--accent-950) / <alpha-value>)",
        },
        // ── Surface neutrals (via CSS variables → dark mode) ──
        surface: {
          50:  "rgb(var(--sf-50)  / <alpha-value>)",
          100: "rgb(var(--sf-100) / <alpha-value>)",
          200: "rgb(var(--sf-200) / <alpha-value>)",
          300: "rgb(var(--sf-300) / <alpha-value>)",
          400: "rgb(var(--sf-400) / <alpha-value>)",
          500: "rgb(var(--sf-500) / <alpha-value>)",
          600: "rgb(var(--sf-600) / <alpha-value>)",
          700: "rgb(var(--sf-700) / <alpha-value>)",
          800: "rgb(var(--sf-800) / <alpha-value>)",
          900: "rgb(var(--sf-900) / <alpha-value>)",
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
