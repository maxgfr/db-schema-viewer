import { describe, it, expect, vi } from "vitest";
import { parseSchemaFile } from "@/lib/parsing/parse-schema-file";
import { parsePrismaSchema } from "@/lib/prisma/prisma-parser";
import { parseDBMLSchema } from "@/lib/dbml/dbml-parser";
import { parseTypeORMSchema } from "@/lib/typeorm/typeorm-parser";
import { parseDrizzleSchema } from "@/lib/drizzle/drizzle-parser";

// Mock the individual parsers so we can verify routing without depending
// on their full implementations (the SQL parser is still used for the
// "no filename" / ".sql" cases since it's the default path).
vi.mock("@/lib/prisma/prisma-parser", () => ({
  parsePrismaSchema: vi.fn((_content: string, name?: string) => ({
    id: "prisma-id",
    name: name ?? "Prisma Schema",
    databaseType: "postgresql",
    tables: [
      {
        id: "t1",
        name: "User",
        fields: [{ id: "f1", name: "id", type: "Int", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
        indexes: [],
        x: 0,
        y: 0,
        isView: false,
      },
    ],
    relationships: [],
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock("@/lib/dbml/dbml-parser", () => ({
  parseDBMLSchema: vi.fn((_content: string, name?: string) => ({
    id: "dbml-id",
    name: name ?? "DBML Schema",
    databaseType: "postgresql",
    tables: [
      {
        id: "t1",
        name: "users",
        fields: [{ id: "f1", name: "id", type: "integer", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
        indexes: [],
        x: 0,
        y: 0,
        isView: false,
      },
    ],
    relationships: [],
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock("@/lib/typeorm/typeorm-parser", () => ({
  parseTypeORMSchema: vi.fn((_content: string, name?: string) => ({
    id: "typeorm-id",
    name: name ?? "TypeORM Schema",
    databaseType: "postgresql",
    tables: [
      {
        id: "t1",
        name: "User",
        fields: [{ id: "f1", name: "id", type: "int", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
        indexes: [],
        x: 0,
        y: 0,
        isView: false,
      },
    ],
    relationships: [],
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock("@/lib/drizzle/drizzle-parser", () => ({
  parseDrizzleSchema: vi.fn((_content: string, name?: string) => ({
    id: "drizzle-id",
    name: name ?? "Drizzle Schema",
    databaseType: "postgresql",
    tables: [
      {
        id: "t1",
        name: "users",
        fields: [{ id: "f1", name: "id", type: "serial", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
        indexes: [],
        x: 0,
        y: 0,
        isView: false,
      },
    ],
    relationships: [],
    createdAt: new Date().toISOString(),
  })),
}));

describe("parseSchemaFile", () => {
  it("parses a basic SQL string with no filename", () => {
    const sql = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL
      );
    `;
    const diagram = parseSchemaFile(sql);

    expect(diagram.tables.length).toBeGreaterThanOrEqual(1);
    expect(diagram.tables[0]!.name).toBe("users");
  });

  it("parses with .sql extension", () => {
    const sql = `
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        total NUMERIC(10,2)
      );
    `;
    const diagram = parseSchemaFile(sql, "my-schema.sql");

    expect(diagram.name).toBe("my-schema");
    expect(diagram.tables.length).toBeGreaterThanOrEqual(1);
    expect(diagram.tables[0]!.name).toBe("orders");
  });

  it("parses with .prisma extension and routes to Prisma parser", () => {
    const content = `
      model User {
        id    Int    @id @default(autoincrement())
        email String @unique
      }
    `;
    const diagram = parseSchemaFile(content, "schema.prisma");

    expect(parsePrismaSchema).toHaveBeenCalledWith(content, "schema");
    expect(diagram.id).toBe("prisma-id");
  });

  it("parses with .dbml extension and routes to DBML parser", () => {
    const content = `
      Table users {
        id integer [pk, increment]
        email varchar
      }
    `;
    const diagram = parseSchemaFile(content, "database.dbml");

    expect(parseDBMLSchema).toHaveBeenCalledWith(content, "database");
    expect(diagram.id).toBe("dbml-id");
  });

  it("parses with .ts extension containing @Entity and routes to TypeORM parser", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

      @Entity()
      export class User {
        @PrimaryGeneratedColumn()
        id: number;

        @Column()
        name: string;
      }
    `;
    const diagram = parseSchemaFile(content, "entities.ts");

    expect(parseTypeORMSchema).toHaveBeenCalledWith(content, "entities");
    expect(diagram.id).toBe("typeorm-id");
  });

  it("parses with .ts extension (no decorators) and routes to Drizzle parser", () => {
    const content = `
      import { pgTable, serial, text } from "drizzle-orm/pg-core";

      export const users = pgTable("users", {
        id: serial("id").primaryKey(),
        name: text("name"),
      });
    `;
    const diagram = parseSchemaFile(content, "schema.ts");

    expect(parseDrizzleSchema).toHaveBeenCalledWith(content, "schema");
    expect(diagram.id).toBe("drizzle-id");
  });

  it("returns tables with auto-layout applied (x,y positions set)", () => {
    const sql = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id)
      );
    `;
    const diagram = parseSchemaFile(sql);

    // With 2 tables, auto-layout should assign positions.
    // At least one table should have non-zero coordinates
    // (the first may be at 0,0, but the second should be offset).
    const hasPositionedTable = diagram.tables.some(
      (t) => t.x !== 0 || t.y !== 0
    );
    expect(diagram.tables.length).toBe(2);
    expect(hasPositionedTable).toBe(true);
  });
});
