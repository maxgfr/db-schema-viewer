import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { parseSchemaFile } from "../../src/parsing/parse-schema-file";
import { generateFakeData } from "../../src/dump/fake-data-generator";
import { inferColumnTypes } from "../../src/dump/data-types";
import { SAMPLE_SCHEMAS } from "../../src/sql/sample-schemas";
import { SCHEMA_TEMPLATES } from "../../src/sql/schema-templates";
import { EXAMPLE_SCHEMAS } from "../../src/examples/example-schemas";
import type { Diagram, DBTable } from "../../src/domain";
import type { ParsedDumpTable } from "../../src/dump/dump-parser";

// ── Helpers ────────────────────────────────────────────────────────

const EXAMPLES_DIR = resolve(__dirname, "../../../../examples");

function readExample(filename: string): string {
  return readFileSync(resolve(EXAMPLES_DIR, filename), "utf-8");
}

/** Run the full pipeline: parse schema → generate fake data → return both */
function parseAndGenerate(
  content: string,
  fileName?: string,
  rowCount = 20,
): { diagram: Diagram; data: ParsedDumpTable[] } {
  const diagram = parseSchemaFile(content, fileName);
  const data = generateFakeData(diagram.tables, diagram.relationships, {
    rowCount,
    seed: 42,
  });
  return { diagram, data };
}

/**
 * Core validation: every table in diagram (except views / empty) should have data,
 * with the right columns, right row count, and no crashes.
 */
function validateFakeData(diagram: Diagram, data: ParsedDumpTable[], rowCount: number) {
  const realTables = diagram.tables.filter((t) => !t.isView && t.fields.length > 0);

  // Every real table should have a corresponding data table
  expect(data.length).toBe(realTables.length);

  for (const dumpTable of data) {
    const schemaTable = realTables.find((t) => t.name === dumpTable.name);
    expect(schemaTable).toBeDefined();

    // Columns should be a subset of field names (deduplication may reduce count)
    const schemaFieldNames = new Set(schemaTable!.fields.map((f) => f.name));
    for (const col of dumpTable.columns) {
      expect(schemaFieldNames.has(col)).toBe(true);
    }
    // No duplicate columns in output
    expect(new Set(dumpTable.columns).size).toBe(dumpTable.columns.length);

    // Row count should match
    expect(dumpTable.rows).toHaveLength(rowCount);

    // Every row should have all columns present (including null values)
    for (const row of dumpTable.rows) {
      for (const col of dumpTable.columns) {
        expect(col in row).toBe(true);
      }
    }

    // Primary key fields should never be null
    for (const field of schemaTable!.fields) {
      if (field.primaryKey) {
        for (const row of dumpTable.rows) {
          expect(row[field.name]).not.toBeNull();
        }
      }
    }

    // Non-nullable, non-FK fields should rarely be null
    // (FK fields can be null due to self-ref handling)
    for (const field of schemaTable!.fields) {
      if (!field.nullable && !field.primaryKey) {
        const nullCount = dumpTable.rows.filter((r) => r[field.name] === null).length;
        // Allow a small tolerance for FK self-refs
        expect(nullCount).toBeLessThanOrEqual(Math.ceil(rowCount * 0.3));
      }
    }

    // Type inference should succeed (no crash, no all-null columns unless nullable)
    const columnTypes = inferColumnTypes(dumpTable.columns, dumpTable.rows);
    for (const col of dumpTable.columns) {
      expect(columnTypes[col]).toBeDefined();
    }
  }
}

/** Validate FK referential integrity: FK values should exist in referenced table */
function validateFKIntegrity(diagram: Diagram, data: ParsedDumpTable[]) {
  const dataByTableId = new Map<string, ParsedDumpTable>();
  for (const table of diagram.tables) {
    const d = data.find((dt) => dt.name === table.name);
    if (d) dataByTableId.set(table.id, d);
  }

  for (const rel of diagram.relationships) {
    const sourceData = dataByTableId.get(rel.sourceTableId);
    const targetData = dataByTableId.get(rel.targetTableId);
    if (!sourceData || !targetData) continue;

    const sourceTable = diagram.tables.find((t) => t.id === rel.sourceTableId);
    const targetTable = diagram.tables.find((t) => t.id === rel.targetTableId);
    if (!sourceTable || !targetTable) continue;

    const sourceField = sourceTable.fields.find((f) => f.id === rel.sourceFieldId);
    const targetField = targetTable.fields.find((f) => f.id === rel.targetFieldId);
    if (!sourceField || !targetField) continue;

    const validTargetValues = new Set(
      targetData.rows.map((r) => r[targetField.name]).filter((v) => v !== null),
    );

    for (const row of sourceData.rows) {
      const fkValue = row[sourceField.name];
      if (fkValue !== null) {
        expect(
          validTargetValues.has(fkValue),
          `FK violation: ${sourceTable.name}.${sourceField.name} = ${fkValue} not found in ${targetTable.name}.${targetField.name} (valid: ${[...validTargetValues].slice(0, 5).join(", ")}...)`,
        ).toBe(true);
      }
    }
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe("Fake data integration: SQL sample schemas", () => {
  for (const sample of SAMPLE_SCHEMAS) {
    describe(sample.name, () => {
      const { diagram, data } = parseAndGenerate(sample.sql);

      it("generates data for all tables", () => {
        validateFakeData(diagram, data, 20);
      });

      it("maintains FK referential integrity", () => {
        validateFKIntegrity(diagram, data);
      });

      it("is deterministic (same seed → same output)", () => {
        const data2 = generateFakeData(diagram.tables, diagram.relationships, {
          rowCount: 20,
          seed: 42,
        });
        expect(data).toEqual(data2);
      });
    });
  }
});

describe("Fake data integration: SQL schema templates", () => {
  for (const template of SCHEMA_TEMPLATES) {
    // Only test SQL templates (not ORM formats — those are tested separately)
    if (template.fileName && !template.fileName.endsWith(".sql")) continue;

    describe(template.name, () => {
      const { diagram, data } = parseAndGenerate(template.sql);

      it("generates data for all tables", () => {
        validateFakeData(diagram, data, 20);
      });

      it("maintains FK referential integrity", () => {
        validateFKIntegrity(diagram, data);
      });
    });
  }
});

describe("Fake data integration: example schema files", () => {
  describe("Drizzle ORM (schema.drizzle.ts)", () => {
    const content = readExample("schema.drizzle.ts");
    const { diagram, data } = parseAndGenerate(content, "schema.drizzle.ts");

    it("generates data for all 12 tables", () => {
      expect(data.length).toBe(12);
      validateFakeData(diagram, data, 20);
    });

    it("maintains FK referential integrity", () => {
      validateFKIntegrity(diagram, data);
    });

    it("generates realistic user data", () => {
      const users = data.find((t) => t.name === "users")!;
      for (const row of users.rows) {
        // Drizzle uses camelCase column names (email, isVerified, createdAt)
        if (row.email !== null) expect(String(row.email)).toContain("@");
        if (row.isVerified !== null) expect(typeof row.isVerified).toBe("boolean");
        if (row.createdAt !== null) expect(String(row.createdAt)).toMatch(/^\d{4}-/);
      }
    });
  });

  describe("Prisma (schema.prisma)", () => {
    const content = readExample("schema.prisma");
    const { diagram, data } = parseAndGenerate(content, "schema.prisma");

    it("generates data for all 12 tables", () => {
      expect(data.length).toBe(12);
      validateFakeData(diagram, data, 20);
    });

    it("maintains FK referential integrity", () => {
      validateFKIntegrity(diagram, data);
    });
  });

  describe("DBML (schema.dbml)", () => {
    const content = readExample("schema.dbml");
    const { diagram, data } = parseAndGenerate(content, "schema.dbml");

    it("generates data for all 12 tables", () => {
      expect(data.length).toBe(12);
      validateFakeData(diagram, data, 20);
    });

    it("maintains FK referential integrity", () => {
      validateFKIntegrity(diagram, data);
    });

    it("handles self-referential comments (parent_comment_id)", () => {
      const comments = data.find((t) => t.name === "comments")!;
      const commentIds = comments.rows.map((r) => r.id);

      // Some parent_comment_ids should be null (first row + random)
      const nullParents = comments.rows.filter((r) => r.parent_comment_id === null);
      expect(nullParents.length).toBeGreaterThan(0);

      // Non-null parent_comment_ids should reference valid comment IDs
      for (const row of comments.rows) {
        if (row.parent_comment_id !== null) {
          expect(commentIds).toContain(row.parent_comment_id);
        }
      }
    });
  });

  describe("TypeORM (schema.typeorm.ts)", () => {
    const content = readExample("schema.typeorm.ts");
    const { diagram, data } = parseAndGenerate(content, "schema.typeorm.ts");

    it("generates data for all tables", () => {
      validateFakeData(diagram, data, 20);
    });

    it("maintains FK referential integrity", () => {
      validateFKIntegrity(diagram, data);
    });
  });
});

describe("Fake data integration: EXAMPLE_SCHEMAS (from landing page)", () => {
  for (const example of EXAMPLE_SCHEMAS) {
    describe(`${example.name} (${example.category})`, () => {
      const { diagram, data } = parseAndGenerate(example.sql, example.fileName);

      it("generates data for all tables", () => {
        validateFakeData(diagram, data, 20);
      });

      it("maintains FK referential integrity", () => {
        validateFKIntegrity(diagram, data);
      });
    });
  }
});

describe("Fake data integration: edge cases", () => {
  it("handles MySQL ENUM types (values stripped by parser — uses name heuristic)", () => {
    const sql = `
      CREATE TABLE products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category ENUM('electronics', 'clothing', 'books', 'food', 'other') DEFAULT 'other'
      ) ENGINE=InnoDB;
    `;
    const { data } = parseAndGenerate(sql);
    const products = data[0]!;

    // node-sql-parser strips ENUM values, so the type is just "ENUM".
    // The "category" field name heuristic kicks in → faker.commerce.department()
    for (const row of products.rows) {
      if (row.category !== null) {
        expect(typeof row.category).toBe("string");
        expect(String(row.category).length).toBeGreaterThan(0);
      }
    }
  });

  it("handles ENUM type with values preserved in type string", () => {
    // Simulate what some parsers produce when they DO preserve enum values
    const tables: DBTable[] = [
      {
        id: "t1", name: "tickets", isView: false, x: 0, y: 0, indexes: [],
        fields: [
          { id: "f1", name: "id", type: "INT", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
          { id: "f2", name: "priority", type: "ENUM(low,medium,high,critical)", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
        ],
      },
    ];
    const result = generateFakeData(tables, [], { rowCount: 20, seed: 42 });
    const validValues = ["low", "medium", "high", "critical"];
    for (const row of result[0]!.rows) {
      if (row.priority !== null) {
        expect(validValues).toContain(row.priority);
      }
    }
  });

  it("handles UUID primary keys (SaaS schema)", () => {
    const saas = SAMPLE_SCHEMAS.find((s) => s.name === "SaaS App")!;
    const { diagram, data } = parseAndGenerate(saas.sql);

    // organizations and users should have UUID PKs
    const orgs = data.find((t) => t.name === "organizations")!;
    for (const row of orgs.rows) {
      expect(row.id).toBeDefined();
      expect(typeof row.id).toBe("string");
      // UUID format
      expect(String(row.id)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }

    // FK to UUID PKs should still work
    validateFKIntegrity(diagram, data);
  });

  it("handles self-referential categories (parent_id → id)", () => {
    const ecommerce = SAMPLE_SCHEMAS.find((s) => s.name === "E-commerce")!;
    const { data } = parseAndGenerate(ecommerce.sql);

    const categories = data.find((t) => t.name === "categories")!;
    const catIds = categories.rows.map((r) => r.id);

    // Some should have null parent (root categories)
    const nullParents = categories.rows.filter((r) => r.parent_id === null);
    expect(nullParents.length).toBeGreaterThan(0);

    // Non-null parent_ids should reference valid category IDs
    for (const row of categories.rows) {
      if (row.parent_id !== null) {
        expect(catIds).toContain(row.parent_id);
      }
    }
  });

  it("handles composite primary keys (blog post_tags)", () => {
    const blog = SAMPLE_SCHEMAS.find((s) => s.name === "Blog Platform")!;
    const { diagram, data } = parseAndGenerate(blog.sql);

    const postTags = data.find((t) => t.name === "post_tags")!;
    const postIds = data.find((t) => t.name === "posts")!.rows.map((r) => r.id);
    const tagIds = data.find((t) => t.name === "tags")!.rows.map((r) => r.id);

    // post_tags should reference valid post and tag IDs
    for (const row of postTags.rows) {
      if (row.post_id !== null) expect(postIds).toContain(row.post_id);
      if (row.tag_id !== null) expect(tagIds).toContain(row.tag_id);
    }

    validateFKIntegrity(diagram, data);
  });

  it("handles self-referential comments in blog", () => {
    const blog = SAMPLE_SCHEMAS.find((s) => s.name === "Blog Platform")!;
    const { data } = parseAndGenerate(blog.sql);

    const comments = data.find((t) => t.name === "comments")!;
    const commentIds = comments.rows.map((r) => r.id);

    for (const row of comments.rows) {
      if (row.parent_id !== null) {
        expect(commentIds).toContain(row.parent_id);
      }
    }
  });

  it("handles JSONB columns (SaaS audit_logs)", () => {
    const saas = SAMPLE_SCHEMAS.find((s) => s.name === "SaaS App")!;
    const { data } = parseAndGenerate(saas.sql);

    const auditLogs = data.find((t) => t.name === "audit_logs")!;
    for (const row of auditLogs.rows) {
      if (row.metadata !== null) {
        expect(() => JSON.parse(String(row.metadata))).not.toThrow();
      }
    }
  });

  it("handles SQLite-style types (TEXT, INTEGER)", () => {
    const sqlite = SAMPLE_SCHEMAS.find((s) => s.name === "SQLite Tasks")!;
    const { diagram, data } = parseAndGenerate(sqlite.sql);

    validateFakeData(diagram, data, 20);
    validateFKIntegrity(diagram, data);

    // Tasks should have integer priorities
    const tasks = data.find((t) => t.name === "tasks")!;
    for (const row of tasks.rows) {
      if (row.priority !== null) {
        expect(typeof row.priority).toBe("number");
      }
    }
  });

  it("generates different data with different seeds", () => {
    const sql = `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100), email VARCHAR(255));`;
    const diagram = parseSchemaFile(sql);

    const data1 = generateFakeData(diagram.tables, diagram.relationships, { seed: 1, rowCount: 10 });
    const data2 = generateFakeData(diagram.tables, diagram.relationships, { seed: 2, rowCount: 10 });

    const names1 = data1[0]!.rows.map((r) => r.name);
    const names2 = data2[0]!.rows.map((r) => r.name);
    expect(names1).not.toEqual(names2);
  });

  it("handles large row counts without crashing", () => {
    const sql = `CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(255), price DECIMAL(10,2));`;
    const { data } = parseAndGenerate(sql, undefined, 500);
    expect(data[0]!.rows).toHaveLength(500);
  });

  it("inferred types from generated data are sensible", () => {
    const sql = `
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        stock INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    const { data } = parseAndGenerate(sql);
    const products = data[0]!;
    const types = inferColumnTypes(products.columns, products.rows);

    expect(types.id).toBe("number");
    expect(types.name).toBe("string");
    expect(types.price).toBe("number");
    expect(types.stock).toBe("number");
    expect(types.is_active).toBe("boolean");
    expect(types.created_at).toBe("date");
  });
});
