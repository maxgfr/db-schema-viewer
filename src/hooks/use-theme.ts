"use client";

import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type Theme = "dark" | "light";

const STORAGE_KEY = "db-schema-viewer-theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  let stored: string | null = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch {}
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function resolveTheme(mode: ThemeMode): Theme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [theme, setThemeState] = useState<Theme>("dark");

  // Init from localStorage
  useEffect(() => {
    const initial = getInitialMode();
    setModeState(initial);
    setThemeState(resolveTheme(initial));
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  }, [theme]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setThemeState(getSystemTheme());
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "light" ? "dark" : prev === "dark" ? "system" : "light";
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      setThemeState(resolveTheme(next));
      return next;
    });
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setModeState(t);
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }, []);

  return { theme, mode, toggleTheme, setTheme };
}
