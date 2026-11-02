import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createProject, parseProject, serializeProject } from "@/lib/project/project";
import { saveProject, loadProject, listDiagrams, resetProjectStorageForTests } from "@/lib/storage/project-storage";
import type { Diagram } from "db-schema-toolkit";

const diagram: Diagram = { id: "project", name: "Project", databaseType: "postgresql", tables: [], relationships: [], createdAt: "2026-01-01", sourceContent: "CREATE TABLE test(id INT);" };
beforeEach(async () => {
  await resetProjectStorageForTests();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("project persistence", () => {
  it("round-trips source, notes, viewport and navigation, excluding unrelated data", async () => {
    const project = { ...createProject(diagram), annotations: [{ id: "n", text: "Keep this", x: 12, y: 34, color: "1" as const }], viewSettings: { viewport: { x: 2, y: 3, zoom: 0.5 }, filters: { search: "test", namespace: "public", focusTableId: null } } };
    const json = serializeProject({ ...project, apiKey: "not-a-real-key", dump: [1, 2] } as typeof project);
    expect(json).not.toContain("apiKey");
    expect(json).not.toContain("dump");
    expect(parseProject(json)).toEqual(project);
    await saveProject(project);
    expect(await loadProject(diagram.id)).toEqual(project);
    expect(await listDiagrams()).toHaveLength(1);
  });
  it("reads a diagram saved before projects had a version, and upgrades it on save", async () => {
    localStorage.setItem("db-schema-viewer-diagram-project", JSON.stringify(diagram));
    expect(await loadProject("project")).toEqual(createProject(diagram));
    await saveProject((await loadProject("project"))!);
    await resetProjectStorageForTests();
    expect((await loadProject("project"))?.version).toBe(1);
  });
  it("preserves the previous record when storage is full", async () => {
    await saveProject(createProject(diagram));
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await expect(saveProject(createProject({ ...diagram, name: "Changed" }))).rejects.toThrow();
    vi.restoreAllMocks();
    expect((await loadProject("project"))?.diagram.name).toBe("Project");
  });
  it("handles unavailable storage on reads", async () => {
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    expect(await loadProject("project")).toBeNull();
  });
  it("rejects unknown versions and invalid views", () => {
    expect(() => parseProject(JSON.stringify({ ...createProject(diagram), version: 2 }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...createProject(diagram), viewSettings: { viewport: { x: 0, y: 0, zoom: -1 } } }))).toThrow();
  });
});
