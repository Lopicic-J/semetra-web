/**
 * ═══════════════════════════════════════════════════════════════════════
 * SEMETRA DESIGN TOKENS — Dark Mode Contrast Reference
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This file is the SINGLE SOURCE OF TRUTH for how colors map between
 * light and dark mode. Every developer and AI agent working on Semetra
 * MUST consult this file before touching any color-related code.
 *
 * ── ARCHITECTURE ──
 *
 * We use CSS custom properties (variables) on :root and .dark.
 * Tailwind's `surface-*` and `brand-*` colors reference these variables
 * in tailwind.config.ts, so they adapt AUTOMATICALLY.
 *
 * The PROBLEM classes are:
 *   1. `bg-white dark:bg-surface-800` (161× in codebase) — hardcoded, doesn't adapt
 *   2. `text-white` (177×) — usually fine (white on colored bg)
 *   3. Tailwind standard colors: orange-*, red-*, green-*, etc.
 *   4. Inline styles with hex colors (75×)
 *
 * ── HOW WE SOLVE EACH ──
 *
 * 1. bg-white dark:bg-surface-800 → globals.css: `.dark .bg-white dark:bg-surface-800 { bg: var(--card-bg) }`
 * 2. text-white → KEEP (white on brand/colored buttons stays white)
 * 3. Standard Tailwind colors → globals.css overrides (see SEMANTIC_OVERRIDES)
 * 4. Inline styles → use helper functions from this file
 *
 * ── RULES ──
 *
 * Rule 1: NEVER use hardcoded hex in className. Use surface-* or brand-*.
 * Rule 2: For inline styles, use the dk() helper (returns CSS var string).
 * Rule 3: For new components, use the CSS utility classes defined below.
 * Rule 4: `text-surface-900` = primary text (dark in light, near-white in dark)
 * Rule 5: `text-surface-400` = muted/placeholder (mid-gray in both modes)
 */

/* ═══════════════════════════════════════════════════════════════════════
 * SURFACE SCALE — how the numbers map in each mode
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Shade │ Light Mode          │ Dark Mode            │ Used For
 * ──────┼─────────────────────┼──────────────────────┼───────────────
 *  50   │ #f8fafc (page bg)   │ #18181b (page bg)    │ Page background
 * 100   │ #f1f5f9 (subtle bg) │ #27272a (card bg)    │ Cards, sidebar
 * 200   │ #e2e8f0 (border)    │ #37373c (border)     │ Borders, dividers
 * 300   │ #cbd5e1 (disabled)  │ #4b4b52 (muted brd)  │ Disabled states
 * 400   │ #94a3b8 (placeholder)│ #8c8c96 (placeholder)│ Placeholder text
 * 500   │ #64748b (secondary) │ #b4b4bc (secondary)  │ Secondary text
 * 600   │ #475569 (body)      │ #d2d2d7 (body)       │ Body text
 * 700   │ #334155 (strong)    │ #e8e8eb (strong)     │ Strong/emphasis
 * 800   │ #1e293b (heading)   │ #f5f5f6 (heading)    │ Headings
 * 900   │ #0f172a (darkest)   │ #fcfcfc (brightest)  │ Primary text
 *
 * IMPORTANT: The numbers are SEMANTIC, not literal brightness.
 * surface-900 = "most prominent text" in BOTH modes.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * TEXT COLOR MAPPING — what to use where
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Purpose            │ Class              │ Light        │ Dark
 * ───────────────────┼────────────────────┼──────────────┼──────────
 * Page title         │ text-surface-900   │ near-black   │ near-white
 * Card heading       │ text-surface-900   │ near-black   │ near-white
 * Body text          │ text-surface-700   │ dark gray    │ light gray
 * Secondary label    │ text-surface-500   │ medium gray  │ medium gray
 * Placeholder/muted  │ text-surface-400   │ light gray   │ medium gray
 * Disabled           │ text-surface-300   │ very light   │ dim
 * On colored bg      │ text-white         │ white        │ white (keep!)
 * Brand link         │ text-brand-600     │ indigo       │ indigo (adapts)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * BACKGROUND MAPPING
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Purpose            │ Class / Var        │ Light        │ Dark
 * ───────────────────┼────────────────────┼──────────────┼──────────
 * Page               │ bg-surface-50      │ #f8fafc      │ #18181b
 * Card               │ .card / bg-white dark:bg-surface-800   │ #ffffff      │ #27272a
 * Sidebar            │ --card-bg          │ #ffffff      │ #27272a
 * Input field        │ .input             │ #ffffff      │ #27272a
 * Hover row          │ bg-surface-100     │ #f1f5f9      │ #27272a
 * Active/selected    │ bg-brand-50        │ light indigo │ dark indigo tint
 * Badge background   │ bg-brand-100       │ light indigo │ dark indigo tint
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SEMANTIC COLORS (success, warning, danger, info, orange)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * In LIGHT mode: bg-{color}-50 + text-{color}-700 + border-{color}-200
 * In DARK mode:  bg-{color}-900/20 + text-{color}-400 + border-{color}-800/40
 *
 * This means:
 *   - Light backgrounds become very subtle dark tints
 *   - Text becomes the LIGHTER shade (400) for readability
 *   - Borders become darker/subtler
 */

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Inline style colors that adapt to dark mode
// ═══════════════════════════════════════════════════════════════════════

/**
 * Use in components that need inline styles for dynamic colors.
 * Returns both light and dark variants; component picks based on theme.
 *
 * Example:
 *   const { resolvedMode } = useTheme();
 *   style={{ background: resolvedMode === "dark" ? "#27272a" : "#ffffff" }}
 */
export const DK = {
  // Backgrounds
  pageBg:    { light: "#f8fafc", dark: "#18181b" },
  cardBg:    { light: "#ffffff", dark: "#27272a" },
  hoverBg:   { light: "#f1f5f9", dark: "#303033" },
  // Borders
  border:    { light: "#e2e8f0", dark: "#37373c" },
  borderSoft:{ light: "rgba(226,232,240,0.6)", dark: "rgba(55,55,60,0.6)" },
  // Text
  textPrimary:   { light: "#0f172a", dark: "#fcfcfc" },
  textSecondary: { light: "#64748b", dark: "#b4b4bc" },
  textMuted:     { light: "#94a3b8", dark: "#8c8c96" },
  // Semantic soft backgrounds (for inline styles)
  dangerBg:  { light: "#fef2f2", dark: "rgba(220,38,38,0.12)" },
  warningBg: { light: "#fff7ed", dark: "rgba(217,119,6,0.12)" },
  successBg: { light: "#f0fdf4", dark: "rgba(22,163,74,0.12)" },
  infoBg:    { light: "#eff6ff", dark: "rgba(37,99,235,0.12)" },
  // Semantic text
  dangerText:  { light: "#b91c1c", dark: "#fca5a5" },
  warningText: { light: "#b45309", dark: "#fdba74" },
  successText: { light: "#15803d", dark: "#86efac" },
} as const;

/**
 * Quick helper: pick light or dark value based on resolved mode.
 * Usage: dk(resolvedMode, DK.cardBg)
 */
export function dk(mode: "light" | "dark", token: { light: string; dark: string }): string {
  return mode === "dark" ? token.dark : token.light;
}

/**
 * For mind map / visualization node backgrounds that use color+alpha.
 * In light mode: faint color on white (#color15)
 * In dark mode: stronger color tint on dark bg (#color30)
 */
export function nodeGradient(color: string, isDark: boolean, isRoot: boolean): string {
  if (isDark) {
    const opacity = isRoot ? "40" : "25";
    return `linear-gradient(135deg, ${color}${opacity} 0%, ${color}15 100%)`;
  }
  const opacity = isRoot ? "15" : "08";
  return `linear-gradient(135deg, ${color}${opacity} 0%, ${color}05 100%)`;
}
