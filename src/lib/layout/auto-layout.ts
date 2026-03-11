import type { DBTable, DBRelationship } from "@/lib/domain";

const TABLE_WIDTH = 280;
const TABLE_HEIGHT_BASE = 80;
const FIELD_HEIGHT = 28;
const GAP_X = 80;
const GAP_Y = 60;
const COLUMNS = 4;

function estimateTableHeight(table: DBTable): number {
  return TABLE_HEIGHT_BASE + table.fields.length * FIELD_HEIGHT;
}

export function autoLayout(
  tables: DBTable[],
  relationships: DBRelationship[]
): DBTable[] {
  if (tables.length === 0) return tables;

  // Build adjacency for connected components
  const adj = new Map<string, Set<string>>();
  for (const t of tables) {
    adj.set(t.id, new Set());
  }
  for (const rel of relationships) {
    adj.get(rel.sourceTableId)?.add(rel.targetTableId);
    adj.get(rel.targetTableId)?.add(rel.sourceTableId);
  }

  // Find connected components
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const table of tables) {
    if (visited.has(table.id)) continue;
    const component: string[] = [];
    const queue = [table.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(id);
      const neighbors = adj.get(id);
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited.has(n)) queue.push(n);
        }
      }
    }
    components.push(component);
  }

  // Sort components by size (largest first)
  components.sort((a, b) => b.length - a.length);

  const tableMap = new Map(tables.map((t) => [t.id, t]));
  const positions = new Map<string, { x: number; y: number }>();

  let globalOffsetY = 0;

  for (const component of components) {
    // Sort tables within component by number of relationships (hubs first)
    const relCount = new Map<string, number>();
    for (const id of component) {
      relCount.set(id, adj.get(id)?.size ?? 0);
    }
    component.sort((a, b) => (relCount.get(b) ?? 0) - (relCount.get(a) ?? 0));

    // Grid layout within component
    const cols = Math.min(COLUMNS, component.length);
    const columnHeights: number[] = new Array(cols).fill(0);

    for (let i = 0; i < component.length; i++) {
      // Find shortest column
      let minCol = 0;
      for (let c = 1; c < cols; c++) {
        if (columnHeights[c]! < columnHeights[minCol]!) {
          minCol = c;
        }
      }

      const table = tableMap.get(component[i]!);
      if (!table) continue;

      const x = minCol * (TABLE_WIDTH + GAP_X);
      const y = globalOffsetY + columnHeights[minCol]!;

      positions.set(table.id, { x, y });
      columnHeights[minCol]! += estimateTableHeight(table) + GAP_Y;
    }

    const maxHeight = Math.max(...columnHeights);
    globalOffsetY += maxHeight + GAP_Y * 2;
  }

  return tables.map((table) => {
    const pos = positions.get(table.id);
    if (pos) {
      return { ...table, x: pos.x, y: pos.y };
    }
    return table;
  });
}
