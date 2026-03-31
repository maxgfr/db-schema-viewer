import { describe, it, expect } from "vitest";
import { parseSQLDump } from "@/lib/dump/dump-parser";

describe("parseSQLDump edge cases", () => {
  it("handles Unicode characters in values (Japanese, emojis)", () => {
    const sql = `INSERT INTO messages (id, content, author) VALUES (1, '\u3053\u3093\u306b\u3061\u306f\u4e16\u754c', '\u592a\u90ce'), (2, 'Hello \ud83d\udc4b\ud83c\udf0d', 'Alice');`;
    const tables = parseSQLDump(sql);

    expect(tables).toHaveLength(1);
    expect(tables[0]!.rows).toHaveLength(2);
    expect(tables[0]!.rows[0]!.content).toBe("\u3053\u3093\u306b\u3061\u306f\u4e16\u754c");
    expect(tables[0]!.rows[0]!.author).toBe("\u592a\u90ce");
    expect(tables[0]!.rows[1]!.content).toBe("Hello \ud83d\udc4b\ud83c\udf0d");
  });

  it("handles NULL values mixed with other values", () => {
    const sql = `INSERT INTO users (id, name, email, phone) VALUES (1, 'Alice', 'alice@test.com', NULL), (2, NULL, NULL, '555-1234'), (3, 'Charlie', NULL, NULL);`;
    const tables = parseSQLDump(sql);

    expect(tables).toHaveLength(1);
    const rows = tables[0]!.rows;
    expect(rows).toHaveLength(3);

    expect(rows[0]!.name).toBe("Alice");
    expect(rows[0]!.phone).toBeNull();

    expect(rows[1]!.name).toBeNull();
    expect(rows[1]!.email).toBeNull();
    expect(rows[1]!.phone).toBe("555-1234");

    expect(rows[2]!.email).toBeNull();
    expect(rows[2]!.phone).toBeNull();
  });

  it("handles values with escaped quotes (SQL-style doubled single quotes)", () => {
    const sql = `INSERT INTO notes (id, text) VALUES (1, 'it\\'s a test'), (2, 'she said \\'hello\\'');`;
    const tables = parseSQLDump(sql);

    expect(tables).toHaveLength(1);
    expect(tables[0]!.rows).toHaveLength(2);
    expect(tables[0]!.rows[0]!.text).toBe("it's a test");
    expect(tables[0]!.rows[1]!.text).toBe("she said 'hello'");
  });

  it("handles multi-line INSERT statements", () => {
    const sql = `INSERT INTO products (id, name, price) VALUES
  (1, 'Widget', 9.99),
  (2, 'Gadget', 19.99),
  (3, 'Doohickey', 4.50);`;
    const tables = parseSQLDump(sql);

    expect(tables).toHaveLength(1);
    expect(tables[0]!.name).toBe("products");
    expect(tables[0]!.rows).toHaveLength(3);
    expect(tables[0]!.rows[0]!.name).toBe("Widget");
    expect(tables[0]!.rows[0]!.price).toBe(9.99);
    expect(tables[0]!.rows[2]!.name).toBe("Doohickey");
    expect(tables[0]!.rows[2]!.price).toBe(4.5);
  });

  it("does not crash on empty INSERT with no rows", () => {
    // Edge case: VALUES keyword present but no actual value tuples
    const sql = `INSERT INTO t (a) VALUES;`;
    // Should not throw
    expect(() => parseSQLDump(sql)).not.toThrow();
    const tables = parseSQLDump(sql);
    // Either returns empty array or a table with no rows
    if (tables.length > 0) {
      expect(tables[0]!.rows).toHaveLength(0);
    }
  });
});
