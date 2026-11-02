import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useProjectSession } from "@/hooks/use-project-session";
import { createProject } from "@/lib/project/project";
import { loadProject, resetProjectStorageForTests } from "@/lib/storage/project-storage";
const project = createProject({ id: "a", name: "A", databaseType: "postgresql", tables: [], relationships: [], createdAt: "2026-01-01" });
beforeEach(async () => {
  await resetProjectStorageForTests();
  globalThis.indexedDB = new IDBFactory();
  sessionStorage.clear();
  // Only the autosave delay is faked: IndexedDB keeps its own scheduling.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

/** Lets the autosave timer fire and its save finish. */
const autosave = () => act(async () => {
  vi.advanceTimersByTime(500);
  for (let i = 0; i < 50; i++) await new Promise((resolve) => setImmediate(resolve));
});
/** IndexedDB refuses every write, as a full disk or a blocked site would. */
const failWrites = () => vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });

it("saves all changes together and restores notes and view", async () => {
  const { result } = renderHook(useProjectSession);
  await act(async () => { await result.current.openProject(project); });
  act(() => {
    result.current.updateProject({ annotations: [{ id: "note", text: "hello", x: 0, y: 1, color: "0" }] });
    result.current.updateProject({ viewSettings: { erdNotation: "chen" } });
  });
  expect(result.current.saveStatus).toBe("saving");
  await autosave();
  expect(result.current.saveStatus).toBe("saved");
  expect((await loadProject("a"))?.annotations[0]?.text).toBe("hello");
  expect((await loadProject("a"))?.viewSettings.erdNotation).toBe("chen");
});
it("flushes on navigation and isolates the next project", async () => {
  const { result } = renderHook(useProjectSession);
  await act(async () => { await result.current.openProject(project); });
  act(() => { result.current.updateProject({ annotations: [{ id: "note", text: "A only", x: 0, y: 0, color: "0" }] }); });
  await act(async () => { await result.current.openProject(createProject({ ...project.diagram, id: "b" })); });
  expect((await loadProject("a"))?.annotations).toHaveLength(1);
  expect(result.current.project?.annotations).toEqual([]);
});
it("retains unsaved work on failure and supports retry", async () => {
  const { result } = renderHook(useProjectSession);
  const failure = failWrites();
  await act(async () => { await result.current.openProject(project); });
  await autosave();
  expect(result.current.saveStatus).toBe("error");
  await act(async () => { expect(await result.current.closeProject()).toBe(false); });
  expect(result.current.project?.diagram.id).toBe("a");
  failure.mockRestore();
  await act(async () => { expect(await result.current.flush()).toBe(true); });
  expect(result.current.saveStatus).toBe("saved");
});
it("asks before leaving unsaved work after a failed save", async () => {
  const confirmDiscard = vi.fn(() => false);
  const { result } = renderHook(() => useProjectSession({ confirmDiscard }));
  failWrites();
  await act(async () => { await result.current.openProject(project); });
  await autosave();
  expect(result.current.saveStatus).toBe("error");
  await act(async () => { expect(await result.current.closeProject()).toBe(false); });
  expect(confirmDiscard).toHaveBeenCalledTimes(1);
  expect(result.current.project?.diagram.id).toBe("a");
  confirmDiscard.mockReturnValue(true);
  await act(async () => { expect(await result.current.closeProject()).toBe(true); });
  expect(result.current.project).toBeNull();
});
it("opens another project after a failed save once the user confirms", async () => {
  const confirmDiscard = vi.fn(() => true);
  const { result } = renderHook(() => useProjectSession({ confirmDiscard }));
  failWrites();
  await act(async () => { await result.current.openProject(project); });
  await autosave();
  await act(async () => { expect(await result.current.openProject(createProject({ ...project.diagram, id: "b" }))).toBe(true); });
  expect(confirmDiscard).toHaveBeenCalledTimes(1);
  expect(result.current.project?.diagram.id).toBe("b");
});
it("saves without the source when storage is full and reports it once", async () => {
  const onSourceDropped = vi.fn();
  const { result } = renderHook(() => useProjectSession({ onSourceDropped }));
  const original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (JSON.stringify(value).includes("HUGE SOURCE")) throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, value, key);
  });
  await act(async () => { await result.current.openProject(createProject({ ...project.diagram, sourceContent: "HUGE SOURCE" })); });
  await autosave();
  expect(result.current.saveStatus).toBe("saved");
  expect((await loadProject("a"))?.diagram.sourceContent).toBeUndefined();
  act(() => { result.current.updateProject({ viewSettings: { erdNotation: "chen" } }); });
  await autosave();
  expect((await loadProject("a"))?.viewSettings.erdNotation).toBe("chen");
  expect(onSourceDropped).toHaveBeenCalledTimes(1);
  expect(result.current.project?.diagram.sourceContent).toBe("HUGE SOURCE");
});
it("keeps a copy for the next start when the page goes before a save finished", async () => {
  const { result } = renderHook(useProjectSession);
  await act(async () => { await result.current.openProject(project); });
  act(() => { result.current.updateProject({ annotations: [{ id: "note", text: "typed just now", x: 0, y: 0, color: "0" }] }); });
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(false);
  expect(sessionStorage.getItem("db-schema-viewer:unsaved-project")).toContain("typed just now");
});
it("asks before the page closes after a failed save", async () => {
  const { result } = renderHook(useProjectSession);
  failWrites();
  await act(async () => { await result.current.openProject(project); });
  await autosave();
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
});
