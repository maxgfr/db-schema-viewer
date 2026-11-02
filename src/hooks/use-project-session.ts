"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveProject, stashUnsavedProject } from "@/lib/storage/project-storage";
import type { Project } from "@/lib/project/project";

export type SaveStatus = "saving" | "saved" | "error";

export interface ProjectSessionOptions {
  /** Asked when unsaved work would be lost; returning true discards it. */
  confirmDiscard?: () => boolean;
  /** Called once per project when storage is full and its source code was not saved. */
  onSourceDropped?: () => void;
}

export function useProjectSession(options: ProjectSessionOptions = {}) {
  const [sessionKey, setSessionKey] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const current = useRef<Project | null>(null);
  const persisted = useRef<Project | null>(null);
  const sourceDroppedFor = useRef<string | null>(null);
  const saveFailed = useRef(false);
  const callbacks = useRef(options);
  useEffect(() => { callbacks.current = options; });

  // Saves run one after another, so an older snapshot never lands after a newer one.
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));

  const flush = useCallback((): Promise<boolean> => {
    const run = async () => {
      const snapshot = current.current;
      if (!snapshot || snapshot === persisted.current) return true;
      try {
        const { sourceDropped } = await saveProject(snapshot);
        persisted.current = snapshot;
        saveFailed.current = false;
        if (current.current === snapshot) setSaveStatus("saved");
        const id = snapshot.diagram.id;
        if (sourceDropped && sourceDroppedFor.current !== id) {
          sourceDroppedFor.current = id;
          callbacks.current.onSourceDropped?.();
        }
        return true;
      } catch {
        saveFailed.current = true;
        if (current.current === snapshot) setSaveStatus("error");
        return false;
      }
    };
    queue.current = queue.current.then(run);
    return queue.current;
  }, []);

  /** Saves pending work, or lets the user knowingly discard it when saving fails. */
  const leaveCurrent = useCallback(async () => {
    if (await flush()) return true;
    return callbacks.current.confirmDiscard?.() ?? false;
  }, [flush]);

  const openProject = useCallback(async (next: Project) => {
    // Retain an unsaved project in memory until the user retries, exports or discards it.
    if (!(await leaveCurrent())) return false;
    current.current = next;
    setProject(next);
    setSessionKey((key) => key + 1);
    setSaveStatus("saving");
    return true;
  }, [leaveCurrent]);

  const updateProject = useCallback((update: Partial<Project> | ((project: Project) => Partial<Project>)) => {
    if (!current.current) return;
    const patch = typeof update === "function" ? update(current.current) : update;
    const next = { ...current.current, ...patch, updatedAt: new Date().toISOString() };
    current.current = next;
    setProject(next);
    setSaveStatus("saving");
  }, []);

  const closeProject = useCallback(async () => {
    if (!(await leaveCurrent())) return false;
    current.current = null;
    setProject(null);
    setSaveStatus("saved");
    return true;
  }, [leaveCurrent]);

  useEffect(() => {
    if (!project) return;
    const timer = setTimeout(() => { void flush(); }, 500);
    return () => clearTimeout(timer);
  }, [project, flush]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const pending = current.current;
      if (!pending || pending === persisted.current) return;
      void flush();
      // IndexedDB may not finish before the page goes: keep a copy for the next start (a
      // reload), and ask the user to stay when saving already failed or even that is refused.
      if (!stashUnsavedProject(pending) || saveFailed.current) event.preventDefault();
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") void flush(); };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flush]);

  return { project, sessionKey, saveStatus, openProject, updateProject, closeProject, flush };
}
