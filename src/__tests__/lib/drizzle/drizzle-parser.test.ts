import { describe, it, expect } from "vitest";
import { parseDrizzleSchema } from "@/lib/drizzle/drizzle-parser";

describe("parseDrizzleSchema", () => {
  it("parses a basic pgTable schema", () => {
    const content = `
import { pgTable, serial, text, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
});
    `;
    const diagram = parseDrizzleSchema(content, "Test");
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("users");
    expect(diagram.databaseType).toBe("postgresql");
    expect(diagram.tables[0]!.fields.length).toBeGreaterThanOrEqual(3);

    const idField = diagram.tables[0]!.fields.find((f) => f.name === "id");
    expect(idField?.primaryKey).toBe(true);

    const emailField = diagram.tables[0]!.fields.find((f) => f.name === "email");
    expect(emailField?.unique).toBe(true);
    expect(emailField?.nullable).toBe(false);
  });

  it("parses MySQL dialect", () => {
    const content = `
import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core';

export const posts = mysqlTable('posts', {
  id: int('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.databaseType).toBe("mysql");
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("posts");
  });

  it("parses SQLite dialect", () => {
    const content = `
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.databaseType).toBe("sqlite");
    expect(diagram.tables).toHaveLength(1);
  });

  it("extracts inline references", () => {
    const content = `
import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  authorId: integer('author_id').notNull().references(() => users.id),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships).toHaveLength(1);
    expect(diagram.relationships[0]!.sourceTableId).toBeDefined();
    expect(diagram.relationships[0]!.targetTableId).toBeDefined();
  });

  it("handles multiple tables with FKs", () => {
    const content = `
import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id').notNull().references(() => users.id),
  title: text('title').notNull(),
});

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').notNull().references(() => posts.id),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(3);
    expect(diagram.relationships).toHaveLength(3);
  });

  it("parses callback syntax with pgTableCreator", () => {
    const content = `
import { relations } from "drizzle-orm";
import { index, pgEnum, pgTableCreator, primaryKey, unique } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => \`app_\${name}\`);

export const declarationTypeEnum = pgEnum("declaration_type", ["initial", "correction"]);

export const users = createTable("user", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: d.varchar({ length: 255 }),
    email: d.varchar({ length: 255 }).notNull(),
    phone: d.varchar({ length: 20 }),
}));

export const accounts = createTable(
    "account",
    (d) => ({
        userId: d
            .varchar({ length: 255 })
            .notNull()
            .references(() => users.id),
        type: d.varchar({ length: 255 }).notNull(),
        provider: d.varchar({ length: 255 }).notNull(),
    }),
    (t) => [
        primaryKey({ columns: [t.provider] }),
        index("account_user_id_idx").on(t.userId),
    ],
);

export const declarations = createTable("declaration", (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    siren: d.varchar({ length: 9 }).notNull(),
    year: d.integer().notNull(),
    declarantId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => users.id),
    totalWomen: d.integer(),
    status: d.varchar({ length: 20 }),
}));

export const employeeCategories = createTable("employee_category", (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    declarationType: declarationTypeEnum().notNull(),
    womenCount: d.integer(),
    menCount: d.integer(),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));
    `;
    const diagram = parseDrizzleSchema(content, "Callback Test");
    expect(diagram.databaseType).toBe("postgresql");
    expect(diagram.tables).toHaveLength(4);

    // Check table names (should be the SQL names, not variable names)
    const tableNames = diagram.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual(["account", "declaration", "employee_category", "user"]);

    // Check users table columns
    const usersTable = diagram.tables.find((t) => t.name === "user");
    expect(usersTable).toBeDefined();
    expect(usersTable!.fields.length).toBeGreaterThanOrEqual(4);
    const idField = usersTable!.fields.find((f) => f.name === "id");
    expect(idField?.primaryKey).toBe(true);
    expect(idField?.type).toBe("VARCHAR");
    const emailField = usersTable!.fields.find((f) => f.name === "email");
    expect(emailField?.nullable).toBe(false);

    // Check callback-style inline references
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(2);

    // Check enum column
    const empTable = diagram.tables.find((t) => t.name === "employee_category");
    const enumField = empTable!.fields.find((f) => f.name === "declarationType");
    expect(enumField).toBeDefined();
    expect(enumField?.nullable).toBe(false);
  });

  it("parses callback syntax with multi-line d.method() chains", () => {
    const content = `
import { pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => \`app_\${name}\`);

export const posts = createTable("post", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey(),
    title: d.text().notNull(),
    content: d.text(),
    published: d.boolean(),
    createdAt: d.timestamp({ withTimezone: true }),
}));
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("post");

    const fields = diagram.tables[0]!.fields;
    expect(fields).toHaveLength(5);
    expect(fields.find((f) => f.name === "id")?.primaryKey).toBe(true);
    expect(fields.find((f) => f.name === "title")?.nullable).toBe(false);
    expect(fields.find((f) => f.name === "content")?.nullable).toBe(true);
    expect(fields.find((f) => f.name === "published")?.type).toBe("BOOLEAN");
    expect(fields.find((f) => f.name === "createdAt")?.type).toBe("TIMESTAMP");
  });

  it("maps Drizzle types to SQL types", () => {
    const content = `
import { pgTable, serial, text, boolean, jsonb, uuid, timestamp } from 'drizzle-orm/pg-core';

export const data = pgTable('data', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  active: boolean('active'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at'),
});
    `;
    const diagram = parseDrizzleSchema(content);
    const fields = diagram.tables[0]!.fields;

    expect(fields.find((f) => f.name === "id")?.type).toBe("UUID");
    expect(fields.find((f) => f.name === "name")?.type).toBe("TEXT");
    expect(fields.find((f) => f.name === "active")?.type).toBe("BOOLEAN");
    expect(fields.find((f) => f.name === "meta")?.type).toBe("JSONB");
    expect(fields.find((f) => f.name === "createdAt")?.type).toBe("TIMESTAMP");
  });
});
