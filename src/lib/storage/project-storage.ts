import { z } from "zod";
import { Diagram as DiagramSchema, encodeState, generateId, type Diagram } from "db-schema-toolkit";
import { createProject, ProjectSchema, type Project } from "@/lib/project/project";
import { deleteChallengeHistory, pruneChallengeHistory } from "@/lib/storage/challenge-history";

/*
 * Projects live in IndexedDB. The app is served from maxgfr.github.io, an origin shared by every
 * project page of the account: localStorage there is a single ~5 MB quota for all of them, which
 * another site can fill, and too small for whole projects with their source anyway.
 */
const DB_NAME = "db-schema-viewer-projects";
/** id → project record (a versioned project, or a diagram saved by an older version). */
const RECORDS = "projects";
/** id → metadata for the recent list, written in the same transaction as the record. */
const ENTRIES = "entries";

/**
 * A project the page could not finish saving before it went (a reload right after an edit):
 * written synchronously for this tab, moved to IndexedDB on the next start.
 */
const UNSAVED_KEY = "db-schema-viewer:unsaved-project";

/** Where versions before IndexedDB kept projects: copied once, then removed. */
const LEGACY_RECORD_PREFIX = "db-schema-viewer-diagram-";
const LEGACY_INDEX_KEY = "db-schema-viewer-diagrams";

const StoredDiagramSchema = z.object({
  id: z.string(),
  name: z.string(),
  databaseType: z.string(),
  tableCount: z.number(),
  updatedAt: z.string(),
});
export type StoredDiagram = z.infer<typeof StoredDiagramSchema>;

export interface SaveResult {
  /** The source code did not fit in storage; the rest of the project was saved. */
  sourceDropped: boolean;
}

function toEntry(project: Project): StoredDiagram {
  const d = project.diagram;
  return { id: d.id, name: d.name, databaseType: d.databaseType,
    tableCount: d.tables.length, updatedAt: project.updatedAt ?? d.updatedAt ?? d.createdAt };
}

function parseRecord(data: unknown): Project | null {
  try {
    // Legacy diagrams become projects on their next successful save.
    return data && typeof data === "object" && "version" in data
      ? ProjectSchema.parse(data)
      : createProject(DiagramSchema.parse(data));
  } catch {
    return null;
  }
}

function isQuotaExceeded(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22;
}

/* ---------- IndexedDB ---------- */

function completion(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let opening: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening;
  const attempt = (async () => {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(RECORDS);
      request.result.createObjectStore(ENTRIES);
    };
    const db = await result(request);
    db.onversionchange = () => {
      db.close();
      if (opening === attempt) opening = null;
    };
    // A failed copy leaves the old records in place, to be copied on the next start.
    await migrateFromLocalStorage(db).catch(() => {});
    await recoverUnsaved(db).catch(() => {});
    await pruneOrphanedHistory(db).catch(() => {});
    return db;
  })();
  opening = attempt;
  // A failure is not cached: the next call tries again.
  attempt.catch(() => { if (opening === attempt) opening = null; });
  return attempt;
}

/**
 * Copies the projects older versions kept in localStorage, then removes them there (those keys are
 * this app's own). A project already in IndexedDB is never overwritten, so running it again, or in
 * two tabs at once, is harmless. An unreadable record is left where it is.
 */
async function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  const legacy: { key: string; data: unknown; project: Project }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LEGACY_RECORD_PREFIX)) continue;
      let data: unknown;
      try { data = JSON.parse(localStorage.getItem(key) ?? ""); } catch { continue; }
      const project = parseRecord(data);
      if (project?.diagram.id === key.slice(LEGACY_RECORD_PREFIX.length)) legacy.push({ key, data, project });
    }
  } catch {
    return; // localStorage blocked: nothing to read.
  }
  if (legacy.length) {
    const tx = db.transaction([RECORDS, ENTRIES], "readwrite");
    const done = completion(tx);
    const keepExisting = (request: IDBRequest) => {
      // ConstraintError: this id is already in IndexedDB. Keep that copy, go on with the others.
      request.onerror = (event) => { event.preventDefault(); event.stopPropagation(); };
    };
    for (const { data, project } of legacy) {
      keepExisting(tx.objectStore(RECORDS).add(data, project.diagram.id));
      keepExisting(tx.objectStore(ENTRIES).add(toEntry(project), project.diagram.id));
    }
    await done;
  }
  try {
    for (const { key } of legacy) localStorage.removeItem(key);
    localStorage.removeItem(LEGACY_INDEX_KEY);
  } catch {
    // Removed on the next start.
  }
}

async function writeTo(db: IDBDatabase, id: string, record: unknown, entry: StoredDiagram): Promise<void> {
  const tx = db.transaction([RECORDS, ENTRIES], "readwrite");
  const done = completion(tx);
  tx.objectStore(RECORDS).put(record, id);
  tx.objectStore(ENTRIES).put(entry, id);
  await done;
}

async function write(id: string, record: Project, entry: StoredDiagram): Promise<void> {
  await writeTo(await openDatabase(), id, record, entry);
  // Saved for real: an older copy stashed while the page was leaving is obsolete.
  try { sessionStorage.removeItem(UNSAVED_KEY); } catch { /* blocked: nothing was stashed */ }
}

/** Drops the challenge history of diagrams deleted before deleting one removed it too. */
async function pruneOrphanedHistory(db: IDBDatabase): Promise<void> {
  const ids = new Set((await result(db.transaction(RECORDS, "readonly").objectStore(RECORDS).getAllKeys())).map(String));
  // Projects still waiting in localStorage (a copy that failed) keep their history too.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_RECORD_PREFIX)) ids.add(key.slice(LEGACY_RECORD_PREFIX.length));
    }
  } catch {
    return; // Unreadable: prune nothing rather than guess.
  }
  pruneChallengeHistory(ids);
}

/** Keeps the stashed project unless IndexedDB already holds a newer copy. */
async function recoverUnsaved(db: IDBDatabase): Promise<void> {
  let raw: string | null;
  try { raw = sessionStorage.getItem(UNSAVED_KEY); } catch { return; }
  if (raw === null) return;
  let stashed: Project | null = null;
  try { stashed = parseRecord(JSON.parse(raw)); } catch { /* unreadable: dropped */ }
  if (stashed) {
    const id = stashed.diagram.id;
    const stored = parseRecord(await result(db.transaction(RECORDS, "readonly").objectStore(RECORDS).get(id)));
    if (!stored || (stashed.updatedAt ?? "") > (stored.updatedAt ?? "")) await writeTo(db, id, stashed, toEntry(stashed));
  }
  try { sessionStorage.removeItem(UNSAVED_KEY); } catch { /* removed on the next start */ }
}

async function removeEntry(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(ENTRIES, "readwrite");
  const done = completion(tx);
  tx.objectStore(ENTRIES).delete(id);
  await done;
}

/* ---------- API ---------- */

/**
 * Synchronously keeps a project whose save cannot finish before the page goes, for this tab
 * only; the next start saves it. False when it did not fit.
 */
export function stashUnsavedProject(project: Project): boolean {
  try {
    sessionStorage.setItem(UNSAVED_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

/**
 * One atomic record per project. Validation happens on import and load, not on every autosave.
 * When storage is full, the project is saved again without its source code. Rejects when the
 * project could not be stored.
 */
export async function saveProject(project: Project): Promise<SaveResult> {
  const id = project.diagram.id;
  const entry = toEntry(project);
  try {
    await write(id, project, entry);
    return { sourceDropped: false };
  } catch (error) {
    if (!isQuotaExceeded(error) || project.diagram.sourceContent === undefined) throw error;
    await write(id, { ...project, diagram: { ...project.diagram, sourceContent: undefined } }, entry);
    return { sourceDropped: true };
  }
}
export async function saveDiagram(diagram: Diagram): Promise<void> {
  const existing = await loadProject(diagram.id);
  await saveProject({ ...(existing ?? createProject(diagram)), diagram });
}
export async function loadProject(id: string): Promise<Project | null> {
  let data: unknown;
  try {
    const db = await openDatabase();
    data = await result(db.transaction(RECORDS, "readonly").objectStore(RECORDS).get(id));
  } catch {
    return null;
  }
  if (data === undefined) return null;
  const project = parseRecord(data);
  if (project?.diagram.id === id) return project;
  // Unreadable record: drop it from the recent list, which never parses records.
  await removeEntry(id).catch(() => {});
  return null;
}
export async function loadDiagram(id: string): Promise<Diagram | null> {
  return (await loadProject(id))?.diagram ?? null;
}
export async function deleteDiagram(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([RECORDS, ENTRIES], "readwrite");
  const done = completion(tx);
  tx.objectStore(RECORDS).delete(id);
  tx.objectStore(ENTRIES).delete(id);
  await done;
  deleteChallengeHistory(id);
}
export async function listDiagrams(): Promise<StoredDiagram[]> {
  try {
    const db = await openDatabase();
    const entries = await result(db.transaction(ENTRIES, "readonly").objectStore(ENTRIES).getAll());
    return entries
      .flatMap((entry: unknown) => {
        const parsed = StoredDiagramSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/** Closes the database and forgets it, as a page reload would (tests). */
export async function resetProjectStorageForTests(): Promise<void> {
  const current = opening;
  opening = null;
  if (current) (await current.catch(() => null))?.close();
}

function sameDiagram(a: Project, b: Project): boolean {
  return encodeState(a.diagram) === encodeState(b.diagram);
}
function sameContent(a: Project, b: Project): boolean {
  return sameDiagram(a, b) && JSON.stringify(a.annotations) === JSON.stringify(b.annotations);
}
function fork(project: Project): Project {
  return { ...project, diagram: { ...project.diagram, id: generateId() } };
}

/** An incoming project never silently overwrites a different local project with the same id. */
export async function withoutIdConflict(incoming: Project): Promise<Project> {
  const stored = await loadProject(incoming.diagram.id);
  return stored && !sameContent(stored, incoming) ? fork(incoming) : incoming;
}

/**
 * A reload reopens the local copy of the link; any other visit to a link whose id exists
 * locally with different content opens it under a new id.
 */
export async function resolveSharedProject(shared: Project, reload: boolean): Promise<Project> {
  const stored = await loadProject(shared.diagram.id);
  if (!stored) return shared;
  if (reload) return stored;
  // Only restore a source belonging to exactly the same shared schema and layout.
  const withSource = stored.diagram.sourceContent && sameDiagram(stored, shared)
    ? { ...shared, diagram: { ...shared.diagram, sourceContent: stored.diagram.sourceContent } }
    : shared;
  return sameContent(stored, shared) ? withSource : fork(withSource);
}
