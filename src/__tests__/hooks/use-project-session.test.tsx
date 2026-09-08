import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useProjectSession } from "@/hooks/use-project-session";
import { createProject } from "@/lib/project/project";
import { loadProject } from "@/lib/storage/local-storage";
const project = createProject({ id: "a", name: "A", databaseType: "postgresql", tables: [], relationships: [], createdAt: "2026-01-01" });
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("saves all changes together and restores notes and view", () => {
  const { result } = renderHook(useProjectSession);
  act(() => { result.current.openProject(project); });
  act(() => {
    result.current.updateProject({ annotations: [{ id: "note", text: "hello", x: 0, y: 1, color: "0" }] });
    result.current.updateProject({ viewSettings: { erdNotation: "chen" } });
  });
  expect(result.current.saveStatus).toBe("saving");
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.saveStatus).toBe("saved");
  expect(loadProject("a")?.annotations[0]?.text).toBe("hello");
  expect(loadProject("a")?.viewSettings.erdNotation).toBe("chen");
});
it("flushes on navigation and isolates the next project", () => {
  const { result } = renderHook(useProjectSession);
  act(() => { result.current.openProject(project); });
  act(() => { result.current.updateProject({ annotations: [{ id: "note", text: "A only", x: 0, y: 0, color: "0" }] }); });
  act(() => { result.current.openProject(createProject({ ...project.diagram, id: "b" })); });
  expect(loadProject("a")?.annotations).toHaveLength(1);
  expect(result.current.project?.annotations).toEqual([]);
});
it("retains unsaved work on failure and supports retry", () => {
  const { result } = renderHook(useProjectSession);
  const failure = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  act(() => { result.current.openProject(project); });
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.saveStatus).toBe("error");
  act(() => { expect(result.current.closeProject()).toBe(false); });
  expect(result.current.project?.diagram.id).toBe("a");
  failure.mockRestore();
  act(() => { expect(result.current.flush()).toBe(true); });
  expect(result.current.saveStatus).toBe("saved");
});
