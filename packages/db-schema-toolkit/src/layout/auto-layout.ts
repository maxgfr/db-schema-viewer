import type { DBTable, DBRelationship } from "../domain";

const TABLE_WIDTH = 280;
const TABLE_HEIGHT_BASE = 80;
const FIELD_HEIGHT = 28;
const MAX_VISIBLE_FIELDS = 12;
const GAP_X = 140;
const GAP_Y = 120;

function estimateTableHeight(table: DBTable): number {
  const visibleFields = Math.min(table.fields.length, MAX_VISIBLE_FIELDS);
  const expandButton = table.fields.length > MAX_VISIBLE_FIELDS ? 30 : 0;
  return TABLE_HEIGHT_BASE + visibleFields * FIELD_HEIGHT + expandButton;
}

export function autoLayout(
  tables: DBTable[],
  relationships: DBRelationship[]
): DBTable[] {
  if (tables.length === 0) return tables;

  // Build adjacency map
  const adj = new Map<string, Set<string>>();
  for (const t of tables) {
    adj.set(t.id, new Set());
  }
  for (const rel of relationships) {
    adj.get(rel.sourceTableId)?.add(rel.targetTableId);
    adj.get(rel.targetTableId)?.add(rel.sourceTableId);
  }

  // Find connected components via BFS
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

  // Sort components: connected groups first (largest first), isolated tables last
  const connectedComponents = components
    .filter((c) => c.length > 1)
    .sort((a, b) => b.length - a.length);
  const isolatedIds = components
    .filter((c) => c.length === 1)
    .map((c) => c[0]!);

  const tableMap = new Map(tables.map((t) => [t.id, t]));
  const positions = new Map<string, { x: number; y: number }>();

  let globalOffsetY = 0;

  // ── Layout connected components using BFS layers ──
  for (const component of connectedComponents) {
    // Find the hub (most connections within the component)
    const hub = component.reduce((a, b) => {
      const aConns = adj.get(a)?.size ?? 0;
      const bConns = adj.get(b)?.size ?? 0;
      return aConns >= bConns ? a : b;
    });

    // BFS layering from hub
    const layers: string[][] = [];
    const layerVisited = new Set<string>();
    let currentLayer = [hub];

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      for (const id of currentLayer) layerVisited.add(id);

      const nextLayer: string[] = [];
      for (const id of currentLayer) {
        const neighbors = adj.get(id);
        if (neighbors) {
          for (const n of neighbors) {
            if (
              !layerVisited.has(n) &&
              !nextLayer.includes(n) &&
              component.includes(n)
            ) {
              nextLayer.push(n);
            }
          }
        }
      }
      currentLayer = nextLayer;
    }

    // Safety: add any unreached nodes to the last layer
    const reached = new Set(layers.flat());
    for (const id of component) {
      if (!reached.has(id)) {
        layers[layers.length - 1]!.push(id);
      }
    }

    // Compute the maximum layer width for centering
    let maxLayerWidth = 0;
    for (const layer of layers) {
      const layerWidth = layer.length * (TABLE_WIDTH + GAP_X) - GAP_X;
      maxLayerWidth = Math.max(maxLayerWidth, layerWidth);
    }

    // Position each layer, centered horizontally
    let layerY = globalOffsetY;
    for (const layer of layers) {
      // Sort nodes within layer by their connections to the previous layer
      // to minimize edge crossings
      if (layers.indexOf(layer) > 0) {
        const prevLayer = layers[layers.indexOf(layer) - 1]!;
        const prevPositions = new Map<string, number>();
        for (let i = 0; i < prevLayer.length; i++) {
          prevPositions.set(prevLayer[i]!, i);
        }
        layer.sort((a, b) => {
          const aAvg = averageParentPosition(a, adj, prevPositions);
          const bAvg = averageParentPosition(b, adj, prevPositions);
          return aAvg - bAvg;
        });
      }

      const layerWidth = layer.length * (TABLE_WIDTH + GAP_X) - GAP_X;
      const startX = (maxLayerWidth - layerWidth) / 2;

      let maxHeight = 0;
      for (let i = 0; i < layer.length; i++) {
        const table = tableMap.get(layer[i]!);
        if (!table) continue;

        const x = startX + i * (TABLE_WIDTH + GAP_X);
        positions.set(table.id, { x, y: layerY });
        maxHeight = Math.max(maxHeight, estimateTableHeight(table));
      }

      layerY += maxHeight + GAP_Y;
    }

    globalOffsetY = layerY + GAP_Y;
  }

  // ── Layout isolated tables in a grid below ──
  if (isolatedIds.length > 0) {
    const cols = Math.min(4, isolatedIds.length);
    const columnHeights: number[] = new Array(cols).fill(globalOffsetY);

    for (const id of isolatedIds) {
      // Find shortest column
      let minCol = 0;
      for (let c = 1; c < cols; c++) {
        if (columnHeights[c]! < columnHeights[minCol]!) {
          minCol = c;
        }
      }

      const table = tableMap.get(id);
      if (!table) continue;

      positions.set(table.id, {
        x: minCol * (TABLE_WIDTH + GAP_X),
        y: columnHeights[minCol]!,
      });
      columnHeights[minCol]! += estimateTableHeight(table) + GAP_Y;
    }
  }

  return tables.map((table) => {
    const pos = positions.get(table.id);
    if (pos) {
      return { ...table, x: pos.x, y: pos.y };
    }
    return table;
  });
}

/**
 * Shuffle table positions into a random layout.
 * Spreads tables across a grid with random offsets for variety.
 */
export function shuffleLayout(tables: DBTable[]): DBTable[] {
  if (tables.length === 0) return tables;

  const cols = Math.max(2, Math.ceil(Math.sqrt(tables.length)));
  // Shuffle the table order randomly
  const shuffled = [...tables].sort(() => Math.random() - 0.5);

  return shuffled.map((table, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = (Math.random() - 0.5) * 80;
    const jitterY = (Math.random() - 0.5) * 60;
    return {
      ...table,
      x: col * (TABLE_WIDTH + GAP_X) + jitterX,
      y: row * (estimateTableHeight(table) + GAP_Y) + jitterY,
    };
  });
}

/**
 * Compute the average position index of a node's parents in the previous layer.
 * Used to sort nodes within a layer to reduce edge crossings.
 */
function averageParentPosition(
  nodeId: string,
  adj: Map<string, Set<string>>,
  prevPositions: Map<string, number>
): number {
  const neighbors = adj.get(nodeId);
  if (!neighbors) return 0;

  let sum = 0;
  let count = 0;
  for (const n of neighbors) {
    const pos = prevPositions.get(n);
    if (pos !== undefined) {
      sum += pos;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}
