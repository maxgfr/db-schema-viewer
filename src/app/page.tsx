"use client";

import { useState, useEffect, useCallback } from "react";
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
  const { theme, mode, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);

    // Priority: URL param > last opened diagram
    const hasUrlParam = typeof window !== "undefined" && /[?&]d=/.test(window.location.search);
    if (hasUrlParam) {
      console.log("[db-schema-viewer] URL has ?d= param, attempting to decode...");
      console.log("[db-schema-viewer] search length:", window.location.search.length);
      const fromUrl = getStateFromUrl();
      if (fromUrl) {
        console.log("[db-schema-viewer] Decoded OK:", fromUrl.tables.length, "tables,", fromUrl.relationships.length, "rels");
        setDiagram(fromUrl);
      } else {
        console.error("[db-schema-viewer] Failed to decode URL — see warnings above for details");
        toast.error("Failed to load shared schema", {
          description: "The URL may be corrupted or truncated. Try getting a fresh share link.",
        });
      }
      return;
    }
  }, []);

  // Keep URL in sync with current diagram so users can copy it directly
  useEffect(() => {
    if (!diagram) return;
    const url = generateShareUrl(diagram);
    // Extract path + search from the full URL
    const parsed = new URL(url);
    window.history.replaceState({}, "", parsed.pathname + parsed.search);
  }, [diagram]);

  // Warn before reload/close when a diagram is loaded
  useEffect(() => {
    if (!diagram) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [diagram]);

  const handleDiagramCreated = useCallback((d: Diagram) => {
    setDiagram(d);
    saveDiagram(d);
  }, []);

  const handleDiagramUpdated = useCallback((d: Diagram) => {
    const updated = { ...d, updatedAt: new Date().toISOString() };
    setDiagram(updated);
    saveDiagram(updated);
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
