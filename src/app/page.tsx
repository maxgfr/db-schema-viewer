"use client";

import { useState, useEffect, useCallback } from "react";
import type { Diagram } from "@/lib/domain";
import { getStateFromUrl } from "@/lib/sharing/encode-state";
import { saveDiagram } from "@/lib/storage/local-storage";
import { Landing } from "./_components/landing/Landing";
import { EditorLayout } from "./_components/canvas/EditorLayout";

export default function Home() {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Priority: URL param > last opened diagram
    const fromUrl = getStateFromUrl();
    if (fromUrl) {
      setDiagram(fromUrl);
      return;
    }
  }, []);

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
      />
    );
  }

  return <Landing onDiagramCreated={handleDiagramCreated} />;
}
