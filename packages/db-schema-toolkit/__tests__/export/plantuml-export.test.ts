import { describe, it, expect } from "vitest";
import { exportDiagramToPlantUML } from "../../src/export/plantuml-export";
import type { Diagram, DBRelationship } from "../../src/domain";
import { generateId } from "../../src/utils";

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

describe("exportDiagramToPlantUML", () => {
  it("starts with @startuml and ends with @enduml", () => {
    const diagram = buildTestDiagram();
    const puml = exportDiagramToPlantUML(diagram);
    expect(puml.startsWith("@startuml")).toBe(true);
    expect(puml.trimEnd().endsWith("@enduml")).toBe(true);
  });

  it("contains entity definitions for tables", () => {
    const diagram = buildTestDiagram();
    const puml = exportDiagramToPlantUML(diagram);
    expect(puml).toContain('entity "users" as users {');
    expect(puml).toContain('entity "posts" as posts {');
  });

  it("marks PK fields with star prefix and PK stereotype", () => {
    const diagram = buildTestDiagram();
    const puml = exportDiagramToPlantUML(diagram);
    expect(puml).toContain("* id : int <<PK>>");
  });

  it("marks FK fields with FK stereotype", () => {
    const diagram = buildTestDiagram();
    const puml = exportDiagramToPlantUML(diagram);
    expect(puml).toContain("author_id : int <<FK>>");
  });

  it("uses }o--|| notation for one-to-many relationships", () => {
    const diagram = buildTestDiagram();
    const puml = exportDiagramToPlantUML(diagram);
    expect(puml).toContain("}o--||");
    // Parent (users/target) on left, child (posts/source) on right
    expect(puml).toContain("users }o--|| posts : author_id");
  });

  it("uses ||--|| notation for one-to-one relationships", () => {
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

    const puml = exportDiagramToPlantUML(diagram);
    expect(puml).toContain("||--||");
  });

  it("uses class keyword with View stereotype for views", () => {
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

    const puml = exportDiagramToPlantUML(diagram);
    expect(puml).toContain('class "active_users" as active_users <<View>>');
    expect(puml).not.toContain('entity "active_users"');
  });
});
