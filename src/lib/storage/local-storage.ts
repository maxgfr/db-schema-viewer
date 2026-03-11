import type { Diagram } from "@/lib/domain";

const PREFIX = "db-schema-viewer-";
const DIAGRAMS_KEY = `${PREFIX}diagrams`;

export interface StoredDiagram {
  id: string;
  name: string;
  databaseType: string;
  tableCount: number;
  updatedAt: string;
}

export function saveDiagram(diagram: Diagram): void {
  if (typeof window === "undefined") return;

  // Save full diagram
  localStorage.setItem(`${PREFIX}diagram-${diagram.id}`, JSON.stringify(diagram));

  // Update index
  const index = listDiagrams();
  const existing = index.findIndex((d) => d.id === diagram.id);
  const entry: StoredDiagram = {
    id: diagram.id,
    name: diagram.name,
    databaseType: diagram.databaseType,
    tableCount: diagram.tables.length,
    updatedAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }

  localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(index));
}

export function loadDiagram(id: string): Diagram | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(`${PREFIX}diagram-${id}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Diagram;
  } catch {
    return null;
  }
}

export function deleteDiagram(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${PREFIX}diagram-${id}`);
  const index = listDiagrams().filter((d) => d.id !== id);
  localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(index));
}

export function listDiagrams(): StoredDiagram[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(DIAGRAMS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as StoredDiagram[];
  } catch {
    return [];
  }
}
