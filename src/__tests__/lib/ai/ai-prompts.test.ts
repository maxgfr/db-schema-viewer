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

describe("schemaToPromptContext", () => {
  it("handles empty diagram with 0 tables", () => {
    const diagram = makeDiagram();
    const result = schemaToPromptContext(diagram);
    expect(result).toContain("Tables: 0");
    expect(result).toContain("Relationships: 0");
    expect(result).toContain("PostgreSQL");
  });

  it("contains table name and field names for a single table", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "users",
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
              id: generateId(),
              name: "email",
              type: "VARCHAR(255)",
              primaryKey: false,
              unique: false,
              nullable: true,
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
    expect(result).toContain("TABLE: users");
    expect(result).toContain("id: SERIAL");
    expect(result).toContain("email: VARCHAR(255)");
  });

  it("shows PK, FK, and UNIQUE flags correctly", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "orders",
          fields: [
            {
              id: generateId(),
              name: "id",
              type: "INT",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
            {
              id: generateId(),
              name: "user_id",
              type: "INT",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: true,
              references: { table: "users", field: "id" },
            },
            {
              id: generateId(),
              name: "code",
              type: "VARCHAR(50)",
              primaryKey: false,
              unique: true,
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
    expect(result).toContain("[PK");
    expect(result).toContain("FK");
    expect(result).toContain("UNIQUE");
  });

  it("shows references format (-> table.field)", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "posts",
          fields: [
            {
              id: generateId(),
              name: "author_id",
              type: "INT",
              primaryKey: false,
              unique: false,
              nullable: true,
              isForeignKey: true,
              references: { table: "users", field: "id" },
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
    expect(result).toContain("-> users.id");
  });

  it("shows Indexes section when indexes exist", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "users",
          fields: [
            {
              id: generateId(),
              name: "id",
              type: "INT",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
            {
              id: generateId(),
              name: "email",
              type: "VARCHAR(255)",
              primaryKey: false,
              unique: false,
              nullable: true,
              isForeignKey: false,
            },
          ],
          indexes: [
            {
              id: generateId(),
              name: "idx_email",
              columns: ["email"],
              unique: true,
            },
          ],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
    });

    const result = schemaToPromptContext(diagram);
    expect(result).toContain("Indexes:");
    expect(result).toContain("idx_email");
    expect(result).toContain("(email)");
    expect(result).toContain("UNIQUE");
  });

  it("uses VIEW prefix for views", () => {
    const diagram = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "active_users",
          fields: [
            {
              id: generateId(),
              name: "id",
              type: "INT",
              primaryKey: false,
              unique: false,
              nullable: true,
              isForeignKey: false,
            },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: true,
        },
      ],
    });

    const result = schemaToPromptContext(diagram);
    expect(result).toContain("VIEW: active_users");
    expect(result).not.toContain("TABLE: active_users");
  });
});
