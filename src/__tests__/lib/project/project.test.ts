import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createProject, parseProject, serializeProject } from "@/lib/project/project";
import { saveProject, loadProject, listDiagrams } from "@/lib/storage/local-storage";
import type { Diagram } from "db-schema-toolkit";

const diagram: Diagram = { id: "project", name: "Project", databaseType: "postgresql", tables: [], relationships: [], createdAt: "2026-01-01", sourceContent: "CREATE TABLE test(id INT);" };
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("project persistence", () => {
  it("round-trips source, notes, viewport and navigation, excluding unrelated data", () => {
    const project = { ...createProject(diagram), annotations: [{ id: "n", text: "Keep this", x: 12, y: 34, color: "1" as const }], viewSettings: { viewport: { x: 2, y: 3, zoom: 0.5 }, filters: { search: "test", namespace: "public", focusTableId: null } } };
    const json = serializeProject({ ...project, apiKey: "not-a-real-key", dump: [1, 2] } as typeof project);
    expect(json).not.toContain("apiKey");
    expect(json).not.toContain("dump");
    expect(parseProject(json)).toEqual(project);
    saveProject(project);
    expect(loadProject(diagram.id)).toEqual(project);
    expect(listDiagrams()).toHaveLength(1);
  });
  it("reads legacy data without writing until a successful save", () => {
    const old = JSON.stringify(diagram);
    localStorage.setItem("db-schema-viewer-diagram-project", old);
    expect(loadProject("project")).toEqual(createProject(diagram));
    expect(localStorage.getItem("db-schema-viewer-diagram-project")).toBe(old);
    saveProject(loadProject("project")!);
    expect(JSON.parse(localStorage.getItem("db-schema-viewer-diagram-project")!).version).toBe(1);
  });
  it("preserves the previous record when storage is full", () => {
    saveProject(createProject(diagram));
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(() => saveProject(createProject({ ...diagram, name: "Changed" }))).toThrow();
    expect(loadProject("project")?.diagram.name).toBe("Project");
  });
  it("handles unavailable storage on reads", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    expect(loadProject("project")).toBeNull();
  });
  it("rejects unknown versions and invalid views", () => {
    expect(() => parseProject(JSON.stringify({ ...createProject(diagram), version: 2 }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...createProject(diagram), viewSettings: { viewport: { x: 0, y: 0, zoom: -1 } } }))).toThrow();
  });
});
