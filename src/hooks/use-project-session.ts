"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveProject } from "@/lib/storage/local-storage";
import type { Project } from "@/lib/project/project";

export type SaveStatus = "saving" | "saved" | "error";

export function useProjectSession() {
  const [sessionKey, setSessionKey] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const current = useRef<Project | null>(null);
  const persisted = useRef<Project | null>(null);

  const flush = useCallback(() => {
    if (!current.current || current.current === persisted.current) return true;
    try {
      saveProject(current.current);
      persisted.current = current.current;
      setSaveStatus("saved");
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }, []);

  const openProject = useCallback((next: Project) => {
    // Retain an unsaved project in memory until the user can retry or export it.
    if (!flush()) return false;
    current.current = next;
    setProject(next);
    setSessionKey((key) => key + 1);
    setSaveStatus("saving");
    return true;
  }, [flush]);

  const updateProject = useCallback((update: Partial<Project> | ((project: Project) => Partial<Project>)) => {
    if (!current.current) return;
    const patch = typeof update === "function" ? update(current.current) : update;
    const next = { ...current.current, ...patch, updatedAt: new Date().toISOString() };
    current.current = next;
    setProject(next);
    setSaveStatus("saving");
  }, []);

  const closeProject = useCallback(() => {
    if (!flush()) return false;
    current.current = null;
    setProject(null);
    return true;
  }, [flush]);

  useEffect(() => {
    if (!project) return;
    const timer = setTimeout(flush, 500);
    return () => clearTimeout(timer);
  }, [project, flush]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!flush()) event.preventDefault();
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flush]);

  return { project, sessionKey, saveStatus, openProject, updateProject, closeProject, flush };
}
