import { describe, it, expect } from "vitest";
import { exportDiagramToDBML } from "@/lib/export/dbml-export";
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

describe("exportDiagramToDBML", () => {
  it("exports basic table with fields", () => {
    const diagram = buildTestDiagram();
    const dbml = exportDiagramToDBML(diagram);
    expect(dbml).toContain("Table users {");
    expect(dbml).toContain("Table posts {");
    expect(dbml).toContain("  id int");
    expect(dbml).toContain("  email varchar");
    expect(dbml).toContain("  title varchar");
  });

  it("marks primary key fields with pk attribute", () => {
    const diagram = buildTestDiagram();
    const dbml = exportDiagramToDBML(diagram);
    expect(dbml).toContain("  id int [pk]");
  });

  it("exports foreign key relationships as Ref lines", () => {
    const diagram = buildTestDiagram();
    const dbml = exportDiagramToDBML(diagram);
    expect(dbml).toContain("Ref: posts.author_id > users.id");
  });

  it("uses - symbol for one-to-one relationships", () => {
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

    const dbml = exportDiagramToDBML(diagram);
    expect(dbml).toContain("Ref: profiles.user_id - users.id");
  });

  it("uses <> symbol for many-to-many relationships", () => {
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

    const dbml = exportDiagramToDBML(diagram);
    expect(dbml).toContain("Ref: students.id <> courses.id");
  });

  it("exports indexes inside tables", () => {
    const tableId = generateId();

    const diagram: Diagram = {
      id: generateId(),
      name: "Index Test",
      databaseType: "postgresql",
      tables: [
        {
          id: tableId,
          name: "orders",
          fields: [
            {
              id: generateId(),
              name: "id",
              type: "int",
              primaryKey: true,
              unique: false,
              nullable: false,
              isForeignKey: false,
            },
            {
              id: generateId(),
              name: "customer_id",
              type: "int",
              primaryKey: false,
              unique: false,
              nullable: false,
              isForeignKey: true,
            },
          ],
          indexes: [
            {
              id: generateId(),
              name: "idx_customer",
              columns: ["customer_id"],
              unique: false,
            },
            {
              id: generateId(),
              name: "idx_unique_order",
              columns: ["customer_id", "id"],
              unique: true,
            },
          ],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: new Date().toISOString(),
    };

    const dbml = exportDiagramToDBML(diagram);
    expect(dbml).toContain("indexes {");
    expect(dbml).toContain("customer_id [name: 'idx_customer']");
    expect(dbml).toContain("(customer_id, id) [unique, name: 'idx_unique_order']");
  });

  it("exports table comments as Note lines", () => {
    const diagram: Diagram = {
      id: generateId(),
      name: "Comment Test",
      databaseType: "postgresql",
      tables: [
        {
          id: generateId(),
          name: "users",
          fields: [
            {
              id: generateId(),
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
          comment: "Main user accounts table",
        },
      ],
      relationships: [],
      createdAt: new Date().toISOString(),
    };

    const dbml = exportDiagramToDBML(diagram);
    expect(dbml).toContain("Note: 'Main user accounts table'");
  });

  it("marks views with a comment marker", () => {
    const diagram: Diagram = {
      id: generateId(),
      name: "View Test",
      databaseType: "postgresql",
      tables: [
        {
          id: generateId(),
          name: "active_users",
          fields: [
            {
              id: generateId(),
              name: "id",
              type: "int",
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

    const dbml = exportDiagramToDBML(diagram);
    expect(dbml).toContain("// View:");
    expect(dbml).not.toContain("Table active_users");
  });
});
