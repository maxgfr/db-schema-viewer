"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { Diagram } from "db-schema-toolkit";
import { getStateFromUrl, generateShareUrl, type SharedViewSettings } from "@/lib/sharing/encode-state";
import type { Annotation } from "./_components/canvas/SchemaCanvas";
import { saveDiagram } from "@/lib/storage/local-storage";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/lib/i18n/context";
import { Landing } from "./_components/landing/Landing";
import { EditorLayout } from "./_components/canvas/EditorLayout";

export default function Home() {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [sharedAnnotations, setSharedAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotations, setCurrentAnnotations] = useState<Annotation[]>([]);
  const [sharedViewSettings, setSharedViewSettings] = useState<SharedViewSettings>({});
  const [currentViewSettings, setCurrentViewSettings] = useState<SharedViewSettings>({});
  const [mounted, setMounted] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { theme, mode, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const urlSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);

    // Priority: URL param > last opened diagram
    const hasUrlParam = typeof window !== "undefined" && /^#d=/.test(window.location.hash);
    if (hasUrlParam) {
      const fromUrl = getStateFromUrl();
      if (fromUrl) {
        setDiagram(fromUrl.diagram);
        if (fromUrl.annotations.length > 0) setSharedAnnotations(fromUrl.annotations);
        if (fromUrl.viewSettings) setSharedViewSettings(fromUrl.viewSettings);
      } else {
        toast.error(t("page.failedToLoadSharedSchema"), {
          description: t("page.failedToLoadSharedSchemaDesc"),
        });
      }
      return;
    }
  }, [t]);

  // Keep URL in sync with current diagram + annotations + view settings (debounced)
  useEffect(() => {
    if (!diagram) return;
    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => {
      const url = generateShareUrl(
        diagram,
        currentAnnotations.length > 0 ? currentAnnotations : undefined,
        currentViewSettings,
      );
      const parsed = new URL(url);
      window.history.replaceState({}, "", parsed.pathname + parsed.hash);
    }, 500);
    return () => { if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current); };
  }, [diagram, currentAnnotations, currentViewSettings]);

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
    // Clear URL hash
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
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
        initialAnnotations={sharedAnnotations}
        onAnnotationsChange={setCurrentAnnotations}
        initialViewSettings={sharedViewSettings}
        onViewSettingsChange={setCurrentViewSettings}
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
