import { describe, it, expect } from "vitest";
import {
  analyzeSchema,
  computeMetrics,
  detectAntiPatterns,
  computeQualityScore,
} from "@/lib/analysis/schema-analyzer";
import type { Diagram, DBTable, DBField, DBRelationship } from "@/lib/domain";
import { generateId } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<DBField> & { name: string; type: string }): DBField {
  return {
    id: generateId(),
    primaryKey: false,
    unique: false,
    nullable: true,
    isForeignKey: false,
    ...overrides,
  };
}

function makeTable(
  name: string,
  fields: DBField[],
  overrides?: Partial<DBTable>
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
  overrides?: Partial<Diagram>
): Diagram {
  return {
    id: generateId(),
    name: "Test Schema",
    databaseType: "postgresql",
    tables,
    relationships,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── computeMetrics ───────────────────────────────────────────────────────────

describe("computeMetrics", () => {
  it("computes correct metrics for 3 tables and 2 relationships", () => {
    const usersTable = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true, nullable: false }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
    ]);

    const postsTable = makeTable("posts", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true, nullable: false }),
      makeField({ name: "user_id", type: "INTEGER", isForeignKey: true }),
      makeField({ name: "title", type: "TEXT" }),
    ]);

    const tagsTable = makeTable("tags", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true, nullable: false }),
      makeField({ name: "name", type: "VARCHAR(100)" }),
    ]);

    const rel1: DBRelationship = {
      id: generateId(),
      sourceTableId: postsTable.id,
      sourceFieldId: postsTable.fields[1]!.id,
      targetTableId: usersTable.id,
      targetFieldId: usersTable.fields[0]!.id,
      cardinality: "one-to-many",
    };

    const rel2: DBRelationship = {
      id: generateId(),
      sourceTableId: postsTable.id,
      sourceFieldId: postsTable.fields[0]!.id,
      targetTableId: tagsTable.id,
      targetFieldId: tagsTable.fields[0]!.id,
      cardinality: "many-to-many",
    };

    const diagram = makeDiagram([usersTable, postsTable, tagsTable], [rel1, rel2]);
    const metrics = computeMetrics(diagram);

    expect(metrics.tableCount).toBe(3);
    expect(metrics.viewCount).toBe(0);
    expect(metrics.fieldCount).toBe(7);
    expect(metrics.relationshipCount).toBe(2);
    expect(metrics.avgFieldsPerTable).toBeCloseTo(7 / 3);
    expect(metrics.orphanTables).toEqual([]);
    expect(metrics.selfReferences).toEqual([]);
    expect(metrics.relationalDensity).toBeCloseTo(2 / 3);
  });

  it("identifies orphan tables", () => {
    const t1 = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);
    const t2 = makeTable("orphan", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
    ]);

    const diagram = makeDiagram([t1, t2], []);
    const metrics = computeMetrics(diagram);

    expect(metrics.orphanTables).toContain("users");
    expect(metrics.orphanTables).toContain("orphan");
  });

  it("identifies self-referencing tables", () => {
    const t1 = makeTable("employees", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true }),
      makeField({ name: "manager_id", type: "INTEGER", isForeignKey: true }),
    ]);

    const selfRel: DBRelationship = {
      id: generateId(),
      sourceTableId: t1.id,
      sourceFieldId: t1.fields[1]!.id,
      targetTableId: t1.id,
      targetFieldId: t1.fields[0]!.id,
      cardinality: "one-to-many",
    };

    const diagram = makeDiagram([t1], [selfRel]);
    const metrics = computeMetrics(diagram);
    expect(metrics.selfReferences).toContain("employees");
  });

  it("computes maxDepth for a chain of FKs", () => {
    const t1 = makeTable("a", [makeField({ name: "id", type: "INT", primaryKey: true })]);
    const t2 = makeTable("b", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
      makeField({ name: "a_id", type: "INT", isForeignKey: true }),
    ]);
    const t3 = makeTable("c", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
      makeField({ name: "b_id", type: "INT", isForeignKey: true }),
    ]);

    const rel1: DBRelationship = {
      id: generateId(),
      sourceTableId: t2.id,
      sourceFieldId: t2.fields[1]!.id,
      targetTableId: t1.id,
      targetFieldId: t1.fields[0]!.id,
      cardinality: "one-to-many",
    };
    const rel2: DBRelationship = {
      id: generateId(),
      sourceTableId: t3.id,
      sourceFieldId: t3.fields[1]!.id,
      targetTableId: t2.id,
      targetFieldId: t2.fields[0]!.id,
      cardinality: "one-to-many",
    };

    const diagram = makeDiagram([t1, t2, t3], [rel1, rel2]);
    const metrics = computeMetrics(diagram);
    expect(metrics.maxDepth).toBe(2);
  });

  it("counts views separately", () => {
    const t1 = makeTable("users", [makeField({ name: "id", type: "INT" })]);
    const v1 = makeTable("user_view", [makeField({ name: "id", type: "INT" })], {
      isView: true,
    });
    const diagram = makeDiagram([t1, v1]);
    const metrics = computeMetrics(diagram);
    expect(metrics.tableCount).toBe(1);
    expect(metrics.viewCount).toBe(1);
  });
});

// ─── detectAntiPatterns ───────────────────────────────────────────────────────

describe("detectAntiPatterns", () => {
  it("detects missing PK as critical", () => {
    const table = makeTable("no_pk_table", [
      makeField({ name: "name", type: "TEXT" }),
      makeField({ name: "value", type: "INT" }),
    ]);
    const diagram = makeDiagram([table]);
    const patterns = detectAntiPatterns(diagram);

    const missingPK = patterns.filter((p) => p.category === "missing-pk");
    expect(missingPK.length).toBeGreaterThanOrEqual(1);
    expect(missingPK[0]!.severity).toBe("critical");
    expect(missingPK[0]!.table).toBe("no_pk_table");
  });

  it("detects nullable FK as warning", () => {
    const table = makeTable("orders", [
      makeField({ name: "id", type: "INT", primaryKey: true, nullable: false }),
      makeField({
        name: "user_id",
        type: "INT",
        isForeignKey: true,
        nullable: true,
      }),
    ]);
    const diagram = makeDiagram([table]);
    const patterns = detectAntiPatterns(diagram);

    const nullableFK = patterns.filter((p) => p.category === "nullable-fk");
    expect(nullableFK.length).toBe(1);
    expect(nullableFK[0]!.severity).toBe("warning");
    expect(nullableFK[0]!.field).toBe("user_id");
  });

  it("detects orphan table as info", () => {
    const t1 = makeTable("connected", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
    ]);
    const t2 = makeTable("orphan", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
    ]);

    const rel: DBRelationship = {
      id: generateId(),
      sourceTableId: t1.id,
      sourceFieldId: t1.fields[0]!.id,
      targetTableId: t1.id,
      targetFieldId: t1.fields[0]!.id,
      cardinality: "one-to-one",
    };

    const diagram = makeDiagram([t1, t2], [rel]);
    const patterns = detectAntiPatterns(diagram);

    const orphan = patterns.filter(
      (p) => p.category === "orphan-table" && p.table === "orphan"
    );
    expect(orphan.length).toBe(1);
    expect(orphan[0]!.severity).toBe("info");
  });

  it("detects wide table as info", () => {
    const fields: DBField[] = [];
    for (let i = 0; i < 35; i++) {
      fields.push(makeField({ name: `field_${i}`, type: "TEXT" }));
    }
    fields[0] = makeField({ name: "id", type: "INT", primaryKey: true });

    const table = makeTable("wide_table", fields);
    const diagram = makeDiagram([table]);
    const patterns = detectAntiPatterns(diagram);

    const wide = patterns.filter((p) => p.category === "wide-table");
    expect(wide.length).toBe(1);
    expect(wide[0]!.severity).toBe("info");
    expect(wide[0]!.table).toBe("wide_table");
  });

  it("detects naming inconsistency with mixed camelCase and snake_case", () => {
    const table = makeTable("mixed_table", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
      makeField({ name: "user_name", type: "TEXT" }),
      makeField({ name: "firstName", type: "TEXT" }),
    ]);
    const diagram = makeDiagram([table]);
    const patterns = detectAntiPatterns(diagram);

    const namingPatterns = patterns.filter(
      (p) => p.category === "naming" && p.description.includes("mixes")
    );
    expect(namingPatterns.length).toBe(1);
    expect(namingPatterns[0]!.severity).toBe("warning");
  });

  it("detects type inconsistency for same field name across tables", () => {
    const t1 = makeTable("users", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
      makeField({ name: "status", type: "VARCHAR(50)" }),
    ]);
    const t2 = makeTable("orders", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
      makeField({ name: "status", type: "INTEGER" }),
    ]);
    const diagram = makeDiagram([t1, t2]);
    const patterns = detectAntiPatterns(diagram);

    const typeInconsistent = patterns.filter(
      (p) => p.category === "type-inconsistency"
    );
    expect(typeInconsistent.length).toBeGreaterThanOrEqual(1);
    expect(typeInconsistent[0]!.severity).toBe("warning");
  });

  it("detects reserved word table names", () => {
    const table = makeTable("user", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
    ]);
    const diagram = makeDiagram([table]);
    const patterns = detectAntiPatterns(diagram);

    const reserved = patterns.filter(
      (p) =>
        p.category === "naming" &&
        p.description.includes("reserved") &&
        p.table === "user"
    );
    expect(reserved.length).toBeGreaterThanOrEqual(1);
  });

  it("detects missing index on FK when indexes exist on table", () => {
    const fkField = makeField({
      name: "user_id",
      type: "INT",
      isForeignKey: true,
    });
    const table = makeTable("orders", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
      fkField,
      makeField({ name: "status", type: "TEXT" }),
    ], {
      indexes: [
        {
          id: generateId(),
          name: "idx_status",
          columns: ["status"],
          unique: false,
        },
      ],
    });
    const diagram = makeDiagram([table]);
    const patterns = detectAntiPatterns(diagram);

    const missingIdx = patterns.filter(
      (p) => p.category === "missing-index" && p.field === "user_id"
    );
    expect(missingIdx.length).toBe(1);
    expect(missingIdx[0]!.severity).toBe("info");
  });

  it("detects plural/singular table name inconsistency", () => {
    const t1 = makeTable("users", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
    ]);
    const t2 = makeTable("order", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
    ]);
    const diagram = makeDiagram([t1, t2]);
    const patterns = detectAntiPatterns(diagram);

    const pluralInconsistency = patterns.filter(
      (p) =>
        p.category === "naming" &&
        p.description.includes("plural") &&
        p.description.includes("singular")
    );
    expect(pluralInconsistency.length).toBe(1);
  });
});

// ─── computeQualityScore ──────────────────────────────────────────────────────

describe("computeQualityScore", () => {
  it("returns a score between 0 and 100", () => {
    const table = makeTable("test", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
    ]);
    const diagram = makeDiagram([table]);
    const antiPatterns = detectAntiPatterns(diagram);
    const score = computeQualityScore(diagram, antiPatterns);

    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it("gives a high score to a well-designed schema", () => {
    const users = makeTable("users", [
      makeField({ name: "id", type: "INT", primaryKey: true, nullable: false }),
      makeField({ name: "email", type: "VARCHAR(255)" }),
    ]);
    const posts = makeTable("posts", [
      makeField({ name: "id", type: "INT", primaryKey: true, nullable: false }),
      makeField({ name: "user_id", type: "INT", isForeignKey: true, nullable: false }),
    ]);

    const rel: DBRelationship = {
      id: generateId(),
      sourceTableId: posts.id,
      sourceFieldId: posts.fields[1]!.id,
      targetTableId: users.id,
      targetFieldId: users.fields[0]!.id,
      cardinality: "one-to-many",
    };

    const diagram = makeDiagram([users, posts], [rel]);
    const antiPatterns = detectAntiPatterns(diagram);
    const score = computeQualityScore(diagram, antiPatterns);

    expect(score.overall).toBeGreaterThanOrEqual(80);
  });

  it("returns breakdown with 4 categories", () => {
    const table = makeTable("test", [
      makeField({ name: "id", type: "INT", primaryKey: true }),
    ]);
    const diagram = makeDiagram([table]);
    const antiPatterns = detectAntiPatterns(diagram);
    const score = computeQualityScore(diagram, antiPatterns);

    expect(score.breakdown).toHaveLength(4);
    const categories = score.breakdown.map((b) => b.category);
    expect(categories).toContain("naming");
    expect(categories).toContain("normalization");
    expect(categories).toContain("relationships");
    expect(categories).toContain("indexing");
  });

  it("deducts points for missing PKs", () => {
    const table = makeTable("no_pk", [
      makeField({ name: "name", type: "TEXT" }),
    ]);
    const diagram = makeDiagram([table]);
    const antiPatterns = detectAntiPatterns(diagram);
    const score = computeQualityScore(diagram, antiPatterns);

    const relBreakdown = score.breakdown.find(
      (b) => b.category === "relationships"
    );
    expect(relBreakdown!.score).toBeLessThan(relBreakdown!.maxScore);
  });
});

// ─── analyzeSchema (integration) ─────────────────────────────────────────────

describe("analyzeSchema", () => {
  it("returns complete analysis for a realistic schema", () => {
    const users = makeTable("users", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true, nullable: false }),
      makeField({ name: "email", type: "VARCHAR(255)", unique: true }),
      makeField({ name: "name", type: "TEXT" }),
    ]);

    const posts = makeTable("posts", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true, nullable: false }),
      makeField({
        name: "user_id",
        type: "INTEGER",
        isForeignKey: true,
        nullable: false,
        references: { table: "users", field: "id" },
      }),
      makeField({ name: "title", type: "VARCHAR(255)" }),
      makeField({ name: "body", type: "TEXT" }),
    ]);

    const comments = makeTable("comments", [
      makeField({ name: "id", type: "SERIAL", primaryKey: true, nullable: false }),
      makeField({
        name: "post_id",
        type: "INTEGER",
        isForeignKey: true,
        nullable: false,
        references: { table: "posts", field: "id" },
      }),
      makeField({
        name: "user_id",
        type: "INTEGER",
        isForeignKey: true,
        nullable: false,
        references: { table: "users", field: "id" },
      }),
      makeField({ name: "body", type: "TEXT" }),
    ]);

    const rel1: DBRelationship = {
      id: generateId(),
      sourceTableId: posts.id,
      sourceFieldId: posts.fields[1]!.id,
      targetTableId: users.id,
      targetFieldId: users.fields[0]!.id,
      cardinality: "one-to-many",
    };

    const rel2: DBRelationship = {
      id: generateId(),
      sourceTableId: comments.id,
      sourceFieldId: comments.fields[1]!.id,
      targetTableId: posts.id,
      targetFieldId: posts.fields[0]!.id,
      cardinality: "one-to-many",
    };

    const rel3: DBRelationship = {
      id: generateId(),
      sourceTableId: comments.id,
      sourceFieldId: comments.fields[2]!.id,
      targetTableId: users.id,
      targetFieldId: users.fields[0]!.id,
      cardinality: "one-to-many",
    };

    const diagram = makeDiagram([users, posts, comments], [rel1, rel2, rel3]);
    const analysis = analyzeSchema(diagram);

    // Metrics
    expect(analysis.metrics.tableCount).toBe(3);
    expect(analysis.metrics.relationshipCount).toBe(3);
    expect(analysis.metrics.orphanTables).toEqual([]);

    // Anti-patterns: should be minimal for a well-designed schema
    expect(analysis.antiPatterns).toBeDefined();

    // Quality score
    expect(analysis.qualityScore.overall).toBeGreaterThanOrEqual(0);
    expect(analysis.qualityScore.overall).toBeLessThanOrEqual(100);
    expect(analysis.qualityScore.breakdown).toHaveLength(4);
  });
});

describe("normalization validation", () => {
  it("detects 1NF violation: multi-value column names", () => {
    const table: DBTable = {
      id: generateId(),
      name: "users",
      fields: [
        { id: generateId(), name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "tags", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    };
    const diagram = makeDiagram([table], []);
    const patterns = detectAntiPatterns(diagram);
    expect(patterns.some((p) => p.description.includes("1NF") && p.field === "tags")).toBe(true);
  });

  it("detects 1NF violation: JSON/array column types", () => {
    const table: DBTable = {
      id: generateId(),
      name: "events",
      fields: [
        { id: generateId(), name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "metadata", type: "JSONB", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    };
    const diagram = makeDiagram([table], []);
    const patterns = detectAntiPatterns(diagram);
    expect(patterns.some((p) => p.description.includes("1NF") && p.field === "metadata")).toBe(true);
  });

  it("detects 2NF hint: composite PK with non-key fields", () => {
    const table: DBTable = {
      id: generateId(),
      name: "order_items",
      fields: [
        { id: generateId(), name: "order_id", type: "INT", primaryKey: true, unique: false, nullable: false, isForeignKey: true },
        { id: generateId(), name: "product_id", type: "INT", primaryKey: true, unique: false, nullable: false, isForeignKey: true },
        { id: generateId(), name: "quantity", type: "INT", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "price", type: "DECIMAL", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    };
    const diagram = makeDiagram([table], []);
    const patterns = detectAntiPatterns(diagram);
    expect(patterns.some((p) => p.description.includes("2NF") || p.description.includes("composite primary key"))).toBe(true);
  });

  it("detects 3NF hint: multiple FKs with many data columns", () => {
    const table: DBTable = {
      id: generateId(),
      name: "orders",
      fields: [
        { id: generateId(), name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "user_id", type: "INT", primaryKey: false, unique: false, nullable: false, isForeignKey: true },
        { id: generateId(), name: "product_id", type: "INT", primaryKey: false, unique: false, nullable: false, isForeignKey: true },
        { id: generateId(), name: "total", type: "DECIMAL", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "status", type: "VARCHAR", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "notes", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    };
    const diagram = makeDiagram([table], []);
    const patterns = detectAntiPatterns(diagram);
    expect(patterns.some((p) => p.description.includes("3NF") || p.description.includes("transitive"))).toBe(true);
  });

  it("does not flag 1NF for normal column names", () => {
    const table: DBTable = {
      id: generateId(),
      name: "users",
      fields: [
        { id: generateId(), name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "email", type: "VARCHAR", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
        { id: generateId(), name: "name", type: "VARCHAR", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    };
    const diagram = makeDiagram([table], []);
    const patterns = detectAntiPatterns(diagram);
    expect(patterns.some((p) => p.description.includes("1NF"))).toBe(false);
  });
});
