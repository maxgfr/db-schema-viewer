"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { getStateFromUrl, generateShareUrl, encodeState } from "@/lib/sharing/encode-state";
import { createProject, type Project } from "@/lib/project/project";
import { loadProject } from "@/lib/storage/local-storage";
import { useProjectSession } from "@/hooks/use-project-session";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/lib/i18n/context";
import { Landing } from "./_components/landing/Landing";
import { EditorLayout } from "./_components/canvas/EditorLayout";

export default function Home() {
  const { project, sessionKey, saveStatus, openProject, updateProject, closeProject, flush } = useProjectSession();
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);
  const { theme, mode, toggleTheme } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setMounted(true);
    if (!window.location.hash.startsWith("#d=")) return;
    const shared = getStateFromUrl();
    if (!shared) {
      toast.error(t("page.failedToLoadSharedSchema"), { description: t("page.failedToLoadSharedSchemaDesc") });
      return;
    }
    const stored = loadProject(shared.diagram.id);
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type === "reload" && stored) {
      openProject(stored);
      return;
    }
    // Only restore a source belonging to exactly the same shared schema and layout.
    if (stored?.diagram.sourceContent && encodeState(stored.diagram) === encodeState(shared.diagram)) {
      shared.diagram.sourceContent = stored.diagram.sourceContent;
    }
    openProject({ ...createProject(shared.diagram), ...shared });
  }, [openProject, t]);

  useEffect(() => {
    if (!project) return;
    const timer = setTimeout(() => {
      try {
        const url = new URL(generateShareUrl(project.diagram, project.annotations, project.viewSettings));
        window.history.replaceState({}, "", window.location.pathname + window.location.search + url.hash);
      } catch {
        // Local persistence remains available if the browser refuses a very large URL.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [project]);

  const handleOpen = useCallback((next: Project) => {
    if (!openProject(next)) toast.error(t("project.saveError"));
  }, [openProject, t]);

  const handleBack = useCallback(() => {
    if (!closeProject()) { toast.error(t("project.saveError")); return; }
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
  }, [closeProject, t]);

  if (!mounted) return null;
  if (!project) return <Landing onProjectOpened={handleOpen} theme={theme} themeMode={mode} onToggleTheme={toggleTheme} />;
  return (
    <EditorLayout
      key={`${project.diagram.id}-${sessionKey}`}
      project={project}
      onProjectChange={updateProject}
      onProjectOpened={handleOpen}
      saveStatus={saveStatus}
      onSave={flush}
      onBack={handleBack}
      theme={theme}
      themeMode={mode}
      onToggleTheme={toggleTheme}
    />
  );
}
