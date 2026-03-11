import { describe, it, expect } from "vitest";
import { parseSQLDump } from "@/lib/dump/dump-parser";

describe("parseSQLDump", () => {
  it("parses a single INSERT statement", () => {
    const sql = `INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com');`;
    const tables = parseSQLDump(sql);

    expect(tables).toHaveLength(1);
    expect(tables[0]!.name).toBe("users");
    expect(tables[0]!.columns).toEqual(["id", "name", "email"]);
    expect(tables[0]!.rows).toHaveLength(1);
    expect(tables[0]!.rows[0]!.name).toBe("Alice");
    expect(tables[0]!.rows[0]!.id).toBe(1);
  });

  it("parses multi-row INSERT", () => {
    const sql = `INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie');`;
    const tables = parseSQLDump(sql);

    expect(tables[0]!.rows).toHaveLength(3);
    expect(tables[0]!.rows[1]!.name).toBe("Bob");
  });

  it("parses NULL values", () => {
    const sql = `INSERT INTO users (id, name) VALUES (1, NULL);`;
    const tables = parseSQLDump(sql);

    expect(tables[0]!.rows[0]!.name).toBeNull();
  });

  it("parses boolean values", () => {
    const sql = `INSERT INTO users (id, active) VALUES (1, TRUE);`;
    const tables = parseSQLDump(sql);

    expect(tables[0]!.rows[0]!.active).toBe(true);
  });

  it("handles multiple tables", () => {
    const sql = `
      INSERT INTO users (id, name) VALUES (1, 'Alice');
      INSERT INTO orders (id, user_id) VALUES (1, 1);
    `;
    const tables = parseSQLDump(sql);

    expect(tables).toHaveLength(2);
    expect(tables.map((t) => t.name).sort()).toEqual(["orders", "users"]);
  });

  it("throws for files exceeding size limit", () => {
    const largeSql = "x".repeat(6 * 1024 * 1024);
    expect(() => parseSQLDump(largeSql)).toThrow("too large");
  });

  it("returns empty array for no INSERT statements", () => {
    const sql = `CREATE TABLE users (id INT);`;
    const tables = parseSQLDump(sql);
    expect(tables).toHaveLength(0);
  });
});
