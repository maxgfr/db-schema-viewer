import { describe, it, expect } from "vitest";
import { exportDiagramToDrizzle } from "../../src/export/drizzle-export";
import type { Diagram } from "../../src/domain";

describe("exportDiagramToDrizzle", () => {
  it("generates a basic table with a primary key", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToDrizzle(diagram);
    expect(result).toContain('export const users = pgTable("users"');
    expect(result).toContain('id: serial("id").primaryKey()');
  });

  it("maps various SQL types to Drizzle column builders", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "all_types",
          fields: [
            { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f2", name: "name", type: "VARCHAR(255)", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
            { id: "f3", name: "bio", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f4", name: "active", type: "BOOLEAN", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
            { id: "f5", name: "created_at", type: "TIMESTAMP", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f6", name: "score", type: "FLOAT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f7", name: "metadata", type: "JSONB", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f8", name: "uid", type: "UUID", primaryKey: false, unique: true, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToDrizzle(diagram);
    expect(result).toContain('id: serial("id").primaryKey()');
    expect(result).toContain('name: varchar("name", { length: 255 }).notNull()');
    expect(result).toContain('bio: text("bio")');
    expect(result).toContain('active: boolean("active").notNull()');
    expect(result).toContain('createdAt: timestamp("created_at")');
    expect(result).toContain('score: real("score")');
    expect(result).toContain('metadata: jsonb("metadata")');
    expect(result).toContain('uid: uuid("uid").notNull().unique()');
  });

  it("generates .references() for FK relationships", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
        {
          id: "t2",
          name: "posts",
          fields: [
            { id: "f2", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f3", name: "author_id", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: true },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [
        {
          id: "r1",
          sourceTableId: "t2",
          sourceFieldId: "f3",
          targetTableId: "t1",
          targetFieldId: "f1",
          cardinality: "one-to-many",
        },
      ],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToDrizzle(diagram);
    expect(result).toContain(".references(() => users.id)");
  });

  it("uses mysql-core for MySQL dialect", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "mysql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f2", name: "name", type: "VARCHAR(100)", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToDrizzle(diagram);
    expect(result).toContain('from "drizzle-orm/mysql-core"');
    expect(result).toContain("mysqlTable(");
  });

  it("uses sqlite-core for SQLite dialect", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "sqlite",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f2", name: "name", type: "TEXT", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToDrizzle(diagram);
    expect(result).toContain('from "drizzle-orm/sqlite-core"');
    expect(result).toContain("sqliteTable(");
  });

  it("generates a full schema with multiple tables", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Blog",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f2", name: "email", type: "VARCHAR(255)", primaryKey: false, unique: true, nullable: false, isForeignKey: false },
            { id: "f3", name: "name", type: "VARCHAR(100)", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f4", name: "created_at", type: "TIMESTAMP", primaryKey: false, unique: false, nullable: true, default: "now()", isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
        {
          id: "t2",
          name: "posts",
          fields: [
            { id: "f5", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f6", name: "title", type: "VARCHAR(255)", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
            { id: "f7", name: "content", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f8", name: "author_id", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: true },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [
        {
          id: "r1",
          sourceTableId: "t2",
          sourceFieldId: "f8",
          targetTableId: "t1",
          targetFieldId: "f1",
          cardinality: "one-to-many",
        },
      ],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToDrizzle(diagram);

    // Check import
    expect(result).toContain('from "drizzle-orm/pg-core"');

    // Check users table
    expect(result).toContain('export const users = pgTable("users"');
    expect(result).toContain('id: serial("id").primaryKey()');
    expect(result).toContain('email: varchar("email", { length: 255 }).notNull().unique()');
    expect(result).toContain('name: varchar("name", { length: 100 })');
    expect(result).toContain('createdAt: timestamp("created_at").defaultNow()');

    // Check posts table
    expect(result).toContain('export const posts = pgTable("posts"');
    expect(result).toContain('title: varchar("title", { length: 255 }).notNull()');
    expect(result).toContain('content: text("content")');
    expect(result).toContain('authorId: integer("author_id").notNull().references(() => users.id)');
  });

  it("handles FK references from field.references when relationships array is empty", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
        {
          id: "t2",
          name: "orders",
          fields: [
            { id: "f2", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            {
              id: "f3",
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
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToDrizzle(diagram);
    expect(result).toContain(".references(() => users.id)");
  });
});
