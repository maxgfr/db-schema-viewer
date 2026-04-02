import { describe, it, expect, beforeEach } from "vitest";
import { saveDiagram, loadDiagram, listDiagrams, deleteDiagram } from "@/lib/storage/local-storage";
import type { Diagram } from "db-schema-toolkit";

const testDiagram: Diagram = {
  id: "test-1",
  name: "Test Schema",
  databaseType: "postgresql",
  tables: [],
  relationships: [],
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("local-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads a diagram", () => {
    saveDiagram(testDiagram);
    const loaded = loadDiagram("test-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("Test Schema");
  });

  it("lists saved diagrams", () => {
    saveDiagram(testDiagram);
    saveDiagram({ ...testDiagram, id: "test-2", name: "Another" });

    const list = listDiagrams();
    expect(list).toHaveLength(2);
  });

  it("deletes a diagram", () => {
    saveDiagram(testDiagram);
    deleteDiagram("test-1");

    expect(loadDiagram("test-1")).toBeNull();
    expect(listDiagrams()).toHaveLength(0);
  });

  it("returns null for non-existent diagram", () => {
    expect(loadDiagram("nonexistent")).toBeNull();
  });

  it("updates existing diagram in index", () => {
    saveDiagram(testDiagram);
    saveDiagram({ ...testDiagram, name: "Updated Name" });

    const list = listDiagrams();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Updated Name");
  });
});
