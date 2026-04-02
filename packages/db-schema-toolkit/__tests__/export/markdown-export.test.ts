import { describe, it, expect } from "vitest";
import { exportDiagramToMarkdown } from "../../src/export/markdown-export";
import type { Diagram, DBRelationship } from "../../src/domain";
import { generateId } from "../../src/utils";

function buildTestDiagram(): { diagram: Diagram; usersTableId: string; postsTableId: string } {
  const userId = generateId();
  const userIdField = generateId();
  const emailFieldId = generateId();

  const postId = generateId();
  const postIdField = generateId();
  const postUserIdField = generateId();

  const rel: DBRelationship = {
    id: generateId(),
    sourceTableId: postId,
    sourceFieldId: postUserIdField,
    targetTableId: userId,
    targetFieldId: userIdField,
    cardinality: "one-to-many",
  };

  const diagram: Diagram = {
    id: generateId(),
    name: "Blog Schema",
    databaseType: "postgresql",
    tables: [
      {
        id: userId,
        name: "users",
        fields: [
          {
            id: userIdField,
            name: "id",
            type: "SERIAL",
            primaryKey: true,
            unique: false,
            nullable: false,
            isForeignKey: false,
          },
          {
            id: emailFieldId,
            name: "email",
            type: "VARCHAR(255)",
            primaryKey: false,
            unique: true,
            nullable: false,
            isForeignKey: false,
            default: "'test@example.com'",
          },
        ],
        indexes: [
          {
            id: generateId(),
            name: "idx_users_email",
            columns: ["email"],
            unique: true,
          },
        ],
        x: 0,
        y: 0,
        isView: false,
      },
      {
        id: postId,
        name: "posts",
        fields: [
          {
            id: postIdField,
            name: "id",
            type: "SERIAL",
            primaryKey: true,
            unique: false,
            nullable: false,
            isForeignKey: false,
          },
          {
            id: postUserIdField,
            name: "user_id",
            type: "INTEGER",
            primaryKey: false,
            unique: false,
            nullable: false,
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
    relationships: [rel],
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  return { diagram, usersTableId: userId, postsTableId: postId };
}

describe("exportDiagramToMarkdown", () => {
  it("contains the diagram title", () => {
    const { diagram } = buildTestDiagram();
    const md = exportDiagramToMarkdown(diagram);
    expect(md).toContain("# Blog Schema");
  });

  it("contains table headers (Column, Type, Nullable, PK, etc.)", () => {
    const { diagram } = buildTestDiagram();
    const md = exportDiagramToMarkdown(diagram);
    expect(md).toContain("| Column | Type | Nullable | PK | Unique | Default |");
  });

  it("contains field rows for each table", () => {
    const { diagram } = buildTestDiagram();
    const md = exportDiagramToMarkdown(diagram);
    expect(md).toContain("| id | SERIAL |");
    expect(md).toContain("| email | VARCHAR(255) |");
    expect(md).toContain("| user_id | INTEGER |");
  });

  it("contains relationships section", () => {
    const { diagram } = buildTestDiagram();
    const md = exportDiagramToMarkdown(diagram);
    expect(md).toContain("## Relationships");
    expect(md).toContain("**posts.user_id** -> **users.id** (one-to-many)");
  });

  it("marks VIEW tables", () => {
    const viewDiagram: Diagram = {
      id: generateId(),
      name: "With Views",
      databaseType: "postgresql",
      tables: [
        {
          id: generateId(),
          name: "user_summary",
          fields: [
            {
              id: generateId(),
              name: "total",
              type: "INTEGER",
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
      relationships: [],
      createdAt: new Date().toISOString(),
    };

    const md = exportDiagramToMarkdown(viewDiagram);
    expect(md).toContain("## View user_summary");
  });

  it("includes index section when indexes exist", () => {
    const { diagram } = buildTestDiagram();
    const md = exportDiagramToMarkdown(diagram);
    expect(md).toContain("### Indexes");
    expect(md).toContain("idx_users_email");
  });

  it("includes database type in subtitle", () => {
    const { diagram } = buildTestDiagram();
    const md = exportDiagramToMarkdown(diagram);
    expect(md).toContain("postgresql");
  });
});
