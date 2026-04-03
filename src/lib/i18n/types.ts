/* ─── i18n type definitions ─── */

export type Locale = "de" | "en" | "fr" | "it" | "es" | "nl";

export const LOCALES: Locale[] = ["de", "en", "fr", "it", "es", "nl"];

export const LOCALE_LABELS: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  nl: "Nederlands",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  fr: "🇫🇷",
  it: "🇮🇹",
  es: "🇪🇸",
  nl: "🇳🇱",
};

/** Map country codes from grading system to UI locale */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  CH: "de",
  DE: "de",
  AT: "de",
  FR: "fr",
  IT: "it",
  NL: "nl",
  ES: "es",
  UK: "en",
};

export const DEFAULT_LOCALE: Locale = "de";
