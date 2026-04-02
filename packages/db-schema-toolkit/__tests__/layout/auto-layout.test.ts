import { describe, it, expect } from "vitest";
import { autoLayout, shuffleLayout } from "../../src/layout/auto-layout";
import type { DBTable, DBRelationship } from "../../src/domain";

function makeTable(id: string, fieldCount = 3): DBTable {
  return {
    id,
    name: `table_${id}`,
    fields: Array.from({ length: fieldCount }, (_, i) => ({
      id: `${id}_f${i}`,
      name: `field_${i}`,
      type: "TEXT",
      primaryKey: i === 0,
      unique: false,
      nullable: true,
      isForeignKey: false,
    })),
    indexes: [],
    x: 0,
    y: 0,
    isView: false,
  };
}

function makeRel(source: string, target: string): DBRelationship {
  return {
    id: `r_${source}_${target}`,
    sourceTableId: source,
    sourceFieldId: `${source}_f0`,
    targetTableId: target,
    targetFieldId: `${target}_f0`,
    cardinality: "one-to-many",
  };
}

function distance(a: DBTable, b: DBTable): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

describe("autoLayout", () => {
  it("returns empty array for no tables", () => {
    expect(autoLayout([], [])).toEqual([]);
  });

  it("assigns positions to tables", () => {
    const tables = [makeTable("a"), makeTable("b"), makeTable("c")];
    const result = autoLayout(tables, []);

    for (const table of result) {
      expect(typeof table.x).toBe("number");
      expect(typeof table.y).toBe("number");
    }
  });

  it("produces non-overlapping positions", () => {
    const tables = Array.from({ length: 10 }, (_, i) =>
      makeTable(String(i))
    );
    const result = autoLayout(tables, []);

    // Check no two tables share the exact same position
    const positions = result.map((t) => `${t.x},${t.y}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(positions.length);
  });

  it("keeps connected tables closer together than disconnected ones", () => {
    const tables = [makeTable("a"), makeTable("b"), makeTable("c")];
    const relationships = [makeRel("a", "b")];

    const result = autoLayout(tables, relationships);
    const a = result.find((t) => t.id === "a")!;
    const b = result.find((t) => t.id === "b")!;
    const c = result.find((t) => t.id === "c")!;

    // a-b are connected, c is isolated (placed separately below)
    const distAB = distance(a, b);
    const distAC = distance(a, c);
    expect(distAB).toBeLessThan(distAC);
  });

  // ── BFS layering ─────────────────────────────────────────────────

  describe("BFS layering", () => {
    it("places hub at top, direct neighbors in next layer", () => {
      // Star topology: hub connected to A, B, C, D
      const tables = [
        makeTable("hub"),
        makeTable("a"),
        makeTable("b"),
        makeTable("c"),
        makeTable("d"),
      ];
      const rels = [
        makeRel("a", "hub"),
        makeRel("b", "hub"),
        makeRel("c", "hub"),
        makeRel("d", "hub"),
      ];

      const result = autoLayout(tables, rels);
      const hub = result.find((t) => t.id === "hub")!;
      const children = result.filter((t) => t.id !== "hub");

      // Hub should be above (smaller y) all children
      for (const child of children) {
        expect(hub.y).toBeLessThan(child.y);
      }

      // All children should be at the same y level
      const childYs = new Set(children.map((c) => c.y));
      expect(childYs.size).toBe(1);
    });

    it("creates multiple layers for chain topology", () => {
      // Chain: A -> B -> C -> D -> E
      const tables = [
        makeTable("a"),
        makeTable("b"),
        makeTable("c"),
        makeTable("d"),
        makeTable("e"),
      ];
      const rels = [
        makeRel("a", "b"),
        makeRel("b", "c"),
        makeRel("c", "d"),
        makeRel("d", "e"),
      ];

      const result = autoLayout(tables, rels);
      // Should produce 3+ layers (BFS from middle node)
      const yValues = new Set(result.map((t) => t.y));
      expect(yValues.size).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Multiple components ──────────────────────────────────────────

  describe("multiple components", () => {
    it("lays out separate components vertically", () => {
      const tables = [
        makeTable("a1"),
        makeTable("a2"),
        makeTable("b1"),
        makeTable("b2"),
      ];
      const rels = [makeRel("a1", "a2"), makeRel("b1", "b2")];

      const result = autoLayout(tables, rels);
      const comp1 = [
        result.find((t) => t.id === "a1")!,
        result.find((t) => t.id === "a2")!,
      ];
      const comp2 = [
        result.find((t) => t.id === "b1")!,
        result.find((t) => t.id === "b2")!,
      ];

      const comp1MaxY = Math.max(...comp1.map((t) => t.y));
      const comp2MinY = Math.min(...comp2.map((t) => t.y));

      // Second component should be below the first
      expect(comp2MinY).toBeGreaterThan(comp1MaxY);
    });

    it("places isolated tables after connected components", () => {
      const tables = [
        makeTable("connected1"),
        makeTable("connected2"),
        makeTable("isolated"),
      ];
      const rels = [makeRel("connected1", "connected2")];

      const result = autoLayout(tables, rels);
      const c1 = result.find((t) => t.id === "connected1")!;
      const c2 = result.find((t) => t.id === "connected2")!;
      const iso = result.find((t) => t.id === "isolated")!;

      // Isolated table should be below the connected component
      const connectedMaxY = Math.max(c1.y, c2.y);
      expect(iso.y).toBeGreaterThan(connectedMaxY);
    });
  });

  // ── Spacing ──────────────────────────────────────────────────────

  describe("spacing", () => {
    it("maintains minimum horizontal gap between columns", () => {
      const tables = Array.from({ length: 8 }, (_, i) =>
        makeTable(String(i))
      );
      const result = autoLayout(tables, []);

      // Get all unique x positions
      const xs = [...new Set(result.map((t) => t.x))].sort((a, b) => a - b);

      for (let i = 1; i < xs.length; i++) {
        const gap = xs[i]! - xs[i - 1]!;
        // TABLE_WIDTH (280) + GAP_X (140) = 420 minimum between columns
        expect(gap).toBeGreaterThanOrEqual(400);
      }
    });

    it("maintains minimum vertical gap between rows", () => {
      // Star: hub + 5 children → 2 layers
      const tables = [
        makeTable("hub"),
        makeTable("a"),
        makeTable("b"),
        makeTable("c"),
        makeTable("d"),
        makeTable("e"),
      ];
      const rels = [
        makeRel("a", "hub"),
        makeRel("b", "hub"),
        makeRel("c", "hub"),
        makeRel("d", "hub"),
        makeRel("e", "hub"),
      ];

      const result = autoLayout(tables, rels);
      const hub = result.find((t) => t.id === "hub")!;
      const child = result.find((t) => t.id === "a")!;

      // GAP_Y is 120, plus table height
      expect(child.y - hub.y).toBeGreaterThanOrEqual(120);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles a single table", () => {
      const result = autoLayout([makeTable("only")], []);
      expect(result).toHaveLength(1);
      expect(typeof result[0]!.x).toBe("number");
      expect(typeof result[0]!.y).toBe("number");
    });

    it("handles a table with many fields", () => {
      const result = autoLayout([makeTable("big", 50)], []);
      expect(result).toHaveLength(1);
    });

    it("handles 20+ tables without crashing", () => {
      const tables = Array.from({ length: 25 }, (_, i) => makeTable(String(i)));
      const rels = Array.from({ length: 20 }, (_, i) =>
        makeRel(String(i), String(i + 1))
      );
      const result = autoLayout(tables, rels);
      expect(result).toHaveLength(25);

      // All tables should have positions
      for (const t of result) {
        expect(typeof t.x).toBe("number");
        expect(typeof t.y).toBe("number");
        expect(isFinite(t.x)).toBe(true);
        expect(isFinite(t.y)).toBe(true);
      }
    });

    it("preserves table data (only x/y change)", () => {
      const original = makeTable("test", 5);
      original.name = "special_name";
      const result = autoLayout([original], []);
      expect(result[0]!.name).toBe("special_name");
      expect(result[0]!.fields).toHaveLength(5);
      expect(result[0]!.id).toBe("test");
    });
  });
});

describe("shuffleLayout", () => {
  it("returns empty array for no tables", () => {
    expect(shuffleLayout([])).toEqual([]);
  });

  it("assigns new positions to all tables", () => {
    const tables = Array.from({ length: 6 }, (_, i) => makeTable(String(i)));
    const result = shuffleLayout(tables);

    expect(result).toHaveLength(6);
    for (const table of result) {
      expect(typeof table.x).toBe("number");
      expect(typeof table.y).toBe("number");
      expect(isFinite(table.x)).toBe(true);
      expect(isFinite(table.y)).toBe(true);
    }
  });

  it("produces different positions on successive calls", () => {
    const tables = Array.from({ length: 8 }, (_, i) => makeTable(String(i)));

    // Run shuffle multiple times — at least one should differ
    const results = Array.from({ length: 5 }, () => shuffleLayout(tables));
    const positionStrings = results.map((r) =>
      r.map((t) => `${t.id}:${Math.round(t.x)},${Math.round(t.y)}`).join("|")
    );

    const unique = new Set(positionStrings);
    // With 8 tables and 5 runs, we should get at least 2 distinct layouts
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it("preserves table data (only x/y change)", () => {
    const tables = [makeTable("a", 5), makeTable("b", 3)];
    const result = shuffleLayout(tables);

    for (const original of tables) {
      const shuffled = result.find((t) => t.id === original.id)!;
      expect(shuffled).toBeDefined();
      expect(shuffled.name).toBe(original.name);
      expect(shuffled.fields).toHaveLength(original.fields.length);
    }
  });

  it("does not mutate the original array", () => {
    const tables = [makeTable("a"), makeTable("b"), makeTable("c")];
    const originalIds = tables.map((t) => t.id);
    const originalPositions = tables.map((t) => ({ x: t.x, y: t.y }));

    shuffleLayout(tables);

    // Original array should be unchanged
    expect(tables.map((t) => t.id)).toEqual(originalIds);
    for (let i = 0; i < tables.length; i++) {
      expect(tables[i]!.x).toBe(originalPositions[i]!.x);
      expect(tables[i]!.y).toBe(originalPositions[i]!.y);
    }
  });

  it("handles single table", () => {
    const tables = [makeTable("only")];
    const result = shuffleLayout(tables);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("only");
  });
});
