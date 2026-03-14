"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { Diagram } from "@/lib/domain";
import { getStateFromUrl, generateShareUrl } from "@/lib/sharing/encode-state";
import { saveDiagram } from "@/lib/storage/local-storage";
import { useTheme } from "@/hooks/use-theme";
import { Landing } from "./_components/landing/Landing";
import { EditorLayout } from "./_components/canvas/EditorLayout";

export default function Home() {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { theme, mode, toggleTheme } = useTheme();
  const urlSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);

    // Priority: URL param > last opened diagram
    const hasUrlParam = typeof window !== "undefined" && /[?&]d=/.test(window.location.search);
    if (hasUrlParam) {
      const fromUrl = getStateFromUrl();
      if (fromUrl) {
        setDiagram(fromUrl);
      } else {
        toast.error("Failed to load shared schema", {
          description: "The URL may be corrupted or truncated. Try getting a fresh share link.",
        });
      }
      return;
    }
  }, []);

  // Keep URL in sync with current diagram (debounced to avoid lag on drag)
  useEffect(() => {
    if (!diagram) return;
    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => {
      const url = generateShareUrl(diagram);
      const parsed = new URL(url);
      window.history.replaceState({}, "", parsed.pathname + parsed.search);
    }, 500);
    return () => { if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current); };
  }, [diagram]);

  // Warn before reload/close only when there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const handleDiagramCreated = useCallback((d: Diagram) => {
    setDiagram(d);
    saveDiagram(d);
    setHasUnsavedChanges(false);
  }, []);

  const handleDiagramUpdated = useCallback((d: Diagram) => {
    const updated = { ...d, updatedAt: new Date().toISOString() };
    setDiagram(updated);
    saveDiagram(updated);
    setHasUnsavedChanges(true);
  }, []);

  const handleBack = useCallback(() => {
    setDiagram(null);
    // Clear URL param
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("d");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (!mounted) return null;

  if (diagram) {
    return (
      <EditorLayout
        diagram={diagram}
        onDiagramUpdate={handleDiagramUpdated}
        onBack={handleBack}
        theme={theme}
        themeMode={mode}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <Landing
      onDiagramCreated={handleDiagramCreated}
      theme={theme}
      themeMode={mode}
      onToggleTheme={toggleTheme}
    />
  );
}
