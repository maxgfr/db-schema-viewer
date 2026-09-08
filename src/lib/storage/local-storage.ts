import { Diagram as DiagramSchema, type Diagram } from "db-schema-toolkit";
import { createProject, ProjectSchema, type Project } from "@/lib/project/project";

const RECORD_PREFIX = "db-schema-viewer-diagram-";
export interface StoredDiagram {
  id: string;
  name: string;
  databaseType: string;
  tableCount: number;
  updatedAt: string;
}

/** One atomic record per project; the recent list is derived, never a second write. */
export function saveProject(project: Project): void {
  if (typeof window === "undefined") return;
  const validated = ProjectSchema.parse(project);
  localStorage.setItem(`${RECORD_PREFIX}${validated.diagram.id}`, JSON.stringify(validated));
}
export function saveDiagram(diagram: Diagram): void {
  const existing = loadProject(diagram.id);
  saveProject({ ...(existing ?? createProject(diagram)), diagram });
}
export function loadProject(id: string): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${RECORD_PREFIX}${id}`);
    if (!stored) return null;
    const data: unknown = JSON.parse(stored);
    // Legacy records migrate only on a successful save.
    const project = data && typeof data === "object" && "version" in data
      ? ProjectSchema.parse(data)
      : createProject(DiagramSchema.parse(data));
    return project.diagram.id === id ? project : null;
  } catch {
    return null;
  }
}
export function loadDiagram(id: string): Diagram | null {
  return loadProject(id)?.diagram ?? null;
}
export function deleteDiagram(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${RECORD_PREFIX}${id}`);
}
export function listDiagrams(): StoredDiagram[] {
  if (typeof window === "undefined") return [];
  try {
    const result: StoredDiagram[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(RECORD_PREFIX)) continue;
      const project = loadProject(key.slice(RECORD_PREFIX.length));
      if (!project) continue;
      const d = project.diagram;
      result.push({ id: d.id, name: d.name, databaseType: d.databaseType,
        tableCount: d.tables.length, updatedAt: project.updatedAt ?? d.updatedAt ?? d.createdAt });
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}
