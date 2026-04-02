import { describe, it, expect } from "vitest";
import { diffSchemas } from "../../src/analysis/schema-diff";
import type {
  Diagram,
  DBTable,
  DBField,
  DBIndex,
  DBRelationship,
} from "../../src/domain";
import { generateId } from "../../src/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeField(
  overrides: Partial<DBField> & { name: string; type: string },
): DBField {
  return {
    id: generateId(),
    primaryKey: false,
    unique: false,
    nullable: true,
    isForeignKey: false,
    ...overrides,
  };
}

function makeIndex(
  name: string,
  columns: string[],
  unique = false,
): DBIndex {
  return { id: generateId(), name, columns, unique };
}

function makeTable(
  name: string,
  fields: DBField[],
  overrides?: Partial<DBTable>,
): DBTable {
  return {
    id: generateId(),
    name,
    fields,
    indexes: [],
    x: 0,
    y: 0,
    isView: false,
    ...overrides,
  };
}

function makeDiagram(
  tables: DBTable[],
  relationships: DBRelationship[] = [],
): Diagram {
  return {
    id: generateId(),
    name: "Test Schema",
    databaseType: "postgresql",
    tables,
    relationships,
    createdAt: new Date().toISOString(),
  };
}

function makeRelationship(
  sourceTable: DBTable,
  sourceFieldIndex: number,
  targetTable: DBTable,
  targetFieldIndex: number,
  cardinality: "one-to-one" | "one-to-many" | "many-to-many" = "one-to-many",
): DBRelationship {
  return {
    id: generateId(),
    sourceTableId: sourceTable.id,
    sourceFieldId: sourceTable.fields[sourceFieldIndex]!.id,
    targetTableId: targetTable.id,
    targetFieldId: targetTable.fields[targetFieldIndex]!.id,
    cardinality,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("diffSchemas", () => {
  it("returns empty diff for identical schemas", () => {
    const users = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
    ]);

    const before = makeDiagram([users]);
    const after = makeDiagram([users]);

    const diff = diffSchemas(before, after);

    expect(diff.addedTables).toEqual([]);
    expect(diff.removedTables).toEqual([]);
    expect(diff.modifiedTables).toEqual([]);
    expect(diff.addedRelationships).toEqual([]);
    expect(diff.removedRelationships).toEqual([]);
    expect(diff.summary).toBe("No changes detected");
  });

  it("detects an added table", () => {
    const users = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);
    const posts = makeTable("posts", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "title", type: "TEXT" }),
    ]);

    const before = makeDiagram([users]);
    const after = makeDiagram([users, posts]);

    const diff = diffSchemas(before, after);

    expect(diff.addedTables).toEqual(["posts"]);
    expect(diff.removedTables).toEqual([]);
    expect(diff.modifiedTables).toEqual([]);
  });

  it("detects a removed table", () => {
    const users = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);
    const sessions = makeTable("sessions", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);

    const before = makeDiagram([users, sessions]);
    const after = makeDiagram([users]);

    const diff = diffSchemas(before, after);

    expect(diff.addedTables).toEqual([]);
    expect(diff.removedTables).toEqual(["sessions"]);
  });

  it("detects an added field to an existing table", () => {
    const usersBefore = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);
    const usersAfter = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
    ]);

    const before = makeDiagram([usersBefore]);
    const after = makeDiagram([usersAfter]);

    const diff = diffSchemas(before, after);

    expect(diff.addedTables).toEqual([]);
    expect(diff.modifiedTables).toHaveLength(1);
    expect(diff.modifiedTables[0]!.tableName).toBe("users");
    expect(diff.modifiedTables[0]!.addedFields).toEqual(["email"]);
    expect(diff.modifiedTables[0]!.removedFields).toEqual([]);
    expect(diff.modifiedTables[0]!.modifiedFields).toEqual([]);
  });

  it("detects a removed field from an existing table", () => {
    const usersBefore = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
      makeField({ name: "legacy_column", type: "TEXT" }),
    ]);
    const usersAfter = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
    ]);

    const before = makeDiagram([usersBefore]);
    const after = makeDiagram([usersAfter]);

    const diff = diffSchemas(before, after);

    expect(diff.modifiedTables).toHaveLength(1);
    expect(diff.modifiedTables[0]!.removedFields).toEqual(["legacy_column"]);
    expect(diff.modifiedTables[0]!.addedFields).toEqual([]);
  });

  it("detects a modified field type", () => {
    const usersBefore = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "age", type: "INTEGER" }),
    ]);
    const usersAfter = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "age", type: "BIGINT" }),
    ]);

    const before = makeDiagram([usersBefore]);
    const after = makeDiagram([usersAfter]);

    const diff = diffSchemas(before, after);

    expect(diff.modifiedTables).toHaveLength(1);
    const tableDiff = diff.modifiedTables[0]!;
    expect(tableDiff.modifiedFields).toHaveLength(1);
    expect(tableDiff.modifiedFields[0]!.fieldName).toBe("age");
    expect(tableDiff.modifiedFields[0]!.changes).toEqual([
      { property: "type", oldValue: "INTEGER", newValue: "BIGINT" },
    ]);
  });

  it("detects a modified field nullable", () => {
    const usersBefore = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)", nullable: true }),
    ]);
    const usersAfter = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)", nullable: false }),
    ]);

    const before = makeDiagram([usersBefore]);
    const after = makeDiagram([usersAfter]);

    const diff = diffSchemas(before, after);

    expect(diff.modifiedTables).toHaveLength(1);
    const fieldDiff = diff.modifiedTables[0]!.modifiedFields[0]!;
    expect(fieldDiff.fieldName).toBe("email");
    expect(fieldDiff.changes).toEqual([
      { property: "nullable", oldValue: "true", newValue: "false" },
    ]);
  });

  it("detects an added relationship", () => {
    const users = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);
    const posts = makeTable("posts", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "user_id", type: "INTEGER", isForeignKey: true }),
    ]);

    const rel = makeRelationship(posts, 1, users, 0, "one-to-many");

    const before = makeDiagram([users, posts]);
    const after = makeDiagram([users, posts], [rel]);

    const diff = diffSchemas(before, after);

    expect(diff.addedRelationships).toHaveLength(1);
    expect(diff.addedRelationships[0]).toEqual({
      sourceTable: "posts",
      sourceField: "user_id",
      targetTable: "users",
      targetField: "id",
      cardinality: "one-to-many",
    });
    expect(diff.removedRelationships).toEqual([]);
  });

  it("detects a removed relationship", () => {
    const users = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);
    const posts = makeTable("posts", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "user_id", type: "INTEGER", isForeignKey: true }),
    ]);

    const rel = makeRelationship(posts, 1, users, 0, "one-to-many");

    const before = makeDiagram([users, posts], [rel]);
    const after = makeDiagram([users, posts]);

    const diff = diffSchemas(before, after);

    expect(diff.removedRelationships).toHaveLength(1);
    expect(diff.removedRelationships[0]).toEqual({
      sourceTable: "posts",
      sourceField: "user_id",
      targetTable: "users",
      targetField: "id",
      cardinality: "one-to-many",
    });
    expect(diff.addedRelationships).toEqual([]);
  });

  it("handles complex diff with multiple changes", () => {
    // Before: users, posts, comments
    const usersBefore = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
      makeField({ name: "legacy", type: "TEXT" }),
    ]);
    const postsBefore = makeTable("posts", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "title", type: "VARCHAR(200)" }),
      makeField({ name: "user_id", type: "INTEGER", isForeignKey: true }),
    ]);
    const commentsBefore = makeTable("comments", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "body", type: "TEXT" }),
    ]);

    const relBefore = makeRelationship(postsBefore, 2, usersBefore, 0);

    // After: users (modified), posts (modified), tags (added), comments (removed)
    const usersAfter = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)", nullable: false }),
      makeField({ name: "username", type: "VARCHAR(100)" }),
      // "legacy" removed
    ]);
    const postsAfter = makeTable("posts", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "title", type: "TEXT" }), // type changed
      makeField({ name: "user_id", type: "INTEGER", isForeignKey: true }),
    ]);
    const tagsAfter = makeTable("tags", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "name", type: "VARCHAR(50)" }),
    ]);

    const relAfter = makeRelationship(postsAfter, 2, usersAfter, 0);

    const before = makeDiagram(
      [usersBefore, postsBefore, commentsBefore],
      [relBefore],
    );
    const after = makeDiagram(
      [usersAfter, postsAfter, tagsAfter],
      [relAfter],
    );

    const diff = diffSchemas(before, after);

    expect(diff.addedTables).toEqual(["tags"]);
    expect(diff.removedTables).toEqual(["comments"]);
    expect(diff.modifiedTables).toHaveLength(2);

    const usersDiff = diff.modifiedTables.find((t) => t.tableName === "users")!;
    expect(usersDiff.addedFields).toEqual(["username"]);
    expect(usersDiff.removedFields).toEqual(["legacy"]);
    expect(usersDiff.modifiedFields).toHaveLength(1);
    expect(usersDiff.modifiedFields[0]!.fieldName).toBe("email");

    const postsDiff = diff.modifiedTables.find((t) => t.tableName === "posts")!;
    expect(postsDiff.modifiedFields).toHaveLength(1);
    expect(postsDiff.modifiedFields[0]!.fieldName).toBe("title");
    expect(postsDiff.modifiedFields[0]!.changes).toEqual([
      { property: "type", oldValue: "VARCHAR(200)", newValue: "TEXT" },
    ]);
  });

  it("generates correct summary text", () => {
    // Simple: add 2 tables, remove 1, modify 1 with 3 field changes
    const tableBefore = makeTable("existing", [
      makeField({ name: "id", type: "SERIAL" }),
      makeField({ name: "a", type: "INTEGER" }),
      makeField({ name: "b", type: "TEXT" }),
      makeField({ name: "old_col", type: "TEXT" }),
    ]);
    const removedTable = makeTable("old_table", [
      makeField({ name: "id", type: "SERIAL" }),
    ]);

    const tableAfter = makeTable("existing", [
      makeField({ name: "id", type: "SERIAL" }),
      makeField({ name: "a", type: "BIGINT" }), // modified
      makeField({ name: "b", type: "TEXT", nullable: false }), // modified
      // old_col removed
      makeField({ name: "new_col", type: "VARCHAR(100)" }), // added
    ]);
    const addedTable1 = makeTable("new_table_1", [
      makeField({ name: "id", type: "SERIAL" }),
    ]);
    const addedTable2 = makeTable("new_table_2", [
      makeField({ name: "id", type: "SERIAL" }),
    ]);

    const before = makeDiagram([tableBefore, removedTable]);
    const after = makeDiagram([tableAfter, addedTable1, addedTable2]);

    const diff = diffSchemas(before, after);

    // 2 added tables, 1 removed, 1 modified table with 4 field changes
    // (1 added field + 1 removed field + 2 modified fields = 4)
    expect(diff.summary).toBe(
      "Added 2 tables, removed 1 table, modified 1 table (4 field changes)",
    );
  });

  it("matches tables case-insensitively", () => {
    const usersBefore = makeTable("Users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);
    const usersAfter = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
    ]);

    const before = makeDiagram([usersBefore]);
    const after = makeDiagram([usersAfter]);

    const diff = diffSchemas(before, after);

    // Should match as the same table, not added/removed
    expect(diff.addedTables).toEqual([]);
    expect(diff.removedTables).toEqual([]);
    expect(diff.modifiedTables).toHaveLength(1);
    expect(diff.modifiedTables[0]!.addedFields).toEqual(["email"]);
  });

  it("detects added and removed indexes", () => {
    const tableBefore = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
      makeField({ name: "username", type: "VARCHAR(100)" }),
    ], {
      indexes: [
        makeIndex("idx_email", ["email"], true),
      ],
    });

    const tableAfter = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
      makeField({ name: "username", type: "VARCHAR(100)" }),
    ], {
      indexes: [
        makeIndex("idx_username", ["username"], false),
      ],
    });

    const before = makeDiagram([tableBefore]);
    const after = makeDiagram([tableAfter]);

    const diff = diffSchemas(before, after);

    expect(diff.modifiedTables).toHaveLength(1);
    const td = diff.modifiedTables[0]!;
    expect(td.removedIndexes).toEqual(["idx_email"]);
    expect(td.addedIndexes).toEqual(["idx_username"]);
  });

  it("detects multiple field property changes at once", () => {
    const tableBefore = makeTable("items", [
      makeField({
        name: "id",
        type: "SERIAL",
        primaryKey: true,
      }),
      makeField({
        name: "price",
        type: "DECIMAL(10,2)",
        nullable: true,
        unique: false,
        default: "0.00",
      }),
    ]);
    const tableAfter = makeTable("items", [
      makeField({
        name: "id",
        type: "SERIAL",
        primaryKey: true,
      }),
      makeField({
        name: "price",
        type: "NUMERIC(12,4)",
        nullable: false,
        unique: true,
        default: "0.0000",
      }),
    ]);

    const before = makeDiagram([tableBefore]);
    const after = makeDiagram([tableAfter]);

    const diff = diffSchemas(before, after);

    expect(diff.modifiedTables).toHaveLength(1);
    const fieldDiff = diff.modifiedTables[0]!.modifiedFields[0]!;
    expect(fieldDiff.fieldName).toBe("price");

    const changeProps = fieldDiff.changes.map((c) => c.property).sort();
    expect(changeProps).toEqual(["default", "nullable", "type", "unique"]);
  });

  it("includes relationship changes in summary", () => {
    const users = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);
    const posts = makeTable("posts", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "user_id", type: "INTEGER", isForeignKey: true }),
    ]);

    const rel = makeRelationship(posts, 1, users, 0);

    const before = makeDiagram([users, posts]);
    const after = makeDiagram([users, posts], [rel]);

    const diff = diffSchemas(before, after);

    expect(diff.summary).toContain("1 relationship");
  });
});
