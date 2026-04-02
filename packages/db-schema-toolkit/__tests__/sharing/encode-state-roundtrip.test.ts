import { describe, it, expect } from "vitest";
import { encodeState, decodeState } from "../../src/sharing/encode-state";
import type { Diagram, DBTable, DBRelationship } from "../../src/domain";
import { generateId } from "../../src/utils";

function makeTable(index: number): DBTable {
  return {
    id: `table-${index}`,
    name: `table_${index}`,
    fields: [
      {
        id: `table-${index}-pk`,
        name: "id",
        type: "SERIAL",
        primaryKey: true,
        unique: false,
        nullable: false,
        isForeignKey: false,
      },
      {
        id: `table-${index}-name`,
        name: "name",
        type: "VARCHAR(255)",
        primaryKey: false,
        unique: false,
        nullable: true,
        isForeignKey: false,
      },
    ],
    indexes: [],
    x: index * 250,
    y: index * 100,
    isView: false,
  };
}

function makeLargeDiagram(tableCount: number): Diagram {
  const tables: DBTable[] = [];
  const relationships: DBRelationship[] = [];

  for (let i = 0; i < tableCount; i++) {
    tables.push(makeTable(i));
  }

  // Create relationships linking each table to the previous one
  for (let i = 1; i < tableCount; i++) {
    relationships.push({
      id: `rel-${i}`,
      sourceTableId: `table-${i}`,
      sourceFieldId: `table-${i}-pk`,
      targetTableId: `table-${i - 1}`,
      targetFieldId: `table-${i - 1}-pk`,
      cardinality: "one-to-many",
    });
  }

  return {
    id: generateId(),
    name: "Large Schema",
    databaseType: "postgresql",
    tables,
    relationships,
    createdAt: "2024-06-01T00:00:00.000Z",
  };
}

describe("encode-state roundtrip with large schemas", () => {
  it("round-trips a schema with 50+ tables", () => {
    const diagram = makeLargeDiagram(55);
    const encoded = encodeState(diagram);
    const decoded = decodeState(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.tables).toHaveLength(55);
    expect(decoded!.relationships).toHaveLength(54);
    expect(decoded!.name).toBe("Large Schema");
  });

  it("preserves positions (x, y) after roundtrip", () => {
    const diagram = makeLargeDiagram(10);
    const encoded = encodeState(diagram);
    const decoded = decodeState(encoded);

    expect(decoded).not.toBeNull();
    for (let i = 0; i < 10; i++) {
      const table = decoded!.tables.find((t) => t.name === `table_${i}`);
      expect(table).toBeDefined();
      expect(table!.x).toBe(i * 250);
      expect(table!.y).toBe(i * 100);
    }
  });

  it("preserves relationships after roundtrip", () => {
    const diagram = makeLargeDiagram(5);
    const encoded = encodeState(diagram);
    const decoded = decodeState(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.relationships).toHaveLength(4);

    for (let i = 1; i < 5; i++) {
      const rel = decoded!.relationships.find(
        (r) => r.sourceTableId === `table-${i}` && r.targetTableId === `table-${i - 1}`
      );
      expect(rel).toBeDefined();
      expect(rel!.cardinality).toBe("one-to-many");
    }
  });

  it("preserves field attributes (primaryKey, unique, nullable, default) after roundtrip", () => {
    const diagram: Diagram = {
      id: generateId(),
      name: "Attributes Schema",
      databaseType: "mysql",
      tables: [
        {
          id: "t1",
          name: "products",
          fields: [
            {
              id: "f1",
              name: "id",
              type: "INT",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
            {
              id: "f2",
              name: "sku",
              type: "VARCHAR(50)",
              primaryKey: false,
              unique: true,
              nullable: false,
              isForeignKey: false,
            },
            {
              id: "f3",
              name: "description",
              type: "TEXT",
              primaryKey: false,
              unique: false,
              nullable: true,
              isForeignKey: false,
            },
            {
              id: "f4",
              name: "status",
              type: "VARCHAR(20)",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: false,
              default: "'active'",
            },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-06-01T00:00:00.000Z",
    };

    const encoded = encodeState(diagram);
    const decoded = decodeState(encoded);

    expect(decoded).not.toBeNull();
    const table = decoded!.tables[0]!;
    const fields = table.fields;

    const idField = fields.find((f) => f.name === "id")!;
    expect(idField.primaryKey).toBe(true);
    expect(idField.nullable).toBe(false);

    const skuField = fields.find((f) => f.name === "sku")!;
    expect(skuField.unique).toBe(true);
    expect(skuField.nullable).toBe(false);

    const descField = fields.find((f) => f.name === "description")!;
    expect(descField.nullable).toBe(true);

    const statusField = fields.find((f) => f.name === "status")!;
    expect(statusField.default).toBe("'active'");
  });

  it("preserves indexes after roundtrip", () => {
    const diagram: Diagram = {
      id: generateId(),
      name: "Indexed Schema",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "orders",
          fields: [
            {
              id: "f1",
              name: "id",
              type: "SERIAL",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
            {
              id: "f2",
              name: "user_id",
              type: "INT",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: true,
            },
            {
              id: "f3",
              name: "created_at",
              type: "TIMESTAMP",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
          ],
          indexes: [
            {
              id: "idx1",
              name: "idx_orders_user_id",
              columns: ["user_id"],
              unique: false,
            },
            {
              id: "idx2",
              name: "idx_orders_user_created",
              columns: ["user_id", "created_at"],
              unique: true,
            },
          ],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-06-01T00:00:00.000Z",
    };

    const encoded = encodeState(diagram);
    const decoded = decodeState(encoded);

    expect(decoded).not.toBeNull();
    const table = decoded!.tables[0]!;
    expect(table.indexes).toHaveLength(2);

    const idx1 = table.indexes.find((i) => i.name === "idx_orders_user_id")!;
    expect(idx1.columns).toEqual(["user_id"]);
    expect(idx1.unique).toBe(false);

    const idx2 = table.indexes.find((i) => i.name === "idx_orders_user_created")!;
    expect(idx2.columns).toEqual(["user_id", "created_at"]);
    expect(idx2.unique).toBe(true);
  });
});
