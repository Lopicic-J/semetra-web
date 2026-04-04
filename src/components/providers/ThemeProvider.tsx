"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ACCENT COLOR PALETTES                                                      */
/* Each palette = 11 shades (50–950) as space-separated RGB triplets          */
/* ═══════════════════════════════════════════════════════════════════════════ */

export type AccentKey = "indigo" | "blue" | "emerald" | "rose" | "amber" | "violet" | "cyan" | "orange";

export interface AccentPalette {
  key: AccentKey;
  label: string;
  /** Preview swatch (600-shade hex) */
  swatch: string;
  /** CSS variable values: 50→950 as "R G B" strings */
  shades: Record<string, string>;
}

const ACCENT_PALETTES: AccentPalette[] = [
  {
    key: "indigo", label: "Indigo", swatch: "#4f46e5",
    shades: {
      50: "238 242 255", 100: "224 231 255", 200: "199 210 254", 300: "165 180 252",
      400: "129 140 248", 500: "99 102 241", 600: "79 70 229", 700: "67 56 202",
      800: "55 48 163", 900: "49 46 129", 950: "30 27 75",
    },
  },
  {
    key: "blue", label: "Blue", swatch: "#2563eb",
    shades: {
      50: "239 246 255", 100: "219 234 254", 200: "191 219 254", 300: "147 197 253",
      400: "96 165 250", 500: "59 130 246", 600: "37 99 235", 700: "29 78 216",
      800: "30 64 175", 900: "30 58 138", 950: "23 37 84",
    },
  },
  {
    key: "emerald", label: "Emerald", swatch: "#059669",
    shades: {
      50: "236 253 245", 100: "209 250 229", 200: "167 243 208", 300: "110 231 183",
      400: "52 211 153", 500: "16 185 129", 600: "5 150 105", 700: "4 120 87",
      800: "6 95 70", 900: "6 78 59", 950: "2 44 34",
    },
  },
  {
    key: "rose", label: "Rose", swatch: "#e11d48",
    shades: {
      50: "255 241 242", 100: "255 228 230", 200: "254 205 211", 300: "253 164 175",
      400: "251 113 133", 500: "244 63 94", 600: "225 29 72", 700: "190 18 60",
      800: "159 18 57", 900: "136 19 55", 950: "76 5 25",
    },
  },
  {
    key: "amber", label: "Amber", swatch: "#d97706",
    shades: {
      50: "255 251 235", 100: "254 243 199", 200: "253 230 138", 300: "252 211 77",
      400: "251 191 36", 500: "245 158 11", 600: "217 119 6", 700: "180 83 9",
      800: "146 64 14", 900: "120 53 15", 950: "69 26 3",
    },
  },
  {
    key: "violet", label: "Violet", swatch: "#7c3aed",
    shades: {
      50: "245 243 255", 100: "237 233 254", 200: "221 214 254", 300: "196 181 253",
      400: "167 139 250", 500: "139 92 246", 600: "124 58 237", 700: "109 40 217",
      800: "91 33 182", 900: "76 29 149", 950: "46 16 101",
    },
  },
  {
    key: "cyan", label: "Cyan", swatch: "#0891b2",
    shades: {
      50: "236 254 255", 100: "207 250 254", 200: "165 243 252", 300: "103 232 249",
      400: "34 211 238", 500: "6 182 212", 600: "8 145 178", 700: "14 116 144",
      800: "21 94 117", 900: "22 78 99", 950: "8 51 68",
    },
  },
  {
    key: "orange", label: "Orange", swatch: "#ea580c",
    shades: {
      50: "255 247 237", 100: "255 237 213", 200: "254 215 170", 300: "253 186 116",
      400: "251 146 60", 500: "249 115 22", 600: "234 88 12", 700: "194 65 12",
      800: "154 52 18", 900: "124 45 18", 950: "67 20 7",
    },
  },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
/* THEME CONTEXT                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  /** Resolved = what's actually applied (never "system") */
  resolvedMode: "light" | "dark";
  palettes: AccentPalette[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* STORAGE KEYS                                                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_MODE   = "semetra_theme_mode";
const STORAGE_ACCENT = "semetra_theme_accent";

/* ═══════════════════════════════════════════════════════════════════════════ */
/* PROVIDER                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [accent, setAccentState] = useState<AccentKey>("indigo");
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("light");

  // ── Hydrate from localStorage ──
  useEffect(() => {
    const savedMode = localStorage.getItem(STORAGE_MODE) as ThemeMode | null;
    const savedAccent = localStorage.getItem(STORAGE_ACCENT) as AccentKey | null;
    if (savedMode && ["light", "dark", "system"].includes(savedMode)) setModeState(savedMode);
    if (savedAccent) setAccentState(savedAccent);
  }, []);

  // ── Resolve mode (system → actual) ──
  useEffect(() => {
    const resolve = () => {
      const resolved = mode === "system" ? getSystemPreference() : mode;
      setResolvedMode(resolved);
      // Toggle class on <html>
      const html = document.documentElement;
      html.classList.toggle("dark", resolved === "dark");
    };
    resolve();

    // Listen to OS theme changes when mode=system
    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => resolve();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  // ── Apply accent CSS variables ──
  useEffect(() => {
    const palette = ACCENT_PALETTES.find(p => p.key === accent) ?? ACCENT_PALETTES[0];
    const root = document.documentElement;
    for (const [shade, rgb] of Object.entries(palette.shades)) {
      root.style.setProperty(`--accent-${shade}`, rgb);
    }
  }, [accent]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_MODE, m);
  }, []);

  const setAccent = useCallback((a: AccentKey) => {
    setAccentState(a);
    localStorage.setItem(STORAGE_ACCENT, a);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, accent, setAccent, resolvedMode, palettes: ACCENT_PALETTES }}>
      {children}
    </ThemeContext.Provider>
  );
}
