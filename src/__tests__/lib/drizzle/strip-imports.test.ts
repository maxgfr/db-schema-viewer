import { describe, it, expect } from "vitest";
import { parseDrizzleSchema } from "@/lib/drizzle/drizzle-parser";

describe("stripTypeScriptImports in drizzle parser", () => {
  it("parses correctly with single-line imports", () => {
    const content = `
import { pgTable, serial, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("users");
  });

  it("parses correctly with multi-line imports", () => {
    const content = `
import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
  });

  it("parses correctly with import type statements", () => {
    const content = `
import type { InferSelectModel } from "drizzle-orm";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
  });

  it("strips .$type<>() annotations referencing imported types", () => {
    const content = `
import { pgTable, varchar } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

export const accounts = pgTable('accounts', {
  type: varchar('type', { length: 255 }).$type<AdapterAccount["type"]>().notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
    const typeField = diagram.tables[0]!.fields.find((f) => f.name === "type");
    expect(typeField).toBeDefined();
    expect(typeField?.type).toBe("VARCHAR");
  });

  it("handles side-effect imports", () => {
    const content = `
import "reflect-metadata";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
});
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(1);
  });

  it("handles callback syntax with imports and pgTableCreator", () => {
    const content = `
import { relations } from "drizzle-orm";
import { pgTableCreator, varchar, integer } from "drizzle-orm/pg-core";
import type { SomeType } from "some-package";

export const createTable = pgTableCreator((name) => \`app_\${name}\`);

export const users = createTable("user", (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    email: d.varchar({ length: 255 }).notNull(),
}));

export const posts = createTable("post", (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    authorId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    title: d.varchar({ length: 255 }).notNull(),
}));
    `;
    const diagram = parseDrizzleSchema(content);
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships).toHaveLength(1);
  });
});
