import { describe, it, expect } from "vitest";
import { schemaToPromptContext } from "@/lib/ai/ai-prompts";
import type { Diagram } from "@/lib/domain";
import { generateId } from "@/lib/utils";

function makeDiagram(overrides?: Partial<Diagram>): Diagram {
  return {
    id: generateId(),
    name: "Test Schema",
    databaseType: "postgresql",
    tables: [],
    relationships: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("schemaToPromptContext edge cases", () => {
  it("handles tables without fields (should not crash, should show table name)", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "empty_table",
          fields: [],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
    });

    const result = schemaToPromptContext(diagram);
    expect(result).toContain("TABLE: empty_table");
    expect(result).toContain("Tables: 1");
  });

  it("handles fields with special characters in names (hyphen, dot)", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "events",
          fields: [
            {
              id: generateId(),
              name: "user-name",
              type: "VARCHAR(100)",
              primaryKey: false,
              unique: false,
              nullable: true,
              isForeignKey: false,
            },
            {
              id: generateId(),
              name: "order.id",
              type: "INT",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
    });

    const result = schemaToPromptContext(diagram);
    expect(result).toContain("user-name: VARCHAR(100)");
    expect(result).toContain("order.id: INT");
  });

  it("outputs schema-prefixed table names (e.g., auth.users)", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "users",
          schema: "auth",
          fields: [
            {
              id: generateId(),
              name: "id",
              type: "UUID",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
    });

    const result = schemaToPromptContext(diagram);
    expect(result).toContain("TABLE: auth.users");
  });

  it("handles DEFAULT values containing quotes", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "settings",
          fields: [
            {
              id: generateId(),
              name: "status",
              type: "VARCHAR(20)",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: false,
              default: "'active'",
            },
            {
              id: generateId(),
              name: "metadata",
              type: "JSONB",
              primaryKey: false,
              unique: false,
              nullable: true,
              isForeignKey: false,
              default: "'{}'",
            },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
    });

    const result = schemaToPromptContext(diagram);
    expect(result).toContain("DEFAULT 'active'");
    expect(result).toContain("DEFAULT '{}'");
  });

  it("handles multiple tables with many relationships", () => {
    const usersTableId = generateId();
    const usersIdFieldId = generateId();
    const ordersTableId = generateId();
    const ordersUserIdFieldId = generateId();
    const ordersIdFieldId = generateId();
    const itemsTableId = generateId();
    const itemsOrderIdFieldId = generateId();

    const diagram = makeDiagram({
      tables: [
        {
          id: usersTableId,
          name: "users",
          fields: [
            {
              id: usersIdFieldId,
              name: "id",
              type: "SERIAL",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
        {
          id: ordersTableId,
          name: "orders",
          fields: [
            {
              id: ordersIdFieldId,
              name: "id",
              type: "SERIAL",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
            {
              id: ordersUserIdFieldId,
              name: "user_id",
              type: "INT",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: true,
              references: { table: "users", field: "id" },
            },
          ],
          indexes: [],
          x: 200,
          y: 0,
          isView: false,
        },
        {
          id: itemsTableId,
          name: "order_items",
          fields: [
            {
              id: generateId(),
              name: "id",
              type: "SERIAL",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
            {
              id: itemsOrderIdFieldId,
              name: "order_id",
              type: "INT",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: true,
              references: { table: "orders", field: "id" },
            },
          ],
          indexes: [],
          x: 400,
          y: 0,
          isView: false,
        },
      ],
      relationships: [
        {
          id: generateId(),
          sourceTableId: ordersTableId,
          sourceFieldId: ordersUserIdFieldId,
          targetTableId: usersTableId,
          targetFieldId: usersIdFieldId,
          cardinality: "one-to-many",
        },
        {
          id: generateId(),
          sourceTableId: itemsTableId,
          sourceFieldId: itemsOrderIdFieldId,
          targetTableId: ordersTableId,
          targetFieldId: ordersIdFieldId,
          cardinality: "one-to-many",
        },
      ],
    });

    const result = schemaToPromptContext(diagram);
    expect(result).toContain("Tables: 3");
    expect(result).toContain("Relationships: 2");
    expect(result).toContain("TABLE: users");
    expect(result).toContain("TABLE: orders");
    expect(result).toContain("TABLE: order_items");
    expect(result).toContain("-> users.id");
    expect(result).toContain("-> orders.id");
  });
});
