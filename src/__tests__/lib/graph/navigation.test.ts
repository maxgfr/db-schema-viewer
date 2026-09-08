import { expect, it } from "vitest";
import { parseSchemaFile } from "db-schema-toolkit";
import { filterDiagram, indexRelationships } from "@/lib/graph/navigation";
import { DEFAULT_FILTERS } from "@/lib/project/project";
const diagram = parseSchemaFile('CREATE TABLE users (id INT PRIMARY KEY); CREATE TABLE posts (id INT PRIMARY KEY, user_id INT REFERENCES users(id)); CREATE TABLE other (id INT PRIMARY KEY);');
it("isolates direct neighbours and removes dangling edges without changing the source", () => {
  const user = diagram.tables.find((t) => t.name === "users")!;
  const filtered = filterDiagram(diagram, { ...DEFAULT_FILTERS, focusTableId: user.id });
  expect(filtered.tables.map((t) => t.name).sort()).toEqual(["posts", "users"]);
  expect(filtered.relationships).toHaveLength(1);
  expect(diagram.tables).toHaveLength(3);
  expect(filterDiagram(diagram, { ...DEFAULT_FILTERS, search: "other" }).relationships).toEqual([]);
  expect(filterDiagram(diagram, DEFAULT_FILTERS)).toBe(diagram);
});
it("combines namespace and text filters, and matches field names", () => {
  const scoped = { ...diagram, tables: diagram.tables.map((t) => ({ ...t, schema: t.name === "posts" ? "blog" : "public" })) };
  expect(filterDiagram(scoped, { ...DEFAULT_FILTERS, namespace: "blog", search: "user_id" }).tables.map((t) => t.name)).toEqual(["posts"]);
  expect(filterDiagram(scoped, { ...DEFAULT_FILTERS, namespace: "public", search: "posts" }).tables).toEqual([]);
});
it("indexes self references once", () => {
  const rel = { id: "r", sourceTableId: "t", targetTableId: "t", sourceFieldId: "f", targetFieldId: "f", cardinality: "one-to-one" as const };
  expect(indexRelationships([rel]).get("t")).toEqual([rel]);
});
