import { describe, it, expect } from "vitest";
import { parseDrizzleSchema } from "../../src/drizzle/drizzle-parser";

describe("parseDrizzleSchema — edge cases", () => {
  it("handles .default(sql`...`) expressions", () => {
    const content = `
import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const items = pgTable('items', {
  id: uuid('id').primaryKey().default(sql\`gen_random_uuid()\`),
  createdAt: timestamp('created_at').default(sql\`NOW()\`),
  name: text('name').notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
    const fields = diagram.tables[0]!.fields;
    expect(fields.find((f) => f.name === "id")?.primaryKey).toBe(true);
    expect(fields.find((f) => f.name === "name")?.nullable).toBe(false);
  });

  it("handles pgEnum declarations", () => {
    const content = `
import { pgTable, serial, pgEnum } from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('status', ['active', 'inactive', 'pending']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  status: statusEnum('status').notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
    const statusField = diagram.tables[0]!.fields.find((f) => f.name === "status");
    expect(statusField).toBeDefined();
    expect(statusField?.nullable).toBe(false);
  });

  it("handles multi-line column definitions with chaining", () => {
    const content = `
import { pgTable, serial, varchar, integer } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id')
    .primaryKey(),
  name: varchar('name', { length: 255 })
    .notNull()
    .unique(),
  price: integer('price')
    .notNull()
    .default(0),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
    const fields = diagram.tables[0]!.fields;
    expect(fields.find((f) => f.name === "id")?.primaryKey).toBe(true);
    expect(fields.find((f) => f.name === "name")?.unique).toBe(true);
    expect(fields.find((f) => f.name === "price")?.default).toBe("0");
  });

  it("handles block comments inside schema", () => {
    const content = `
import { pgTable, serial, text } from 'drizzle-orm/pg-core';

/* Main users table */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  /* user name */ name: text('name').notNull(),
  email: text('email'),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.fields.length).toBeGreaterThanOrEqual(2);
  });

  it("skips empty table (no fields parsed)", () => {
    const content = `
import { pgTable } from 'drizzle-orm/pg-core';

export const empty = pgTable('empty', {});
    `;
    const diagram = parseDrizzleSchema(content);
    // Empty tables are skipped by the parser (no columns to extract)
    expect(diagram.tables).toHaveLength(0);
  });

  it("handles multiple references from same table", () => {
    const content = `
import { pgTable, serial, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').references(() => users.id),
  receiverId: integer('receiver_id').references(() => users.id),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships).toHaveLength(2);
  });

  it("handles self-referencing table", () => {
    const content = `
import { pgTable, serial, integer, text } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  parentId: integer('parent_id').references(() => categories.id),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.relationships).toHaveLength(1);
    const rel = diagram.relationships[0]!;
    expect(rel.sourceTableId).toBe(rel.targetTableId);
  });
});
