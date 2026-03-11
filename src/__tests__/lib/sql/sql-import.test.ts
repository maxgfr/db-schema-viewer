import { describe, it, expect } from "vitest";
import { parseSQLToDiagram, parseSQLWithType } from "@/lib/sql/sql-import";

describe("parseSQLToDiagram", () => {
  it("parses a simple PostgreSQL schema", () => {
    const sql = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name TEXT
      );
    `;
    const diagram = parseSQLToDiagram(sql, "Test");

    expect(diagram.name).toBe("Test");
    expect(diagram.tables).toHaveLength(1);

    const users = diagram.tables[0]!;
    expect(users.name).toBe("users");
    expect(users.fields.length).toBeGreaterThanOrEqual(3);

    const idField = users.fields.find((f) => f.name === "id");
    expect(idField).toBeDefined();
    expect(idField!.primaryKey).toBe(true);
  });

  it("parses foreign key references", () => {
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
    const diagram = parseSQLToDiagram(sql);

    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(1);

    const rel = diagram.relationships[0]!;
    const ordersTable = diagram.tables.find((t) => t.name === "orders")!;
    const usersTable = diagram.tables.find((t) => t.name === "users")!;

    expect(rel.sourceTableId).toBe(ordersTable.id);
    expect(rel.targetTableId).toBe(usersTable.id);
  });

  it("parses ALTER TABLE foreign keys", () => {
    const sql = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY
      );
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL
      );
      ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);
    `;
    const diagram = parseSQLToDiagram(sql);

    expect(diagram.relationships).toHaveLength(1);
  });

  it("parses MySQL syntax", () => {
    const sql = `
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;
    `;
    const diagram = parseSQLWithType(sql, "mysql");

    expect(diagram.tables).toHaveLength(1);
    expect(diagram.databaseType).toBe("mysql");
  });

  it("parses SQLite syntax", () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
    `;
    const diagram = parseSQLWithType(sql, "sqlite");
    expect(diagram.tables).toHaveLength(1);
  });

  it("handles multiple tables with relationships", () => {
    const sql = `
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      );
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id INTEGER REFERENCES categories(id)
      );
      CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER DEFAULT 1
      );
    `;
    const diagram = parseSQLToDiagram(sql);

    expect(diagram.tables).toHaveLength(3);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(2);
  });

  it("generates unique IDs for all entities", () => {
    const sql = `
      CREATE TABLE a (id SERIAL PRIMARY KEY);
      CREATE TABLE b (id SERIAL PRIMARY KEY, a_id INTEGER REFERENCES a(id));
    `;
    const diagram = parseSQLToDiagram(sql);

    const allIds = [
      diagram.id,
      ...diagram.tables.map((t) => t.id),
      ...diagram.tables.flatMap((t) => t.fields.map((f) => f.id)),
      ...diagram.relationships.map((r) => r.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
