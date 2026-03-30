import { describe, it, expect } from "vitest";
import { exportDiagramToMermaid } from "@/lib/export/mermaid-export";
import type { Diagram, DBRelationship } from "@/lib/domain";
import { generateId } from "@/lib/utils";

function buildTestDiagram(): Diagram {
  const usersId = generateId();
  const usersIdField = generateId();
  const postsId = generateId();
  const postsIdField = generateId();
  const postsUserIdField = generateId();

  const rel: DBRelationship = {
    id: generateId(),
    sourceTableId: postsId,
    sourceFieldId: postsUserIdField,
    targetTableId: usersId,
    targetFieldId: usersIdField,
    cardinality: "one-to-many",
  };

  return {
    id: generateId(),
    name: "Test ERD",
    databaseType: "postgresql",
    tables: [
      {
        id: usersId,
        name: "users",
        fields: [
          {
            id: usersIdField,
            name: "id",
            type: "int",
            primaryKey: true,
            unique: false,
            nullable: false,
            isForeignKey: false,
          },
          {
            id: generateId(),
            name: "email",
            type: "varchar",
            primaryKey: false,
            unique: true,
            nullable: false,
            isForeignKey: false,
          },
          {
            id: generateId(),
            name: "name",
            type: "varchar",
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
      {
        id: postsId,
        name: "posts",
        fields: [
          {
            id: postsIdField,
            name: "id",
            type: "int",
            primaryKey: true,
            unique: false,
            nullable: false,
            isForeignKey: false,
          },
          {
            id: postsUserIdField,
            name: "author_id",
            type: "int",
            primaryKey: false,
            unique: false,
            nullable: false,
            isForeignKey: true,
          },
          {
            id: generateId(),
            name: "title",
            type: "varchar",
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
    relationships: [rel],
    createdAt: new Date().toISOString(),
  };
}

describe("exportDiagramToMermaid", () => {
  it("starts with erDiagram", () => {
    const diagram = buildTestDiagram();
    const mermaid = exportDiagramToMermaid(diagram);
    expect(mermaid.startsWith("erDiagram")).toBe(true);
  });

  it("contains table definitions", () => {
    const diagram = buildTestDiagram();
    const mermaid = exportDiagramToMermaid(diagram);
    expect(mermaid).toContain("users {");
    expect(mermaid).toContain("posts {");
  });

  it("contains field definitions with quoted PK/FK/UK tags", () => {
    const diagram = buildTestDiagram();
    const mermaid = exportDiagramToMermaid(diagram);
    expect(mermaid).toContain('int id "PK"');
    expect(mermaid).toContain('int author_id "FK"');
    expect(mermaid).toContain('varchar email "UK"');
  });

  it("contains relationship notation for one-to-many", () => {
    const diagram = buildTestDiagram();
    const mermaid = exportDiagramToMermaid(diagram);
    expect(mermaid).toContain("||--o{");
    expect(mermaid).toContain('users ||--o{ posts : "author_id to id"');
  });

  it("uses correct notation for one-to-one", () => {
    const t1Id = generateId();
    const t1FieldId = generateId();
    const t2Id = generateId();
    const t2FieldId = generateId();

    const diagram: Diagram = {
      id: generateId(),
      name: "One to One",
      databaseType: "postgresql",
      tables: [
        {
          id: t1Id,
          name: "users",
          fields: [
            {
              id: t1FieldId,
              name: "id",
              type: "int",
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
          id: t2Id,
          name: "profiles",
          fields: [
            {
              id: t2FieldId,
              name: "user_id",
              type: "int",
              primaryKey: true,
              unique: true,
              nullable: false,
              isForeignKey: true,
            },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [
        {
          id: generateId(),
          sourceTableId: t2Id,
          sourceFieldId: t2FieldId,
          targetTableId: t1Id,
          targetFieldId: t1FieldId,
          cardinality: "one-to-one",
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const mermaid = exportDiagramToMermaid(diagram);
    expect(mermaid).toContain("||--||");
  });

  it("places parent (referenced) table on left in one-to-one", () => {
    const t1Id = generateId();
    const t1FieldId = generateId();
    const t2Id = generateId();
    const t2FieldId = generateId();

    const diagram: Diagram = {
      id: generateId(),
      name: "Direction Test",
      databaseType: "postgresql",
      tables: [
        {
          id: t1Id,
          name: "users",
          fields: [{ id: t1FieldId, name: "id", type: "int", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
        {
          id: t2Id,
          name: "profiles",
          fields: [{ id: t2FieldId, name: "user_id", type: "int", primaryKey: true, unique: true, nullable: false, isForeignKey: true }],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      // source = child (profiles), target = parent (users)
      relationships: [{
        id: generateId(),
        sourceTableId: t2Id,
        sourceFieldId: t2FieldId,
        targetTableId: t1Id,
        targetFieldId: t1FieldId,
        cardinality: "one-to-one",
      }],
      createdAt: new Date().toISOString(),
    };

    const mermaid = exportDiagramToMermaid(diagram);
    // parent "users" should be on the left
    expect(mermaid).toContain('users ||--|| profiles');
    // NOT: profiles ||--|| users
    expect(mermaid).not.toContain('profiles ||--|| users');
  });

  it("uses correct notation for many-to-many", () => {
    const t1Id = generateId();
    const t1FieldId = generateId();
    const t2Id = generateId();
    const t2FieldId = generateId();

    const diagram: Diagram = {
      id: generateId(),
      name: "Many to Many",
      databaseType: "postgresql",
      tables: [
        {
          id: t1Id,
          name: "students",
          fields: [
            {
              id: t1FieldId,
              name: "id",
              type: "int",
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
          id: t2Id,
          name: "courses",
          fields: [
            {
              id: t2FieldId,
              name: "id",
              type: "int",
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
      relationships: [
        {
          id: generateId(),
          sourceTableId: t1Id,
          sourceFieldId: t1FieldId,
          targetTableId: t2Id,
          targetFieldId: t2FieldId,
          cardinality: "many-to-many",
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const mermaid = exportDiagramToMermaid(diagram);
    expect(mermaid).toContain("}o--o{");
  });
});
