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

const LANGUAGES: { value: Locale; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "EN" },
  { value: "fr", label: "Français", flag: "FR" },
  { value: "de", label: "Deutsch", flag: "DE" },
  { value: "it", label: "Italiano", flag: "IT" },
  { value: "es", label: "Español", flag: "ES" },
  { value: "zh", label: "中文", flag: "ZH" },
  { value: "ja", label: "日本語", flag: "JA" },
  { value: "ru", label: "Русский", flag: "RU" },
];

function LanguageToggle() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1 rounded-lg p-1 text-muted-foreground">
      <Globe className="h-3.5 w-3.5" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none"
        aria-label="Language"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.flag}
          </option>
        ))}
      </select>
    </div>
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
