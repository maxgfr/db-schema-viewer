import { expect, it } from "vitest";
import { parseSQLWithType } from "../../src/sql/sql-import";
it.each(["a--b", "a/*b*/c"])("preserves comment-like text inside SQL literals: %s", (value) => {
  const diagram = parseSQLWithType(`CREATE TABLE example (id INT PRIMARY KEY, label TEXT DEFAULT '${value}');`, "postgresql");
  expect(diagram.tables).toHaveLength(1);
  expect(diagram.tables[0]!.fields.find((f) => f.name === "label")?.default).toContain(value);
});
