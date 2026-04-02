import { parseDrizzleSchema } from "../../src/drizzle/drizzle-parser";
import { exportDiagramToMermaid } from "../../src/export/mermaid-export";
import { exportDiagramToMarkdown } from "../../src/export/markdown-export";
import { describe, it, expect } from "vitest";

/**
 * Self-contained Drizzle schema that reproduces the patterns from a real-world
 * production schema (pgTableCreator, callback syntax, comments between fields,
 * composite PKs, unique constraints, defaults, ORM-only relations, pgEnum).
 */
const EGAPRO_STYLE_SCHEMA = `
import { relations } from "drizzle-orm";
import { index, pgEnum, pgTableCreator, primaryKey, unique } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

export const createTable = pgTableCreator((name) => \`app_\${name}\`);

export const users = createTable("user", (d) => ({
  id: d.varchar({ length: 255 }).notNull().primaryKey(),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    // NextAuth DrizzleAdapter requires these exact snake_case property names
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const declarations = createTable(
  "declaration",
  (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    siren: d.varchar({ length: 9 }).notNull(),
    year: d.integer().notNull(),
    declarantId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    currentStep: d.integer().default(0),
    status: d.varchar({ length: 20 }).default("draft"),
    createdAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [
    unique("declaration_siren_year_idx").on(t.siren, t.year),
    index("declaration_declarant_idx").on(t.declarantId),
  ],
);

export const declarationsRelations = relations(declarations, ({ one }) => ({
  declarant: one(users, {
    fields: [declarations.declarantId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [declarations.siren],
    references: [companies.siren],
  }),
}));

export const declarationTypeEnum = pgEnum("declaration_type", ["initial", "correction"]);

export const employeeCategories = createTable(
  "employee_category",
  (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    jobCategoryId: d.varchar({ length: 255 }).notNull().references(() => jobCategories.id),
    declarationType: declarationTypeEnum().notNull(),
    womenCount: d.integer(),
    menCount: d.integer(),
  }),
  (t) => [
    unique("employee_category_job_type_idx").on(t.jobCategoryId, t.declarationType),
  ],
);

export const jobCategories = createTable(
  "job_category",
  (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    declarationId: d.varchar({ length: 255 }).notNull().references(() => declarations.id),
    name: d.varchar({ length: 255 }).notNull(),
  }),
  (t) => [
    unique("job_category_declaration_index_idx").on(t.declarationId),
  ],
);

// ── GIP MDS imported data ───────────────────────────────────────────
export const gipMdsData = createTable(
  "gip_mds_data",
  (d) => ({
    siren: d.varchar({ length: 9 }).notNull(),
    year: d.integer().notNull(),
    // File-level metadata
    importedAt: d.timestamp({ withTimezone: true }),
    periodStart: d.date(),
    // Workforce
    workforceEma: d.numeric({ precision: 9, scale: 2 }),
    menCountAnnualGlobal: d.numeric({ precision: 9, scale: 2 }),
    // Indicator A — Global mean remuneration gap
    globalAnnualMeanGap: d.numeric({ precision: 9, scale: 4 }),
    globalAnnualMeanWomen: d.numeric({ precision: 9, scale: 2 }),
    // Confidence index
    confidenceIndex: d.numeric({ precision: 9, scale: 4 }),
  }),
  (t) => [
    primaryKey({ columns: [t.siren, t.year] }),
    index("gip_mds_data_siren_idx").on(t.siren),
  ],
);

export const companies = createTable("company", (d) => ({
  siren: d.varchar({ length: 9 }).notNull().primaryKey(),
  name: d.varchar({ length: 255 }).notNull(),
}));

export const userCompanies = createTable(
  "user_company",
  (d) => ({
    userId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    siren: d.varchar({ length: 9 }).notNull().references(() => companies.siren),
    createdAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [
    primaryKey({ columns: [t.userId, t.siren] }),
  ],
);

export const fileLinkTable = createTable(
  "file_link",
  (d) => ({
    fileId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    opinionId: d.varchar({ length: 255 }).notNull().references(() => users.id),
  }),
  (t) => [primaryKey({ columns: [t.fileId, t.opinionId] })],
);

export const exports = createTable(
  "export",
  (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    year: d.integer().notNull(),
    // Keep in sync with EXPORT_VERSION
    version: d.varchar({ length: 10 }).notNull().default("v1"),
    fileName: d.varchar({ length: 255 }).notNull(),
  }),
  (t) => [unique("export_year_version_idx").on(t.year, t.version)],
);
`;

describe("Drizzle parser — production patterns regression", () => {
  const diagram = parseDrizzleSchema(EGAPRO_STYLE_SCHEMA, "egapro");

  it("parses all tables", () => {
    expect(diagram.tables.length).toBe(10);
    const names = diagram.tables.map((t) => t.name).sort();
    expect(names).toEqual([
      "account",
      "company",
      "declaration",
      "employee_category",
      "export",
      "file_link",
      "gip_mds_data",
      "job_category",
      "user",
      "user_company",
    ]);
  });

  // ── Comment stripping ─────────────────────────────────────────────

  describe("fields after comments are parsed", () => {
    it("parses account.refresh_token after a single-line comment", () => {
      const account = diagram.tables.find((t) => t.name === "account")!;
      const col = account.fields.find((f) => f.name === "refresh_token");
      expect(col).toBeDefined();
      expect(col!.type).toBe("TEXT");
      expect(col!.nullable).toBe(true);
    });

    it("parses gip_mds_data fields after multiple comments", () => {
      const gip = diagram.tables.find((t) => t.name === "gip_mds_data")!;
      expect(gip.fields.find((f) => f.name === "importedAt")).toBeDefined();
      expect(gip.fields.find((f) => f.name === "workforceEma")).toBeDefined();
      expect(gip.fields.find((f) => f.name === "globalAnnualMeanGap")).toBeDefined();
      expect(gip.fields.find((f) => f.name === "confidenceIndex")).toBeDefined();
    });

    it("parses export.version after a comment", () => {
      const exp = diagram.tables.find((t) => t.name === "export")!;
      const version = exp.fields.find((f) => f.name === "version");
      expect(version).toBeDefined();
      expect(version!.type).toBe("VARCHAR");
      expect(version!.nullable).toBe(false);
    });
  });

  // ── Composite primary keys ────────────────────────────────────────

  describe("composite primary keys", () => {
    it("detects account PK (provider, providerAccountId)", () => {
      const account = diagram.tables.find((t) => t.name === "account")!;
      expect(account.fields.find((f) => f.name === "provider")!.primaryKey).toBe(true);
      expect(account.fields.find((f) => f.name === "providerAccountId")!.primaryKey).toBe(true);
      // userId should NOT be PK
      expect(account.fields.find((f) => f.name === "userId")!.primaryKey).toBe(false);
    });

    it("detects gip_mds_data PK (siren, year)", () => {
      const gip = diagram.tables.find((t) => t.name === "gip_mds_data")!;
      expect(gip.fields.find((f) => f.name === "siren")!.primaryKey).toBe(true);
      expect(gip.fields.find((f) => f.name === "year")!.primaryKey).toBe(true);
    });

    it("detects user_company PK (userId, siren)", () => {
      const uc = diagram.tables.find((t) => t.name === "user_company")!;
      expect(uc.fields.find((f) => f.name === "userId")!.primaryKey).toBe(true);
      expect(uc.fields.find((f) => f.name === "siren")!.primaryKey).toBe(true);
    });

    it("detects file_link PK (fileId, opinionId)", () => {
      const link = diagram.tables.find((t) => t.name === "file_link")!;
      expect(link.fields.find((f) => f.name === "fileId")!.primaryKey).toBe(true);
      expect(link.fields.find((f) => f.name === "opinionId")!.primaryKey).toBe(true);
    });
  });

  // ── Default values ────────────────────────────────────────────────

  describe("default values", () => {
    it("parses integer default: declaration.currentStep = 0", () => {
      const decl = diagram.tables.find((t) => t.name === "declaration")!;
      expect(decl.fields.find((f) => f.name === "currentStep")!.default).toBe("0");
    });

    it("parses string default: declaration.status = 'draft'", () => {
      const decl = diagram.tables.find((t) => t.name === "declaration")!;
      expect(decl.fields.find((f) => f.name === "status")!.default).toBe("draft");
    });

    it("parses string default: export.version = 'v1'", () => {
      const exp = diagram.tables.find((t) => t.name === "export")!;
      expect(exp.fields.find((f) => f.name === "version")!.default).toBe("v1");
    });

    it("fields without defaults have undefined", () => {
      const decl = diagram.tables.find((t) => t.name === "declaration")!;
      expect(decl.fields.find((f) => f.name === "siren")!.default).toBeUndefined();
    });
  });

  // ── Unique constraints ────────────────────────────────────────────

  describe("unique constraints parsed as indexes", () => {
    it("parses declaration unique(siren, year)", () => {
      const decl = diagram.tables.find((t) => t.name === "declaration")!;
      const idx = decl.indexes.find((i) => i.name === "declaration_siren_year_idx");
      expect(idx).toBeDefined();
      expect(idx!.unique).toBe(true);
      expect(idx!.columns).toEqual(["siren", "year"]);
    });

    it("parses employee_category unique(jobCategoryId, declarationType)", () => {
      const emp = diagram.tables.find((t) => t.name === "employee_category")!;
      const idx = emp.indexes.find((i) => i.name === "employee_category_job_type_idx");
      expect(idx).toBeDefined();
      expect(idx!.unique).toBe(true);
      expect(idx!.columns).toEqual(["jobCategoryId", "declarationType"]);
    });

    it("parses export unique(year, version)", () => {
      const exp = diagram.tables.find((t) => t.name === "export")!;
      const idx = exp.indexes.find((i) => i.name === "export_year_version_idx");
      expect(idx).toBeDefined();
      expect(idx!.unique).toBe(true);
      expect(idx!.columns).toEqual(["year", "version"]);
    });
  });

  // ── Indexes ───────────────────────────────────────────────────────

  describe("regular indexes", () => {
    it("parses account index on userId", () => {
      const account = diagram.tables.find((t) => t.name === "account")!;
      const idx = account.indexes.find((i) => i.name === "account_user_id_idx");
      expect(idx).toBeDefined();
      expect(idx!.unique).toBe(false);
      expect(idx!.columns).toEqual(["userId"]);
    });

    it("parses declaration index on declarantId", () => {
      const decl = diagram.tables.find((t) => t.name === "declaration")!;
      const idx = decl.indexes.find((i) => i.name === "declaration_declarant_idx");
      expect(idx).toBeDefined();
      expect(idx!.unique).toBe(false);
      expect(idx!.columns).toEqual(["declarantId"]);
    });
  });

  // ── ORM-only relations vs DB FK ───────────────────────────────────

  describe("ORM relations vs DB foreign keys", () => {
    it("marks .references() columns as FK", () => {
      const account = diagram.tables.find((t) => t.name === "account")!;
      expect(account.fields.find((f) => f.name === "userId")!.isForeignKey).toBe(true);

      const decl = diagram.tables.find((t) => t.name === "declaration")!;
      expect(decl.fields.find((f) => f.name === "declarantId")!.isForeignKey).toBe(true);
    });

    it("does NOT mark ORM-only relation columns as FK", () => {
      // declaration.siren -> company.siren is only via relations(), not .references()
      const decl = diagram.tables.find((t) => t.name === "declaration")!;
      expect(decl.fields.find((f) => f.name === "siren")!.isForeignKey).toBe(false);
    });

    it("still creates a relationship line for ORM-only relations", () => {
      // declaration -> company relationship should still exist
      const declTable = diagram.tables.find((t) => t.name === "declaration")!;
      const compTable = diagram.tables.find((t) => t.name === "company")!;
      const rel = diagram.relationships.find(
        (r) => r.sourceTableId === declTable.id && r.targetTableId === compTable.id,
      );
      expect(rel).toBeDefined();
    });
  });

  // ── Mermaid direction ─────────────────────────────────────────────

  describe("Mermaid export direction", () => {
    it("places parent table on left (user ||--o{ account)", () => {
      const mermaid = exportDiagramToMermaid(diagram);
      // user is parent of account (account.userId -> user.id)
      expect(mermaid).toContain("user ||--o{");
      expect(mermaid).not.toMatch(/account \|\|--o\{ user/);
    });
  });

  // ── Markdown export ───────────────────────────────────────────────

  describe("Markdown export completeness", () => {
    const md = exportDiagramToMarkdown(diagram);

    it("includes all tables", () => {
      expect(md).toContain("## Table: account");
      expect(md).toContain("## Table: declaration");
      expect(md).toContain("## Table: gip_mds_data");
      expect(md).toContain("## Table: export");
    });

    it("includes default values in table columns", () => {
      // declaration.currentStep has default 0
      expect(md).toMatch(/currentStep.*0/);
      // declaration.status has default "draft"
      expect(md).toMatch(/status.*draft/);
    });

    it("includes indexes section", () => {
      expect(md).toContain("declaration_siren_year_idx");
      expect(md).toContain("UNIQUE");
    });

    it("does NOT list declaration.siren as FK", () => {
      // Between "## Table: declaration" and the next "## Table:"
      const declSection = md.split("## Table: declaration")[1]!.split("## Table:")[0]!;
      // siren should appear in the fields table but NOT in Foreign Keys section
      expect(declSection).toContain("| siren |");
      if (declSection.includes("### Foreign Keys")) {
        expect(declSection).not.toMatch(/`siren`\s*->\s*`company/);
      }
    });
  });

  // ── pgEnum ────────────────────────────────────────────────────────

  describe("pgEnum handling", () => {
    it("maps pgEnum to the enum name as type", () => {
      const emp = diagram.tables.find((t) => t.name === "employee_category")!;
      const declType = emp.fields.find((f) => f.name === "declarationType");
      expect(declType).toBeDefined();
      expect(declType!.nullable).toBe(false);
      // Type should be the SQL enum name or a mapped version
      expect(declType!.type).toBe("DECLARATION_TYPE");
    });
  });
});
