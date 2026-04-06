"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { en } from "./translations/en";
import { fr } from "./translations/fr";
import { de } from "./translations/de";
import { it } from "./translations/it";
import { es } from "./translations/es";
import { zh } from "./translations/zh";
import { ja } from "./translations/ja";
import { ru } from "./translations/ru";

export type Locale = "en" | "fr" | "de" | "it" | "es" | "zh" | "ja" | "ru";

const STORAGE_KEY = "db-schema-viewer-locale";

const allTranslations: Record<Locale, Record<string, string>> = { en, fr, de, it, es, zh, ja, ru };

let globalLocale: Locale = "en";

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (
      stored === "en" ||
      stored === "fr" ||
      stored === "de" ||
      stored === "it" ||
      stored === "es" ||
      stored === "zh" ||
      stored === "ja" ||
      stored === "ru"
    )
      return stored;
  } catch {}
  const validLocales: Locale[] = ["en", "fr", "de", "it", "es", "zh", "ja", "ru"];
  const browserLang = navigator.language.split("-")[0];
  if (validLocales.includes(browserLang as Locale)) return browserLang as Locale;
  return "en";
}

function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  let str = allTranslations[locale]?.[key] ?? allTranslations.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

export function setGlobalLocale(locale: Locale) {
  globalLocale = locale;
}

export function getLocale(): Locale {
  return globalLocale;
}

export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  return translate(globalLocale, key, params);
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}

// Detect locale once at module level to avoid flash of wrong language
const initialLocale: Locale = typeof window !== "undefined" ? detectLocale() : "en";
globalLocale = initialLocale;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setGlobalLocale(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
  }, []);

  const tFn = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: tFn }}>
      {children}
    </I18nContext.Provider>
  );
}
