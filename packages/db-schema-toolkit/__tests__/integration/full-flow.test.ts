/**
 * Integration tests: Full flow from raw schema content → parse → layout → export.
 *
 * These tests exercise the REAL parsers (no mocks) and verify that a schema can
 * travel through the entire pipeline: detect format → parse → auto-layout →
 * export to every supported format — without data loss or crashes.
 */
import { describe, it, expect } from "vitest";
import { parseSchemaFile, detectFormat } from "../../src/parsing/parse-schema-file";
import { exportDiagramToSQL } from "../../src/sql-export";
import { exportDiagramToMarkdown } from "../../src/export/markdown-export";
import { exportDiagramToMermaid } from "../../src/export/mermaid-export";
import { exportDiagramToPrisma } from "../../src/export/prisma-export";
import { exportDiagramToDrizzle } from "../../src/export/drizzle-export";
import { exportDiagramToDBML } from "../../src/export/dbml-export";
import { exportDiagramToPlantUML } from "../../src/export/plantuml-export";
import { encodeState, decodeState } from "../../src/sharing/encode-state";
import { analyzeSchema } from "../../src/analysis/schema-analyzer";
import { schemaToPromptContext } from "../../src/ai/ai-prompts";
import type { Diagram } from "../../src/domain";

// ─── Test schemas for each format ─────────────────────────────────

const SQL_SCHEMA = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  author_id INTEGER NOT NULL REFERENCES users(id),
  published BOOLEAN DEFAULT FALSE
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  body TEXT NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id INTEGER NOT NULL REFERENCES users(id)
);
`;

const DRIZZLE_SCHEMA = `
import { pgTable, serial, text, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: text('name'),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  authorId: integer('author_id').notNull().references(() => users.id),
  published: boolean('published'),
});
`;

const PRISMA_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id       Int     @id @default(autoincrement())
  title    String
  content  String?
  authorId Int
  author   User    @relation(fields: [authorId], references: [id])
}
`;

const DBML_SCHEMA = `
Table users {
  id integer [pk, increment]
  email varchar [unique, not null]
  name varchar
}

Table posts {
  id integer [pk, increment]
  title varchar [not null]
  author_id integer [ref: > users.id]
}
`;

const TYPEORM_SCHEMA = `
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column({ nullable: true })
  name: string;
}

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @ManyToOne(() => User)
  author: User;
}
`;

const SEQUELIZE_SCHEMA = `
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING },
});

const Post = sequelize.define('Post', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  authorId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } },
});
`;

const MIKROORM_SCHEMA = `
import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @Property({ nullable: true })
  name?: string;
}

@Entity()
export class Post {
  @PrimaryKey()
  id!: number;

  @Property()
  title!: string;

  @ManyToOne(() => User)
  author!: User;
}
`;

const KYSELY_SCHEMA = `
import { Generated } from "kysely";

interface Database {
  users: UsersTable;
  posts: PostsTable;
}

interface UsersTable {
  id: Generated<number>;
  email: string;
  name: string | null;
}

interface PostsTable {
  id: Generated<number>;
  title: string;
  author_id: number;
}
`;

// ─── Helpers ──────────────────────────────────────────────────────

function assertValidDiagram(diagram: Diagram, minTables: number) {
  expect(diagram.id).toBeDefined();
  expect(diagram.tables.length).toBeGreaterThanOrEqual(minTables);
  expect(diagram.databaseType).toBeDefined();
  expect(diagram.createdAt).toBeDefined();

  // All tables have positions from auto-layout
  for (const table of diagram.tables) {
    expect(typeof table.x).toBe("number");
    expect(typeof table.y).toBe("number");
    expect(isFinite(table.x)).toBe(true);
    expect(isFinite(table.y)).toBe(true);
  }

  // All tables have at least 1 field
  for (const table of diagram.tables) {
    expect(table.fields.length).toBeGreaterThan(0);
  }

  // All field IDs are unique
  const allFieldIds = diagram.tables.flatMap((t) => t.fields.map((f) => f.id));
  expect(new Set(allFieldIds).size).toBe(allFieldIds.length);
}

function assertExportsAllFormats(diagram: Diagram) {
  const sql = exportDiagramToSQL(diagram);
  expect(sql.length).toBeGreaterThan(0);
  expect(sql).toContain("CREATE TABLE");

  const md = exportDiagramToMarkdown(diagram);
  expect(md.length).toBeGreaterThan(0);
  expect(md).toContain("#");

  const mermaid = exportDiagramToMermaid(diagram);
  expect(mermaid).toContain("erDiagram");

  const prisma = exportDiagramToPrisma(diagram);
  expect(prisma).toContain("model");

  const drizzle = exportDiagramToDrizzle(diagram);
  expect(drizzle.length).toBeGreaterThan(0);

  const dbml = exportDiagramToDBML(diagram);
  expect(dbml).toContain("Table");

  const plantuml = exportDiagramToPlantUML(diagram);
  expect(plantuml).toContain("@startuml");
  expect(plantuml).toContain("@enduml");
}

function assertSurvivesURLSharing(diagram: Diagram) {
  const encoded = encodeState(diagram);
  expect(encoded.length).toBeGreaterThan(0);
  const decoded = decodeState(encoded);
  expect(decoded).not.toBeNull();
  expect(decoded!.tables.length).toBe(diagram.tables.length);
  expect(decoded!.relationships.length).toBe(diagram.relationships.length);
}

function assertAnalyzable(diagram: Diagram) {
  const analysis = analyzeSchema(diagram);
  expect(analysis.metrics.tableCount).toBeGreaterThan(0);
  expect(analysis.qualityScore.overall).toBeGreaterThanOrEqual(0);
  expect(analysis.qualityScore.overall).toBeLessThanOrEqual(100);
}

function assertAIContextGenerable(diagram: Diagram) {
  const context = schemaToPromptContext(diagram);
  expect(context.length).toBeGreaterThan(0);
  for (const table of diagram.tables) {
    expect(context).toContain(table.name);
  }
}

// ─── Full flow tests ──────────────────────────────────────────────

const FORMAT_CASES: Array<{
  name: string;
  content: string;
  fileName?: string;
  expectedFormat: string;
  minTables: number;
  minRelationships: number;
}> = [
  { name: "SQL", content: SQL_SCHEMA, fileName: "schema.sql", expectedFormat: "sql", minTables: 3, minRelationships: 3 },
  { name: "Drizzle", content: DRIZZLE_SCHEMA, fileName: "schema.ts", expectedFormat: "drizzle", minTables: 2, minRelationships: 1 },
  { name: "Prisma", content: PRISMA_SCHEMA, fileName: "schema.prisma", expectedFormat: "prisma", minTables: 2, minRelationships: 0 },
  { name: "DBML", content: DBML_SCHEMA, fileName: "schema.dbml", expectedFormat: "dbml", minTables: 2, minRelationships: 1 },
  { name: "TypeORM", content: TYPEORM_SCHEMA, fileName: "entities.ts", expectedFormat: "typeorm", minTables: 2, minRelationships: 0 },
  { name: "Sequelize", content: SEQUELIZE_SCHEMA, fileName: "models.ts", expectedFormat: "sequelize", minTables: 2, minRelationships: 0 },
  { name: "MikroORM", content: MIKROORM_SCHEMA, fileName: "entities.ts", expectedFormat: "mikroorm", minTables: 2, minRelationships: 0 },
  { name: "Kysely", content: KYSELY_SCHEMA, fileName: "database.ts", expectedFormat: "kysely", minTables: 2, minRelationships: 0 },
];

describe("Integration: full flow per format", () => {
  for (const tc of FORMAT_CASES) {
    describe(`${tc.name} format`, () => {
      let diagram: Diagram;

      it("detects the correct format", () => {
        const detected = detectFormat(tc.content, tc.fileName);
        expect(detected).toBe(tc.expectedFormat);
      });

      it("parses and auto-layouts successfully", () => {
        diagram = parseSchemaFile(tc.content, tc.fileName);
        assertValidDiagram(diagram, tc.minTables);
      });

      it("has expected minimum relationships", () => {
        diagram = parseSchemaFile(tc.content, tc.fileName);
        expect(diagram.relationships.length).toBeGreaterThanOrEqual(tc.minRelationships);
      });

      it("exports to all 7 code formats without errors", () => {
        diagram = parseSchemaFile(tc.content, tc.fileName);
        assertExportsAllFormats(diagram);
      });

      it("survives URL sharing roundtrip", () => {
        diagram = parseSchemaFile(tc.content, tc.fileName);
        assertSurvivesURLSharing(diagram);
      });

      it("can be analyzed (quality score + anti-patterns)", () => {
        diagram = parseSchemaFile(tc.content, tc.fileName);
        assertAnalyzable(diagram);
      });

      it("generates AI prompt context with all table names", () => {
        diagram = parseSchemaFile(tc.content, tc.fileName);
        assertAIContextGenerable(diagram);
      });
    });
  }
});

describe("Integration: cross-format consistency", () => {
  it("SQL and DBML produce diagrams with matching table names", () => {
    const sqlDiagram = parseSchemaFile(SQL_SCHEMA, "test.sql");
    const dbmlDiagram = parseSchemaFile(DBML_SCHEMA, "test.dbml");

    const sqlTableNames = new Set(sqlDiagram.tables.map((t) => t.name));
    const dbmlTableNames = new Set(dbmlDiagram.tables.map((t) => t.name));

    // Both should have 'users' and 'posts'
    expect(sqlTableNames.has("users")).toBe(true);
    expect(dbmlTableNames.has("users")).toBe(true);
    expect(sqlTableNames.has("posts")).toBe(true);
    expect(dbmlTableNames.has("posts")).toBe(true);
  });

  it("re-exporting SQL → re-parsing preserves table count", () => {
    const original = parseSchemaFile(SQL_SCHEMA, "test.sql");
    const reExported = exportDiagramToSQL(original, "postgresql");
    const reParsed = parseSchemaFile(reExported, "re-export.sql");

    expect(reParsed.tables.length).toBe(original.tables.length);
  });
});

describe("Integration: auto-detect without filename", () => {
  it("auto-detects SQL from CREATE TABLE", () => {
    const diagram = parseSchemaFile(SQL_SCHEMA);
    expect(diagram.tables.length).toBeGreaterThanOrEqual(3);
  });

  it("auto-detects Drizzle from pgTable import", () => {
    const diagram = parseSchemaFile(DRIZZLE_SCHEMA);
    expect(diagram.tables.length).toBeGreaterThanOrEqual(2);
  });

  it("auto-detects Prisma from model blocks", () => {
    const diagram = parseSchemaFile(PRISMA_SCHEMA);
    expect(diagram.tables.length).toBeGreaterThanOrEqual(2);
  });

  it("auto-detects DBML from Table blocks", () => {
    const diagram = parseSchemaFile(DBML_SCHEMA);
    expect(diagram.tables.length).toBeGreaterThanOrEqual(2);
  });
});
