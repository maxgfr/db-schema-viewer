import { describe, it, expect } from "vitest";
import { generateFakeData } from "@/lib/dump/fake-data-generator";
import type { DBTable, DBField, DBRelationship } from "@/lib/domain";

function makeField(
  id: string,
  name: string,
  type: string,
  opts: Partial<{
    primaryKey: boolean;
    nullable: boolean;
    isForeignKey: boolean;
    unique: boolean;
    references: { table: string; field: string };
  }> = {},
): DBField {
  return {
    id,
    name,
    type,
    primaryKey: opts.primaryKey ?? false,
    unique: opts.unique ?? false,
    nullable: opts.nullable ?? true,
    isForeignKey: opts.isForeignKey ?? false,
    references: opts.references,
  };
}

function makeTable(id: string, name: string, fields: DBField[]): DBTable {
  return { id, name, fields, indexes: [], x: 0, y: 0, isView: false };
}

describe("generateFakeData", () => {
  it("generates data for a simple table", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INTEGER", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR(255)"),
        makeField("f3", "email", "VARCHAR(255)"),
      ]),
    ];

    const result = generateFakeData(tables, []);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("users");
    expect(result[0]!.columns).toEqual(["id", "name", "email"]);
    expect(result[0]!.rows).toHaveLength(30); // default row count
  });

  it("respects custom row count", () => {
    const tables: DBTable[] = [
      makeTable("t1", "items", [
        makeField("f1", "id", "INT", { primaryKey: true }),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 10 });
    expect(result[0]!.rows).toHaveLength(10);
  });

  it("generates sequential primary keys for integer PKs", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 5 });
    const ids = result[0]!.rows.map((r) => r.id);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  it("generates UUIDs for UUID primary keys", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "UUID", { primaryKey: true }),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 3 });
    for (const row of result[0]!.rows) {
      expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it("generates emails for email fields", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "email", "VARCHAR(255)"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 5 });
    for (const row of result[0]!.rows) {
      if (row.email !== null) {
        expect(String(row.email)).toMatch(/@/);
      }
    }
  });

  it("generates booleans for boolean-prefixed fields", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "is_active", "BOOLEAN"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 10 });
    for (const row of result[0]!.rows) {
      if (row.is_active !== null) {
        expect(typeof row.is_active).toBe("boolean");
      }
    }
  });

  it("generates dates for timestamp fields", () => {
    const tables: DBTable[] = [
      makeTable("t1", "events", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "created_at", "TIMESTAMP"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 5 });
    for (const row of result[0]!.rows) {
      if (row.created_at !== null) {
        expect(typeof row.created_at).toBe("string");
        expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
    }
  });

  it("handles FK relationships — picks values from referenced table", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR"),
      ]),
      makeTable("t2", "orders", [
        makeField("f3", "id", "INT", { primaryKey: true }),
        makeField("f4", "user_id", "INT", { isForeignKey: true }),
        makeField("f5", "total", "DECIMAL"),
      ]),
    ];

    const relationships: DBRelationship[] = [
      {
        id: "r1",
        sourceTableId: "t2",
        sourceFieldId: "f4",
        targetTableId: "t1",
        targetFieldId: "f1",
        cardinality: "one-to-many",
      },
    ];

    const result = generateFakeData(tables, relationships, { rowCount: 10 });

    // user IDs should be 1..10
    const userIds = result.find((t) => t.name === "users")!.rows.map((r) => r.id);
    expect(userIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // order user_id values should all be valid user IDs
    const orderUserIds = result.find((t) => t.name === "orders")!.rows.map((r) => r.user_id);
    for (const uid of orderUserIds) {
      if (uid !== null) {
        expect(userIds).toContain(uid);
      }
    }
  });

  it("generates multiple tables", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
      ]),
      makeTable("t2", "posts", [
        makeField("f2", "id", "INT", { primaryKey: true }),
        makeField("f3", "title", "VARCHAR"),
      ]),
      makeTable("t3", "comments", [
        makeField("f4", "id", "INT", { primaryKey: true }),
        makeField("f5", "body", "TEXT"),
      ]),
    ];

    const result = generateFakeData(tables, []);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.name).sort()).toEqual(["comments", "posts", "users"]);
  });

  it("is deterministic with the same seed", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR"),
        makeField("f3", "email", "VARCHAR"),
      ]),
    ];

    const result1 = generateFakeData(tables, [], { seed: 123 });
    const result2 = generateFakeData(tables, [], { seed: 123 });

    expect(result1[0]!.rows).toEqual(result2[0]!.rows);
  });

  it("produces different data with different seeds", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR"),
      ]),
    ];

    const result1 = generateFakeData(tables, [], { seed: 1 });
    const result2 = generateFakeData(tables, [], { seed: 2 });

    // Names should differ (the IDs will be the same since they're sequential)
    const names1 = result1[0]!.rows.map((r) => r.name);
    const names2 = result2[0]!.rows.map((r) => r.name);
    expect(names1).not.toEqual(names2);
  });

  it("generates prices for price fields", () => {
    const tables: DBTable[] = [
      makeTable("t1", "products", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "price", "DECIMAL(10,2)"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 5 });
    for (const row of result[0]!.rows) {
      if (row.price !== null) {
        expect(typeof row.price).toBe("number");
        expect(row.price as number).toBeGreaterThan(0);
      }
    }
  });

  it("handles empty tables array", () => {
    const result = generateFakeData([], []);
    expect(result).toEqual([]);
  });

  it("generates status values for status fields", () => {
    const tables: DBTable[] = [
      makeTable("t1", "orders", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "status", "VARCHAR"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 10 });
    const validStatuses = ["active", "inactive", "pending", "archived", "draft"];
    for (const row of result[0]!.rows) {
      if (row.status !== null) {
        expect(validStatuses).toContain(row.status);
      }
    }
  });

  // ── New edge case tests ──────────────────────────────────────────

  it("skips views (isView: true)", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
      ]),
      { ...makeTable("t2", "user_stats", [
        makeField("f2", "user_id", "INT"),
        makeField("f3", "post_count", "INT"),
      ]), isView: true },
    ];

    const result = generateFakeData(tables, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("users");
  });

  it("skips tables with 0 fields", () => {
    const tables: DBTable[] = [
      makeTable("t1", "empty_table", []),
      makeTable("t2", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
      ]),
    ];

    const result = generateFakeData(tables, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("users");
  });

  it("handles self-referential FK (e.g. manager_id → id on same table)", () => {
    const tables: DBTable[] = [
      makeTable("t1", "employees", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR"),
        makeField("f3", "manager_id", "INT", { isForeignKey: true, nullable: true }),
      ]),
    ];

    const relationships: DBRelationship[] = [
      {
        id: "r1",
        sourceTableId: "t1",
        sourceFieldId: "f3",
        targetTableId: "t1",
        targetFieldId: "f1",
        cardinality: "one-to-many",
      },
    ];

    const result = generateFakeData(tables, relationships, { rowCount: 10 });
    const employees = result[0]!;
    const validIds = employees.rows.map((r) => r.id);

    // First row should have null manager (no parent exists yet) or a valid ID
    // All non-null manager_ids should reference valid employee IDs
    for (const row of employees.rows) {
      if (row.manager_id !== null) {
        expect(validIds).toContain(row.manager_id);
      }
    }

    // At least some should be null (first row + 20% chance)
    const nullCount = employees.rows.filter((r) => r.manager_id === null).length;
    expect(nullCount).toBeGreaterThan(0);
  });

  it("handles junction table with composite PK + FK", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
      ]),
      makeTable("t2", "roles", [
        makeField("f2", "id", "INT", { primaryKey: true }),
      ]),
      makeTable("t3", "user_roles", [
        makeField("f3", "user_id", "INT", { primaryKey: true, isForeignKey: true }),
        makeField("f4", "role_id", "INT", { primaryKey: true, isForeignKey: true }),
      ]),
    ];

    const relationships: DBRelationship[] = [
      {
        id: "r1",
        sourceTableId: "t3",
        sourceFieldId: "f3",
        targetTableId: "t1",
        targetFieldId: "f1",
        cardinality: "one-to-many",
      },
      {
        id: "r2",
        sourceTableId: "t3",
        sourceFieldId: "f4",
        targetTableId: "t2",
        targetFieldId: "f2",
        cardinality: "one-to-many",
      },
    ];

    const result = generateFakeData(tables, relationships, { rowCount: 5 });
    const userIds = result.find((t) => t.name === "users")!.rows.map((r) => r.id);
    const roleIds = result.find((t) => t.name === "roles")!.rows.map((r) => r.id);
    const userRoles = result.find((t) => t.name === "user_roles")!;

    // user_roles should reference valid user and role IDs (NOT sequential 1,2,3...)
    for (const row of userRoles.rows) {
      expect(userIds).toContain(row.user_id);
      expect(roleIds).toContain(row.role_id);
    }
  });

  it("enforces unique constraint on unique fields", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "email", "VARCHAR", { unique: true }),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 20 });
    const emails = result[0]!.rows
      .map((r) => r.email)
      .filter((e) => e !== null);

    // All non-null emails should be unique
    const uniqueEmails = new Set(emails);
    expect(uniqueEmails.size).toBe(emails.length);
  });

  it("handles field.references as FK fallback (no explicit relationship)", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR"),
      ]),
      makeTable("t2", "posts", [
        makeField("f3", "id", "INT", { primaryKey: true }),
        makeField("f4", "author_id", "INT", {
          isForeignKey: true,
          references: { table: "users", field: "id" },
        }),
      ]),
    ];

    // No relationships array — only field.references
    const result = generateFakeData(tables, [], { rowCount: 10 });
    const userIds = result.find((t) => t.name === "users")!.rows.map((r) => r.id);
    const posts = result.find((t) => t.name === "posts")!;

    for (const row of posts.rows) {
      if (row.author_id !== null) {
        expect(userIds).toContain(row.author_id);
      }
    }
  });

  it("generates enum values for ENUM types", () => {
    const tables: DBTable[] = [
      makeTable("t1", "tickets", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "priority", "ENUM(low,medium,high,critical)"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 20 });
    const validValues = ["low", "medium", "high", "critical"];
    for (const row of result[0]!.rows) {
      if (row.priority !== null) {
        expect(validValues).toContain(row.priority);
      }
    }
  });

  it("generates hex for binary/bytea types", () => {
    const tables: DBTable[] = [
      makeTable("t1", "files", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "content_hash", "BYTEA"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 5 });
    for (const row of result[0]!.rows) {
      if (row.content_hash !== null) {
        expect(row.content_hash).toMatch(/^\\x[0-9a-fA-F]+$/);
      }
    }
  });

  it("handles circular dependencies between tables", () => {
    // A → B → A (circular)
    const tables: DBTable[] = [
      makeTable("t1", "departments", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "head_employee_id", "INT", { isForeignKey: true }),
      ]),
      makeTable("t2", "employees", [
        makeField("f3", "id", "INT", { primaryKey: true }),
        makeField("f4", "department_id", "INT", { isForeignKey: true }),
      ]),
    ];

    const relationships: DBRelationship[] = [
      {
        id: "r1",
        sourceTableId: "t1",
        sourceFieldId: "f2",
        targetTableId: "t2",
        targetFieldId: "f3",
        cardinality: "one-to-many",
      },
      {
        id: "r2",
        sourceTableId: "t2",
        sourceFieldId: "f4",
        targetTableId: "t1",
        targetFieldId: "f1",
        cardinality: "one-to-many",
      },
    ];

    // Should not throw — gracefully handles circular deps
    const result = generateFakeData(tables, relationships, { rowCount: 5 });
    expect(result).toHaveLength(2);
    expect(result[0]!.rows).toHaveLength(5);
    expect(result[1]!.rows).toHaveLength(5);
  });

  it("handles Prisma-style types (String, Int, DateTime)", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INTEGER", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR"),
        makeField("f3", "age", "INTEGER"),
        makeField("f4", "balance", "FLOAT"),
        makeField("f5", "active", "BOOLEAN"),
        makeField("f6", "created_at", "TIMESTAMP"),
        makeField("f7", "metadata", "JSON"),
      ]),
    ];

    const result = generateFakeData(tables, [], { rowCount: 5 });
    const row = result[0]!.rows[0]!;

    expect(typeof row.id).toBe("number");
    if (row.name !== null) expect(typeof row.name).toBe("string");
    if (row.age !== null) expect(typeof row.age).toBe("number");
    if (row.balance !== null) expect(typeof row.balance).toBe("number");
    if (row.active !== null) expect(typeof row.active).toBe("boolean");
    if (row.created_at !== null) expect(typeof row.created_at).toBe("string");
    if (row.metadata !== null) {
      expect(() => JSON.parse(row.metadata as string)).not.toThrow();
    }
  });

  it("does not null-out non-nullable FK fields", () => {
    const tables: DBTable[] = [
      makeTable("t1", "users", [
        makeField("f1", "id", "INT", { primaryKey: true }),
      ]),
      makeTable("t2", "posts", [
        makeField("f2", "id", "INT", { primaryKey: true }),
        makeField("f3", "user_id", "INT", { isForeignKey: true, nullable: false }),
      ]),
    ];

    const relationships: DBRelationship[] = [
      {
        id: "r1",
        sourceTableId: "t2",
        sourceFieldId: "f3",
        targetTableId: "t1",
        targetFieldId: "f1",
        cardinality: "one-to-many",
      },
    ];

    const result = generateFakeData(tables, relationships, { rowCount: 50 });
    const posts = result.find((t) => t.name === "posts")!;

    // No null user_ids — field is not nullable
    for (const row of posts.rows) {
      expect(row.user_id).not.toBeNull();
    }
  });

  it("FK values never pick nulls from referenced table (non-nullable FK)", () => {
    // The referenced table has a nullable column that can produce nulls.
    // When the FK picks from those values, it must filter out nulls.
    const tables: DBTable[] = [
      makeTable("t1", "categories", [
        makeField("f1", "id", "INT", { primaryKey: true }),
        makeField("f2", "name", "VARCHAR", { nullable: true }), // can be null
      ]),
      makeTable("t2", "products", [
        makeField("f3", "id", "INT", { primaryKey: true }),
        makeField("f4", "category_id", "INT", { isForeignKey: true, nullable: false }),
      ]),
    ];

    const relationships: DBRelationship[] = [
      {
        id: "r1",
        sourceTableId: "t2",
        sourceFieldId: "f4",
        targetTableId: "t1",
        targetFieldId: "f1",
        cardinality: "one-to-many",
      },
    ];

    // Run many times to stress-test
    const result = generateFakeData(tables, relationships, { rowCount: 100 });
    const products = result.find((t) => t.name === "products")!;

    for (const row of products.rows) {
      expect(row.category_id).not.toBeNull();
    }
  });

  it("handles large schema without crashing", () => {
    const tables: DBTable[] = [];
    for (let t = 0; t < 20; t++) {
      const fields: DBField[] = [
        makeField(`f${t}_0`, "id", "INT", { primaryKey: true }),
      ];
      for (let f = 1; f <= 10; f++) {
        fields.push(makeField(`f${t}_${f}`, `col_${f}`, "VARCHAR"));
      }
      tables.push(makeTable(`t${t}`, `table_${t}`, fields));
    }

    const result = generateFakeData(tables, [], { rowCount: 100 });
    expect(result).toHaveLength(20);
    expect(result[0]!.rows).toHaveLength(100);
  });
});
