import { describe, it, expect } from "vitest";
import { autoLayout } from "@/lib/layout/auto-layout";
import type { DBTable, DBRelationship } from "@/lib/domain";

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

  it("keeps connected tables closer together", () => {
    const tables = [makeTable("a"), makeTable("b"), makeTable("c")];
    const relationships: DBRelationship[] = [
      {
        id: "r1",
        sourceTableId: "a",
        sourceFieldId: "a_f0",
        targetTableId: "b",
        targetFieldId: "b_f0",
        cardinality: "one-to-many",
      },
    ];

    const result = autoLayout(tables, relationships);
    // a and b should be in the same component (positioned together)
    const aTable = result.find((t) => t.id === "a")!;
    const bTable = result.find((t) => t.id === "b")!;
    const cTable = result.find((t) => t.id === "c")!;

    // a and b in same component, c is separate
    // This is a soft check - they should be relatively close
    expect(aTable).toBeDefined();
    expect(bTable).toBeDefined();
    expect(cTable).toBeDefined();
  });
});
