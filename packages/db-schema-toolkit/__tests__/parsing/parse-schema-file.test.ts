import { describe, it, expect, vi } from "vitest";
import { parseSchemaFile, detectFormat } from "../../src/parsing/parse-schema-file";
import { parsePrismaSchema } from "../../src/prisma/prisma-parser";
import { parseDBMLSchema } from "../../src/dbml/dbml-parser";
import { parseTypeORMSchema } from "../../src/typeorm/typeorm-parser";
import { parseDrizzleSchema } from "../../src/drizzle/drizzle-parser";
import { parseSequelizeSchema } from "../../src/sequelize/sequelize-parser";
import { parseMikroORMSchema } from "../../src/mikroorm/mikroorm-parser";
import { parseKyselySchema } from "../../src/kysely/kysely-parser";

// Mock the individual parsers so we can verify routing without depending
// on their full implementations (the SQL parser is still used for the
// "no filename" / ".sql" cases since it's the default path).
vi.mock("../../src/prisma/prisma-parser", () => ({
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

vi.mock("../../src/dbml/dbml-parser", () => ({
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

vi.mock("../../src/typeorm/typeorm-parser", () => ({
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

vi.mock("../../src/drizzle/drizzle-parser", () => ({
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

vi.mock("../../src/sequelize/sequelize-parser", () => ({
  parseSequelizeSchema: vi.fn((_content: string, name?: string) => ({
    id: "sequelize-id",
    name: name ?? "Sequelize Schema",
    databaseType: "postgresql",
    tables: [
      {
        id: "t1",
        name: "User",
        fields: [{ id: "f1", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
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

vi.mock("../../src/mikroorm/mikroorm-parser", () => ({
  parseMikroORMSchema: vi.fn((_content: string, name?: string) => ({
    id: "mikroorm-id",
    name: name ?? "MikroORM Schema",
    databaseType: "postgresql",
    tables: [
      {
        id: "t1",
        name: "User",
        fields: [{ id: "f1", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
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

vi.mock("../../src/kysely/kysely-parser", () => ({
  parseKyselySchema: vi.fn((_content: string, name?: string) => ({
    id: "kysely-id",
    name: name ?? "Kysely Schema",
    databaseType: "postgresql",
    tables: [
      {
        id: "t1",
        name: "users",
        fields: [{ id: "f1", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
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

  it("auto-detects Drizzle from content when no fileName is provided", () => {
    const content = `
      import { pgTableCreator } from "drizzle-orm/pg-core";
      export const createTable = pgTableCreator((name) => \`app_\${name}\`);
      export const users = createTable("user", (d) => ({
        id: d.varchar({ length: 255 }).notNull().primaryKey(),
        email: d.varchar({ length: 255 }).notNull(),
      }));
    `;
    const diagram = parseSchemaFile(content);

    expect(parseDrizzleSchema).toHaveBeenCalledWith(content, undefined);
    expect(diagram.id).toBe("drizzle-id");
  });

  it("auto-detects Prisma from content when no fileName is provided", () => {
    const content = `
      model User {
        id    Int    @id @default(autoincrement())
        email String @unique
      }
    `;
    const diagram = parseSchemaFile(content);

    expect(parsePrismaSchema).toHaveBeenCalledWith(content, undefined);
    expect(diagram.id).toBe("prisma-id");
  });

  it("auto-detects DBML from content when no fileName is provided", () => {
    const content = `
      Table users {
        id integer [pk, increment]
        email varchar
      }
    `;
    const diagram = parseSchemaFile(content);

    expect(parseDBMLSchema).toHaveBeenCalledWith(content, undefined);
    expect(diagram.id).toBe("dbml-id");
  });

  it("auto-detects TypeORM from content when no fileName is provided", () => {
    const content = `
      @Entity()
      export class User {
        @PrimaryGeneratedColumn()
        id: number;
      }
    `;
    const diagram = parseSchemaFile(content);

    expect(parseTypeORMSchema).toHaveBeenCalledWith(content, undefined);
    expect(diagram.id).toBe("typeorm-id");
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

  it("detects Sequelize from .ts with sequelize.define()", () => {
    const content = `
      const User = sequelize.define('User', {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        name: DataTypes.STRING,
      });
    `;
    const diagram = parseSchemaFile(content, "models.ts");
    expect(parseSequelizeSchema).toHaveBeenCalledWith(content, "models");
    expect(diagram.id).toBe("sequelize-id");
  });

  it("detects MikroORM from .ts with @Entity + @Property", () => {
    const content = `
      @Entity()
      export class User {
        @PrimaryKey()
        id!: number;

        @Property()
        name!: string;
      }
    `;
    const diagram = parseSchemaFile(content, "entities.ts");
    expect(parseMikroORMSchema).toHaveBeenCalledWith(content, "entities");
    expect(diagram.id).toBe("mikroorm-id");
  });

  it("detects Kysely from .ts with interface Database + Generated<>", () => {
    const content = `
      interface Database {
        users: UsersTable;
      }
      interface UsersTable {
        id: Generated<number>;
        name: string;
      }
    `;
    const diagram = parseSchemaFile(content, "database.ts");
    expect(parseKyselySchema).toHaveBeenCalledWith(content, "database");
    expect(diagram.id).toBe("kysely-id");
  });

  it("auto-detects Sequelize from content (no filename)", () => {
    const content = `
      const User = sequelize.define('User', {
        id: { type: DataTypes.INTEGER, primaryKey: true },
      });
    `;
    const diagram = parseSchemaFile(content);
    expect(parseSequelizeSchema).toHaveBeenCalledWith(content, undefined);
    expect(diagram.id).toBe("sequelize-id");
  });

  it("auto-detects MikroORM from content (no filename)", () => {
    const content = `
      @Entity()
      export class User {
        @PrimaryKey()
        id!: number;
        @Property()
        name!: string;
      }
    `;
    const diagram = parseSchemaFile(content);
    expect(parseMikroORMSchema).toHaveBeenCalledWith(content, undefined);
    expect(diagram.id).toBe("mikroorm-id");
  });

  it("auto-detects Kysely from content (no filename)", () => {
    const content = `
      interface Database {
        users: UsersTable;
      }
      interface UsersTable {
        id: Generated<number>;
        name: string;
      }
    `;
    const diagram = parseSchemaFile(content);
    expect(parseKyselySchema).toHaveBeenCalledWith(content, undefined);
    expect(diagram.id).toBe("kysely-id");
  });
});

describe("detectFormat", () => {
  it("returns sequelize for content with sequelize.define()", () => {
    expect(detectFormat(`sequelize.define('User', { id: DataTypes.INTEGER });`)).toBe("sequelize");
  });

  it("returns mikroorm for content with @Entity + @Property", () => {
    expect(detectFormat(`@Entity()\nclass User {\n@Property()\nname!: string;\n}`)).toBe("mikroorm");
  });

  it("returns kysely for content with interface Database + Generated", () => {
    expect(detectFormat(`interface Database {\nusers: UsersTable;\n}\ninterface UsersTable {\nid: Generated<number>;\n}`)).toBe("kysely");
  });
});
