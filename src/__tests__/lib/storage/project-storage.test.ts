import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveDiagram, loadDiagram, listDiagrams, deleteDiagram, saveProject, loadProject, withoutIdConflict,
  resolveSharedProject, resetProjectStorageForTests, stashUnsavedProject,
} from "@/lib/storage/project-storage";
import { createProject } from "@/lib/project/project";
import { loadChallengeHistory, saveChallengeEntry } from "@/lib/storage/challenge-history";
import type { Diagram } from "db-schema-toolkit";

const testDiagram: Diagram = {
  id: "test-1",
  name: "Test Schema",
  databaseType: "postgresql",
  tables: [],
  relationships: [],
  createdAt: "2024-01-01T00:00:00.000Z",
};

/** Writes straight into the app's database, as another tab or an older build would. */
function rawPut(store: "projects" | "entries", id: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("db-schema-viewer-projects", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("projects"); open.result.createObjectStore("entries"); };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(store, "readwrite");
      tx.objectStore(store).put(value, id);
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

beforeEach(async () => {
  await resetProjectStorageForTests();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("project storage", () => {
  it("saves and loads a diagram", async () => {
    await saveDiagram(testDiagram);
    const loaded = await loadDiagram("test-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("Test Schema");
  });

  it("keeps projects in IndexedDB, not in the localStorage the origin's sites share", async () => {
    await saveDiagram(testDiagram);
    expect(localStorage.length).toBe(0);
    await resetProjectStorageForTests();
    expect((await loadDiagram("test-1"))?.name).toBe("Test Schema");
  });

  it("lists saved diagrams", async () => {
    await saveDiagram(testDiagram);
    await saveDiagram({ ...testDiagram, id: "test-2", name: "Another" });
    expect(await listDiagrams()).toHaveLength(2);
  });

  it("deletes a diagram", async () => {
    await saveDiagram(testDiagram);
    await deleteDiagram("test-1");
    expect(await loadDiagram("test-1")).toBeNull();
    expect(await listDiagrams()).toHaveLength(0);
  });

  it("returns null for non-existent diagram", async () => {
    expect(await loadDiagram("nonexistent")).toBeNull();
  });

  it("skips a corrupt list entry", async () => {
    await saveDiagram(testDiagram);
    await rawPut("entries", "unexpected", { unexpected: true });
    expect((await listDiagrams()).map((d) => d.id)).toEqual(["test-1"]);
  });

  it("rejects a record that is not a diagram", async () => {
    await rawPut("projects", "bad", { tables: null });
    expect(await loadDiagram("bad")).toBeNull();
  });

  it("updates an existing diagram in the list", async () => {
    await saveDiagram(testDiagram);
    await saveDiagram({ ...testDiagram, name: "Updated Name" });
    const list = await listDiagrams();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Updated Name");
  });

  it("hides a record that turned out to be invalid when it is opened", async () => {
    await saveDiagram(testDiagram);
    await rawPut("projects", "test-1", { version: 1, broken: true });
    expect(await loadDiagram("test-1")).toBeNull();
    expect(await listDiagrams()).toEqual([]);
  });

  it("handles unavailable storage", async () => {
    await resetProjectStorageForTests();
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    expect(await loadProject("test-1")).toBeNull();
    expect(await listDiagrams()).toEqual([]);
    await expect(saveProject(createProject(testDiagram))).rejects.toThrow("Denied");
  });
});

describe("migration from localStorage", () => {
  const legacy = { ...testDiagram, id: "legacy", name: "Legacy" };
  const versioned = createProject({ ...testDiagram, id: "versioned", name: "Versioned", sourceContent: "CREATE TABLE a(id INT);" });

  it("moves the projects of older versions to IndexedDB and removes them from localStorage", async () => {
    localStorage.setItem("db-schema-viewer-diagram-legacy", JSON.stringify(legacy));
    localStorage.setItem("db-schema-viewer-diagram-versioned", JSON.stringify(versioned));
    localStorage.setItem("db-schema-viewer-diagrams", "{}");
    localStorage.setItem("theme", "dark");

    expect((await listDiagrams()).map((d) => d.id).sort()).toEqual(["legacy", "versioned"]);
    expect(await loadProject("legacy")).toEqual(createProject(legacy));
    expect(await loadProject("versioned")).toEqual(versioned);
    expect(Object.keys(localStorage)).toEqual(["theme"]);

    // Idempotent: a second start finds nothing more to move and loses nothing.
    await resetProjectStorageForTests();
    expect(await listDiagrams()).toHaveLength(2);
  });

  it("never overwrites a project already in IndexedDB", async () => {
    await saveProject(createProject({ ...legacy, name: "Newer" }));
    await resetProjectStorageForTests();
    localStorage.setItem("db-schema-viewer-diagram-legacy", JSON.stringify(legacy));
    expect((await loadDiagram("legacy"))?.name).toBe("Newer");
    expect(localStorage.getItem("db-schema-viewer-diagram-legacy")).toBeNull();
  });

  it("leaves an unreadable record where it is", async () => {
    localStorage.setItem("db-schema-viewer-diagram-broken", "{not json");
    expect(await listDiagrams()).toEqual([]);
    expect(localStorage.getItem("db-schema-viewer-diagram-broken")).toBe("{not json");
  });
});

describe("a project stashed while the page was leaving", () => {
  it("is saved on the next start", async () => {
    expect(stashUnsavedProject({ ...createProject(testDiagram), updatedAt: "2026-02-01T00:00:00.000Z" })).toBe(true);
    await resetProjectStorageForTests();
    expect((await loadDiagram("test-1"))?.name).toBe("Test Schema");
    expect(sessionStorage.getItem("db-schema-viewer:unsaved-project")).toBeNull();
  });

  it("never replaces a newer saved copy", async () => {
    await saveProject({ ...createProject({ ...testDiagram, name: "Newer" }), updatedAt: "2026-03-01T00:00:00.000Z" });
    stashUnsavedProject({ ...createProject(testDiagram), updatedAt: "2026-02-01T00:00:00.000Z" });
    await resetProjectStorageForTests();
    expect((await loadDiagram("test-1"))?.name).toBe("Newer");
  });

  it("is dropped once the project is saved", async () => {
    await listDiagrams(); // the page has started
    stashUnsavedProject(createProject(testDiagram));
    await saveProject(createProject({ ...testDiagram, name: "Saved" }));
    expect(sessionStorage.getItem("db-schema-viewer:unsaved-project")).toBeNull();
  });
});

describe("quota handling", () => {
  function failPut(when: (value: unknown) => boolean, error: DOMException) {
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (when(value)) throw error;
      return original.call(this, value, key);
    });
  }

  it("retries without the source when storage is full", async () => {
    failPut((value) => JSON.stringify(value).includes("HUGE SOURCE"), new DOMException("Full", "QuotaExceededError"));
    const project = createProject({ ...testDiagram, sourceContent: "HUGE SOURCE" });
    expect(await saveProject(project)).toEqual({ sourceDropped: true });
    const stored = await loadProject("test-1");
    expect(stored?.diagram.name).toBe("Test Schema");
    expect(stored?.diagram.sourceContent).toBeUndefined();
  });

  it("rethrows other storage errors", async () => {
    failPut(() => true, new DOMException("Denied", "SecurityError"));
    await expect(saveProject(createProject({ ...testDiagram, sourceContent: "src" }))).rejects.toThrow("Denied");
  });

  it("preserves the previous record when storage is full", async () => {
    await saveProject(createProject(testDiagram));
    failPut(() => true, new DOMException("Full", "QuotaExceededError"));
    await expect(saveProject(createProject({ ...testDiagram, name: "Changed" }))).rejects.toThrow();
    vi.restoreAllMocks();
    expect((await loadProject("test-1"))?.diagram.name).toBe("Test Schema");
  });
});

describe("id conflicts", () => {
  const table = { id: "t1", name: "users", fields: [{ id: "f1", name: "id", type: "INT", primaryKey: true, unique: false, nullable: false, isForeignKey: false }], indexes: [], x: 0, y: 0, isView: false };
  const stored = createProject({ ...testDiagram, tables: [table], sourceContent: "CREATE TABLE users(id INT PRIMARY KEY);" });
  beforeEach(async () => {
    await saveProject(stored);
  });

  it("keeps the id of an import identical to the local project", async () => {
    const incoming = createProject({ ...stored.diagram });
    expect((await withoutIdConflict(incoming)).diagram.id).toBe("test-1");
  });

  it("forks an import whose id exists locally with different content", async () => {
    const incoming = createProject({ ...stored.diagram, tables: [{ ...table, name: "accounts" }] });
    const opened = await withoutIdConflict(incoming);
    expect(opened.diagram.id).not.toBe("test-1");
    expect(opened.diagram.tables[0]?.name).toBe("accounts");
    expect((await loadProject("test-1"))?.diagram.tables[0]?.name).toBe("users");
  });

  it("forks an import whose notes differ from the local project", async () => {
    const incoming = { ...createProject(stored.diagram), annotations: [{ id: "n", text: "new", x: 0, y: 0, color: "0" }] };
    expect((await withoutIdConflict(incoming)).diagram.id).not.toBe("test-1");
  });

  it("forks an older shared link instead of overwriting local work", async () => {
    const shared = createProject({ ...stored.diagram, tables: [{ ...table, x: 400 }], sourceContent: undefined });
    const opened = await resolveSharedProject(shared, false);
    expect(opened.diagram.id).not.toBe("test-1");
    expect(opened.diagram.tables[0]?.x).toBe(400);
    expect((await loadProject("test-1"))?.diagram.tables[0]?.x).toBe(0);
  });

  it("reopens the local project on reload", async () => {
    const shared = createProject({ ...stored.diagram, tables: [{ ...table, x: 400 }], sourceContent: undefined });
    expect(await resolveSharedProject(shared, true)).toEqual(await loadProject("test-1"));
  });

  it("restores the local source for an identical shared link", async () => {
    const shared = createProject({ ...stored.diagram, sourceContent: undefined });
    const opened = await resolveSharedProject(shared, false);
    expect(opened.diagram.id).toBe("test-1");
    expect(opened.diagram.sourceContent).toBe(stored.diagram.sourceContent);
  });

  it("opens an unknown shared link as is", async () => {
    const shared = createProject({ ...stored.diagram, id: "other" });
    expect((await resolveSharedProject(shared, false)).diagram.id).toBe("other");
  });
});

describe("challenge history", () => {
  const history = (id: string) => `db-schema-viewer-challenge-history:${id}`;
  const entry = { score: 80, issueCount: 2, timestamp: "2026-01-01T00:00:00.000Z", schemaName: "Test" };

  it("is deleted with its diagram", async () => {
    await saveDiagram(testDiagram);
    await saveDiagram({ ...testDiagram, id: "test-2" });
    saveChallengeEntry("test-1", entry);
    saveChallengeEntry("test-2", entry);
    await deleteDiagram("test-1");
    expect(localStorage.getItem(history("test-1"))).toBeNull();
    expect(loadChallengeHistory("test-2")).toEqual([entry]);
  });

  it("of diagrams no longer stored is removed on start, the rest is kept", async () => {
    await saveDiagram(testDiagram);
    await resetProjectStorageForTests();
    saveChallengeEntry("test-1", entry);
    saveChallengeEntry("gone", entry);
    localStorage.setItem("db-schema-viewer-diagram-waiting", "{not json");
    saveChallengeEntry("waiting", entry);
    localStorage.setItem("another-site:history", "keep");
    await listDiagrams();
    expect(loadChallengeHistory("test-1")).toEqual([entry]);
    expect(loadChallengeHistory("waiting")).toEqual([entry]);
    expect(localStorage.getItem(history("gone"))).toBeNull();
    expect(localStorage.getItem("another-site:history")).toBe("keep");
  });
});
