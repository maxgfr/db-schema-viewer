"use client";

import { useEffect } from "react";
import {
  I18nProvider,
  useTranslation,
  type Locale,
} from "@/lib/i18n/context";
import { Globe } from "lucide-react";

function HtmlLangUpdater() {
  const { locale } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

function LanguageToggle() {
  const { locale, setLocale } = useTranslation();
  const next: Locale = locale === "en" ? "fr" : "en";
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title={locale === "en" ? "Passer en fran\u00e7ais" : "Switch to English"}
      aria-label={locale === "en" ? "Switch to French" : "Passer en anglais"}
    >
      <Globe className="h-4 w-4" />
    </button>
  );
}

export function I18nWrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <HtmlLangUpdater />
      {children}
    </I18nProvider>
  );
}

export { LanguageToggle };
