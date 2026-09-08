import type { Diagram, DBRelationship } from "db-schema-toolkit";
import type { NavigationFilters } from "@/lib/project/project";

/** Build once per relationship revision, rather than scanning all edges per node. */
export function indexRelationships(relationships: Diagram["relationships"]): Map<string, DBRelationship[]> {
  const index = new Map<string, DBRelationship[]>();
  for (const rel of relationships) {
    for (const id of new Set([rel.sourceTableId, rel.targetTableId])) {
      const entries = index.get(id);
      if (entries) entries.push(rel);
      else index.set(id, [rel]);
    }
  }
  return index;
}

export function filterDiagram(diagram: Diagram, filters: NavigationFilters): Diagram {
  if (!filters.search.trim() && filters.namespace === null && !filters.focusTableId) return diagram;
  const search = filters.search.trim().toLowerCase();
  const neighbours = filters.focusTableId ? new Set([filters.focusTableId]) : null;
  if (neighbours) {
    for (const rel of diagram.relationships) {
      if (rel.sourceTableId === filters.focusTableId) neighbours.add(rel.targetTableId);
      if (rel.targetTableId === filters.focusTableId) neighbours.add(rel.sourceTableId);
    }
  }
  const tables = diagram.tables.filter((table) =>
    (!neighbours || neighbours.has(table.id)) &&
    (filters.namespace === null || (table.schema ?? "") === filters.namespace) &&
    (!search || table.name.toLowerCase().includes(search) || table.fields.some((field) => field.name.toLowerCase().includes(search))),
  );
  const ids = new Set(tables.map((table) => table.id));
  return { ...diagram, tables, relationships: diagram.relationships.filter((rel) => ids.has(rel.sourceTableId) && ids.has(rel.targetTableId)) };
}
