"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { type Locale, DEFAULT_LOCALE, COUNTRY_TO_LOCALE } from "./types";
import { useProfile } from "@/lib/hooks/useProfile";

/* ── translation cache ── */
const cache: Partial<Record<Locale, Record<string, string>>> = {};

async function loadLocale(locale: Locale): Promise<Record<string, string>> {
  if (cache[locale]) return cache[locale]!;
  try {
    const mod = await import(`./locales/${locale}.json`);
    const data = mod.default ?? mod;
    cache[locale] = data;
    return data;
  } catch {
    // fallback to German if locale file missing
    if (locale !== DEFAULT_LOCALE) return loadLocale(DEFAULT_LOCALE);
    return {};
  }
}

/* ── context ── */
interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  ready: false,
});

/* ── provider ── */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [fallback, setFallback] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  // Derive initial locale from profile.language or profile.country
  useEffect(() => {
    if (!profile) return;
    const profileLang = (profile as any).language as Locale | undefined;
    if (profileLang && profileLang !== locale) {
      setLocaleState(profileLang);
    } else if (!profileLang && profile.country) {
      const derived = COUNTRY_TO_LOCALE[profile.country] ?? DEFAULT_LOCALE;
      if (derived !== locale) setLocaleState(derived);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Load messages when locale changes
  useEffect(() => {
    let active = true;
    (async () => {
      const [msgs, fb] = await Promise.all([
        loadLocale(locale),
        locale !== DEFAULT_LOCALE ? loadLocale(DEFAULT_LOCALE) : Promise.resolve({}),
      ]);
      if (!active) return;
      setMessages(msgs);
      setFallback(fb);
      setReady(true);
      // Set html lang attribute
      document.documentElement.lang = locale;
    })();
    return () => { active = false; };
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    // Persist to localStorage for immediate effect on next load
    try { localStorage.setItem("semetra-locale", l); } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let text = messages[key] ?? fallback[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return text;
    },
    [messages, fallback]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/* ── hook ── */
export function useTranslation() {
  return useContext(I18nContext);
}
