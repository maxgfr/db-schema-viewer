import { describe, it, expect } from "vitest";
import { exportDiagramToSQL } from "../../src/sql-export";
import { exportDiagramToMarkdown } from "../../src/export/markdown-export";
import { exportDiagramToMermaid } from "../../src/export/mermaid-export";
import { exportDiagramToPrisma } from "../../src/export/prisma-export";
import { exportDiagramToDrizzle } from "../../src/export/drizzle-export";
import { exportDiagramToDBML } from "../../src/export/dbml-export";
import { exportDiagramToPlantUML } from "../../src/export/plantuml-export";
import type { Diagram, DatabaseType } from "../../src/domain";
import { generateId } from "../../src/utils";

// ─── Shared fixtures ────────────────────────────────────────────────

function makeDiagram(partial: Partial<Diagram> & Pick<Diagram, "tables" | "relationships">): Diagram {
  return {
    id: generateId(),
    name: "Test",
    databaseType: "postgresql",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

const emptyDiagram = makeDiagram({ name: "Empty", tables: [], relationships: [] });

const singleTableId = generateId();
const singlePkId = generateId();
const singleNullId = generateId();
const singleUniqueId = generateId();
const singleDefId = generateId();

const singleTableDiagram = makeDiagram({
  name: "Single",
  tables: [
    {
      id: singleTableId,
      name: "items",
      fields: [
        { id: singlePkId, name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: singleNullId, name: "description", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
        { id: singleUniqueId, name: "code", type: "VARCHAR(50)", primaryKey: false, unique: true, nullable: false, isForeignKey: false },
        { id: singleDefId, name: "quantity", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "0" },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    },
  ],
  relationships: [],
});

const viewTableId = generateId();
const viewDiagram = makeDiagram({
  name: "WithView",
  tables: [
    {
      id: viewTableId,
      name: "user_stats",
      fields: [
        { id: generateId(), name: "total", type: "INTEGER", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: true,
    },
  ],
  relationships: [],
});

const specialTableId = generateId();
const specialCharsDiagram = makeDiagram({
  name: "SpecialChars",
  tables: [
    {
      id: specialTableId,
      name: "my-table.v2",
      fields: [
        { id: generateId(), name: "field-one", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    },
  ],
  relationships: [],
});

const selfRefTableId = generateId();
const selfRefPkId = generateId();
const selfRefFkId = generateId();
const selfRefRelId = generateId();

const selfRefDiagram = makeDiagram({
  name: "SelfRef",
  tables: [
    {
      id: selfRefTableId,
      name: "employees",
      fields: [
        { id: selfRefPkId, name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "name", type: "VARCHAR(100)", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
        {
          id: selfRefFkId,
          name: "manager_id",
          type: "INTEGER",
          primaryKey: false,
          unique: false,
          nullable: true,
          isForeignKey: true,
          references: { table: "employees", field: "id" },
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
      id: selfRefRelId,
      sourceTableId: selfRefTableId,
      sourceFieldId: selfRefFkId,
      targetTableId: selfRefTableId,
      targetFieldId: selfRefPkId,
      cardinality: "one-to-many",
    },
  ],
});

const multiRelTblA = generateId();
const multiRelTblB = generateId();
const multiRelPkA = generateId();
const multiRelPkB = generateId();
const multiRelFk1 = generateId();
const multiRelFk2 = generateId();
const multiRelId1 = generateId();
const multiRelId2 = generateId();

const multiRelDiagram = makeDiagram({
  name: "MultiRel",
  tables: [
    {
      id: multiRelTblA,
      name: "orders",
      fields: [
        { id: multiRelPkA, name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        {
          id: multiRelFk1,
          name: "billing_address_id",
          type: "INTEGER",
          primaryKey: false,
          unique: false,
          nullable: false,
          isForeignKey: true,
          references: { table: "addresses", field: "id" },
        },
        {
          id: multiRelFk2,
          name: "shipping_address_id",
          type: "INTEGER",
          primaryKey: false,
          unique: false,
          nullable: false,
          isForeignKey: true,
          references: { table: "addresses", field: "id" },
        },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    },
    {
      id: multiRelTblB,
      name: "addresses",
      fields: [
        { id: multiRelPkB, name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "street", type: "TEXT", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    },
  ],
  relationships: [
    {
      id: multiRelId1,
      sourceTableId: multiRelTblA,
      sourceFieldId: multiRelFk1,
      targetTableId: multiRelTblB,
      targetFieldId: multiRelPkB,
      cardinality: "one-to-many",
    },
    {
      id: multiRelId2,
      sourceTableId: multiRelTblA,
      sourceFieldId: multiRelFk2,
      targetTableId: multiRelTblB,
      targetFieldId: multiRelPkB,
      cardinality: "one-to-many",
    },
  ],
});

// Full blog diagram: users, posts, comments, tags
const blogUsersId = generateId();
const blogUsersIdField = generateId();
const blogPostsId = generateId();
const blogPostsIdField = generateId();
const blogPostsUserIdField = generateId();
const blogCommentsId = generateId();
const blogCommentsIdField = generateId();
const blogCommentsPostIdField = generateId();
const blogTagsId = generateId();
const blogTagsIdField = generateId();

const fullBlogDiagram = makeDiagram({
  name: "Blog",
  tables: [
    {
      id: blogUsersId,
      name: "users",
      fields: [
        { id: blogUsersIdField, name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "email", type: "VARCHAR(255)", primaryKey: false, unique: true, nullable: false, isForeignKey: false },
        { id: generateId(), name: "created_at", type: "TIMESTAMPTZ", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "now()" },
        { id: generateId(), name: "is_active", type: "BOOLEAN", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "true" },
      ],
      indexes: [{ id: generateId(), name: "idx_users_email", columns: ["email"], unique: true }],
      x: 0,
      y: 0,
      isView: false,
    },
    {
      id: blogPostsId,
      name: "posts",
      fields: [
        { id: blogPostsIdField, name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "title", type: "VARCHAR(200)", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "body", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
        {
          id: blogPostsUserIdField,
          name: "author_id",
          type: "INTEGER",
          primaryKey: false,
          unique: false,
          nullable: false,
          isForeignKey: true,
          references: { table: "users", field: "id" },
        },
        { id: generateId(), name: "views", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "0" },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    },
    {
      id: blogCommentsId,
      name: "comments",
      fields: [
        { id: blogCommentsIdField, name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "content", type: "TEXT", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
        {
          id: blogCommentsPostIdField,
          name: "post_id",
          type: "INTEGER",
          primaryKey: false,
          unique: false,
          nullable: false,
          isForeignKey: true,
          references: { table: "posts", field: "id" },
        },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    },
    {
      id: blogTagsId,
      name: "tags",
      fields: [
        { id: blogTagsIdField, name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "label", type: "VARCHAR(50)", primaryKey: false, unique: true, nullable: false, isForeignKey: false },
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
      sourceTableId: blogPostsId,
      sourceFieldId: blogPostsUserIdField,
      targetTableId: blogUsersId,
      targetFieldId: blogUsersIdField,
      cardinality: "one-to-many",
    },
    {
      id: generateId(),
      sourceTableId: blogCommentsId,
      sourceFieldId: blogCommentsPostIdField,
      targetTableId: blogPostsId,
      targetFieldId: blogPostsIdField,
      cardinality: "one-to-many",
    },
  ],
});

// ─── SQL export ─────────────────────────────────────────────────────

describe("SQL full pipeline", () => {
  it("empty diagram produces header comment only", () => {
    const sql = exportDiagramToSQL(emptyDiagram);
    expect(sql).toContain("-- Generated by db-schema-viewer");
    expect(sql).not.toContain("CREATE TABLE");
  });

  it("views are excluded from DDL", () => {
    const sql = exportDiagramToSQL(viewDiagram);
    expect(sql).not.toContain("CREATE TABLE");
  });

  const dialects: DatabaseType[] = [
    "postgresql", "mysql", "mariadb", "sqlite", "supabase",
    "cockroachdb", "clickhouse", "bigquery", "snowflake",
  ];

  for (const dialect of dialects) {
    it(`${dialect} — produces valid CREATE TABLE`, () => {
      const sql = exportDiagramToSQL(singleTableDiagram, dialect);
      expect(sql).toContain("CREATE TABLE");
      expect(sql).toContain("items");
    });
  }

  it("self-referencing FK produces ALTER TABLE", () => {
    const sql = exportDiagramToSQL(selfRefDiagram);
    expect(sql).toContain("ALTER TABLE");
    expect(sql).toContain("fk_employees_manager_id");
    expect(sql).toContain("REFERENCES");
  });

  it("special chars are quoted in identifiers", () => {
    const sql = exportDiagramToSQL(specialCharsDiagram, "postgresql");
    // PG uses double-quote quoting
    expect(sql).toContain('"my-table.v2"');
    expect(sql).toContain('"field-one"');
  });

  it("special chars are backtick-quoted for MySQL", () => {
    const sql = exportDiagramToSQL(specialCharsDiagram, "mysql");
    expect(sql).toContain("`my-table.v2`");
    expect(sql).toContain("`field-one`");
  });
});

// ─── Markdown export ────────────────────────────────────────────────

describe("Markdown full pipeline", () => {
  it("empty diagram has title and metadata, no table sections", () => {
    const md = exportDiagramToMarkdown(emptyDiagram);
    expect(md).toContain("# Empty");
    expect(md).not.toContain("## Table:");
    expect(md).not.toContain("## View ");
  });

  it("views use View heading", () => {
    const md = exportDiagramToMarkdown(viewDiagram);
    expect(md).toContain("## View user_stats");
  });

  it("contains Mermaid ERD block", () => {
    const md = exportDiagramToMarkdown(singleTableDiagram);
    expect(md).toContain("```mermaid");
    expect(md).toContain("erDiagram");
    expect(md).toContain("```");
  });

  it("Mermaid block absent when 0 tables", () => {
    const md = exportDiagramToMarkdown(emptyDiagram);
    expect(md).not.toContain("```mermaid");
  });

  it("self-ref relation listed in Relationships section", () => {
    const md = exportDiagramToMarkdown(selfRefDiagram);
    expect(md).toContain("## Relationships");
    expect(md).toContain("employees.manager_id");
    expect(md).toContain("employees.id");
  });

  it("multi-relations listed individually", () => {
    const md = exportDiagramToMarkdown(multiRelDiagram);
    expect(md).toContain("orders.billing_address_id");
    expect(md).toContain("orders.shipping_address_id");
  });
});

// ─── Mermaid export ─────────────────────────────────────────────────

describe("Mermaid full pipeline", () => {
  it("empty diagram produces erDiagram only", () => {
    const m = exportDiagramToMermaid(emptyDiagram);
    expect(m.trim()).toBe("erDiagram");
  });

  it("special chars sanitised to underscores", () => {
    const m = exportDiagramToMermaid(specialCharsDiagram);
    expect(m).toContain("my_table_v2");
    expect(m).toContain("field_one");
  });

  it("self-ref produces valid Mermaid syntax", () => {
    const m = exportDiagramToMermaid(selfRefDiagram);
    // employees ||--o{ employees
    expect(m).toContain("employees ||--o{ employees");
  });

  it("three cardinality types map to correct symbols", () => {
    const tA = generateId();
    const tB = generateId();
    const fA = generateId();
    const fB = generateId();
    const base: Diagram = makeDiagram({
      tables: [
        { id: tA, name: "a", fields: [{ id: fA, name: "x", type: "INT", primaryKey: true, unique: false, nullable: false, isForeignKey: false }], indexes: [], x: 0, y: 0, isView: false },
        { id: tB, name: "b", fields: [{ id: fB, name: "y", type: "INT", primaryKey: true, unique: false, nullable: false, isForeignKey: false }], indexes: [], x: 0, y: 0, isView: false },
      ],
      relationships: [],
    });

    const cardinalities: Array<{ card: "one-to-one" | "one-to-many" | "many-to-many"; symbol: string }> = [
      { card: "one-to-one", symbol: "||--||" },
      { card: "one-to-many", symbol: "||--o{" },
      { card: "many-to-many", symbol: "}o--o{" },
    ];

    for (const { card, symbol } of cardinalities) {
      const d: Diagram = {
        ...base,
        relationships: [{ id: generateId(), sourceTableId: tA, sourceFieldId: fA, targetTableId: tB, targetFieldId: fB, cardinality: card }],
      };
      const m = exportDiagramToMermaid(d);
      expect(m).toContain(symbol);
    }
  });
});

// ─── Prisma export ──────────────────────────────────────────────────

describe("Prisma full pipeline", () => {
  it("empty diagram has generator and datasource, no models", () => {
    const p = exportDiagramToPrisma(emptyDiagram);
    expect(p).toContain("generator client");
    expect(p).toContain("datasource db");
    expect(p).not.toContain("model ");
  });

  it("self-ref produces FK field and reverse relation on same model", () => {
    const p = exportDiagramToPrisma(selfRefDiagram);
    expect(p).toContain("model Employee");
    // FK relation field
    expect(p).toContain("@relation(");
    expect(p).toContain("fields: [managerId]");
    expect(p).toContain("references: [id]");
    // Reverse relation (array)
    expect(p).toContain("Employee[]");
  });

  it("multi-relations use @relation name disambiguation", () => {
    const p = exportDiagramToPrisma(multiRelDiagram);
    // Both relations between orders & addresses should have explicit names
    expect(p).toContain(`"${multiRelId1}"`);
    expect(p).toContain(`"${multiRelId2}"`);
  });

  it("maps database providers correctly", () => {
    for (const [dbType, provider] of [
      ["postgresql", "postgresql"],
      ["mysql", "mysql"],
      ["sqlite", "sqlite"],
      ["cockroachdb", "cockroachdb"],
      ["supabase", "postgresql"],
      ["mariadb", "mysql"],
    ] as const) {
      const d = makeDiagram({ databaseType: dbType, tables: [], relationships: [] });
      const p = exportDiagramToPrisma(d);
      expect(p).toContain(`provider = "${provider}"`);
    }
  });

  it("handles various default values", () => {
    const d = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "defaults_test",
          fields: [
            { id: generateId(), name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: generateId(), name: "ts", type: "TIMESTAMPTZ", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "now()" },
            { id: generateId(), name: "uid", type: "UUID", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "gen_random_uuid()" },
            { id: generateId(), name: "count", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "42" },
            { id: generateId(), name: "active", type: "BOOLEAN", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "true" },
            { id: generateId(), name: "label", type: "TEXT", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "hello" },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
    });

    const p = exportDiagramToPrisma(d);
    expect(p).toContain("@default(now())");
    expect(p).toContain("@default(uuid())");
    expect(p).toContain("@default(42)");
    expect(p).toContain("@default(true)");
    expect(p).toContain('@default("hello")');
    expect(p).toContain("@default(autoincrement())");
  });
});

// ─── Drizzle export ─────────────────────────────────────────────────

describe("Drizzle full pipeline", () => {
  it("empty diagram produces import only", () => {
    const d = exportDiagramToDrizzle(emptyDiagram);
    expect(d).toContain("import {");
    expect(d).not.toContain("export const");
  });

  for (const [dbType, tableFn] of [
    ["postgresql", "pgTable"],
    ["mysql", "mysqlTable"],
    ["sqlite", "sqliteTable"],
  ] as const) {
    it(`${dbType} — uses ${tableFn} and correct module`, () => {
      const d = makeDiagram({ databaseType: dbType, tables: singleTableDiagram.tables, relationships: [] });
      const out = exportDiagramToDrizzle(d);
      expect(out).toContain(tableFn);
      const expectedModule = dbType === "postgresql"
        ? "drizzle-orm/pg-core"
        : dbType === "mysql"
          ? "drizzle-orm/mysql-core"
          : "drizzle-orm/sqlite-core";
      expect(out).toContain(expectedModule);
    });
  }

  it("self-ref references same table variable", () => {
    const d = exportDiagramToDrizzle(selfRefDiagram);
    // .references(() => employees.id)
    expect(d).toContain(".references(() => employees.id)");
  });

  it("handles various default values", () => {
    const d = makeDiagram({
      tables: [
        {
          id: generateId(),
          name: "defaults_test",
          fields: [
            { id: generateId(), name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: generateId(), name: "ts", type: "TIMESTAMPTZ", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "now()" },
            { id: generateId(), name: "count", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "0" },
            { id: generateId(), name: "active", type: "BOOLEAN", primaryKey: false, unique: false, nullable: false, isForeignKey: false, default: "true" },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
    });

    const out = exportDiagramToDrizzle(d);
    expect(out).toContain(".defaultNow()");
    expect(out).toContain(".default(0)");
    expect(out).toContain(".default(true)");
  });
});

// ─── Cross-format consistency ───────────────────────────────────────

describe("Cross-format consistency", () => {
  it("fullBlogDiagram — all 7 formats mention the same table names", () => {
    const tableNames = ["users", "posts", "comments", "tags"];
    const sql = exportDiagramToSQL(fullBlogDiagram);
    const md = exportDiagramToMarkdown(fullBlogDiagram);
    const mermaid = exportDiagramToMermaid(fullBlogDiagram);
    const prisma = exportDiagramToPrisma(fullBlogDiagram);
    const drizzle = exportDiagramToDrizzle(fullBlogDiagram);
    const dbml = exportDiagramToDBML(fullBlogDiagram);
    const plantuml = exportDiagramToPlantUML(fullBlogDiagram);

    for (const name of tableNames) {
      expect(sql).toContain(name);
      expect(md).toContain(name);
      expect(mermaid).toContain(name);
      // Prisma uses PascalCase model names, but @@map preserves original
      expect(prisma).toContain(name);
      // Drizzle uses camelCase variable names, but table string literal preserves original
      expect(drizzle).toContain(`"${name}"`);
      expect(dbml).toContain(name);
      expect(plantuml).toContain(name);
    }
  });

  it("DBML export contains Table blocks and Ref lines", () => {
    const dbml = exportDiagramToDBML(fullBlogDiagram);
    expect(dbml).toContain("Table users {");
    expect(dbml).toContain("Table posts {");
    expect(dbml).toContain("Ref:");
  });

  it("PlantUML export has @startuml/@enduml and entity blocks", () => {
    const puml = exportDiagramToPlantUML(fullBlogDiagram);
    expect(puml).toContain("@startuml");
    expect(puml).toContain("@enduml");
    expect(puml).toContain("entity");
  });
});
