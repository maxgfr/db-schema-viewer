import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Helpers ──────────────────────────────────────────────────────

const CLI = join(import.meta.dirname, "../../dist/cli.js");

function run(args: string[], { expectError }: { expectError?: boolean } = {}) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf-8",
      timeout: 15_000,
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    if (expectError && err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; stderr: string; stdout: string };
      return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: e.status };
    }
    throw err;
  }
}

let tmpDir: string;
let sqlFile: string;
let sqlFileV2: string;
let prismaFile: string;

const SQL_SCHEMA = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  body TEXT NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const SQL_SCHEMA_V2 = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  slug VARCHAR(255),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const PRISMA_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int
  author   User   @relation(fields: [authorId], references: [id])
}
`;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cli-test-"));
  sqlFile = join(tmpDir, "schema.sql");
  sqlFileV2 = join(tmpDir, "schema-v2.sql");
  prismaFile = join(tmpDir, "schema.prisma");
  writeFileSync(sqlFile, SQL_SCHEMA);
  writeFileSync(sqlFileV2, SQL_SCHEMA_V2);
  writeFileSync(prismaFile, PRISMA_SCHEMA);
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ────────────────────────────────────────────────────────

describe("CLI", () => {
  describe("help", () => {
    it("prints help with no args", () => {
      const { stdout } = run([]);
      expect(stdout).toContain("db-schema-toolkit");
      expect(stdout).toContain("COMMANDS");
      expect(stdout).toContain("export");
      expect(stdout).toContain("analyze");
      expect(stdout).toContain("diff");
    });

    it("prints help with --help", () => {
      const { stdout } = run(["--help"]);
      expect(stdout).toContain("USAGE");
    });

    it("prints help with help command", () => {
      const { stdout } = run(["help"]);
      expect(stdout).toContain("EXPORT FORMATS");
    });
  });

  describe("errors", () => {
    it("fails on unknown command", () => {
      const { exitCode, stderr } = run(["foobar"], { expectError: true });
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown command");
    });

    it("fails when file is missing", () => {
      const { exitCode, stderr } = run(["export", "/tmp/nonexistent.sql", "-f", "mermaid"], {
        expectError: true,
      });
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("not found");
    });

    it("fails when format is missing for export", () => {
      const { exitCode, stderr } = run(["export", sqlFile], { expectError: true });
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--format");
    });

    it("fails on unknown format", () => {
      const { exitCode, stderr } = run(["export", sqlFile, "-f", "xlsx"], {
        expectError: true,
      });
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown format");
    });
  });

  describe("info", () => {
    it("shows schema summary for SQL file", () => {
      const { stdout } = run(["info", sqlFile]);
      expect(stdout).toContain("schema");
      expect(stdout).toContain("Tables: 3");
      expect(stdout).toContain("Relationships: 3");
      expect(stdout).toContain("users");
      expect(stdout).toContain("posts");
      expect(stdout).toContain("comments");
    });

    it("shows schema summary for Prisma file", () => {
      const { stdout } = run(["info", prismaFile]);
      expect(stdout).toContain("Tables: 2");
      expect(stdout).toContain("User");
      expect(stdout).toContain("Post");
    });
  });

  describe("parse", () => {
    it("outputs valid JSON diagram", () => {
      const { stdout } = run(["parse", sqlFile]);
      const diagram = JSON.parse(stdout);
      expect(diagram).toHaveProperty("tables");
      expect(diagram).toHaveProperty("relationships");
      expect(diagram.tables).toHaveLength(3);
      expect(diagram.relationships).toHaveLength(3);
    });

    it("includes table fields in JSON", () => {
      const { stdout } = run(["parse", sqlFile]);
      const diagram = JSON.parse(stdout);
      const users = diagram.tables.find((t: { name: string }) => t.name === "users");
      expect(users).toBeDefined();
      expect(users.fields.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("export", () => {
    it("exports to mermaid", () => {
      const { stdout } = run(["export", sqlFile, "-f", "mermaid"]);
      expect(stdout).toContain("erDiagram");
      expect(stdout).toContain("users");
      expect(stdout).toContain("posts");
      expect(stdout).toContain("comments");
    });

    it("exports to markdown", () => {
      const { stdout } = run(["export", sqlFile, "-f", "markdown"]);
      expect(stdout).toContain("# schema");
      expect(stdout).toContain("| Column | Type |");
      expect(stdout).toContain("## Relationships");
    });

    it("exports to prisma", () => {
      const { stdout } = run(["export", sqlFile, "-f", "prisma"]);
      expect(stdout).toContain("model");
      expect(stdout).toContain("@id");
      expect(stdout).toContain("datasource db");
    });

    it("exports to drizzle", () => {
      const { stdout } = run(["export", sqlFile, "-f", "drizzle"]);
      expect(stdout).toContain("import");
      expect(stdout).toContain("Table");
    });

    it("exports to dbml", () => {
      const { stdout } = run(["export", sqlFile, "-f", "dbml"]);
      expect(stdout).toContain("Table users");
      expect(stdout).toContain("Ref:");
    });

    it("exports to plantuml", () => {
      const { stdout } = run(["export", sqlFile, "-f", "plantuml"]);
      expect(stdout).toContain("@startuml");
      expect(stdout).toContain("@enduml");
      expect(stdout).toContain("entity");
    });

    it("exports to sql", () => {
      const { stdout } = run(["export", sqlFile, "-f", "sql"]);
      expect(stdout).toContain("CREATE TABLE");
      expect(stdout).toContain("users");
    });

    it("exports to sql with --db-type mysql", () => {
      const { stdout } = run(["export", sqlFile, "-f", "sql", "--db-type", "mysql"]);
      expect(stdout).toContain("CREATE TABLE");
      expect(stdout).toContain("`users`");
      expect(stdout).toContain("AUTO_INCREMENT");
    });

    it("exports to json", () => {
      const { stdout } = run(["export", sqlFile, "-f", "json"]);
      const diagram = JSON.parse(stdout);
      expect(diagram.tables).toHaveLength(3);
    });

    it("writes to file with --output", () => {
      const outFile = join(tmpDir, "out.mmd");
      run(["export", sqlFile, "-f", "mermaid", "-o", outFile]);
      const content = require("node:fs").readFileSync(outFile, "utf-8");
      expect(content).toContain("erDiagram");
    });

    it("handles Prisma input correctly", () => {
      const { stdout } = run(["export", prismaFile, "-f", "mermaid"]);
      expect(stdout).toContain("erDiagram");
      expect(stdout).toContain("User");
      expect(stdout).toContain("Post");
    });
  });

  describe("analyze", () => {
    it("shows quality score and metrics", () => {
      const { stdout } = run(["analyze", sqlFile]);
      expect(stdout).toContain("Quality Score:");
      expect(stdout).toContain("/100");
      expect(stdout).toContain("Metrics");
      expect(stdout).toContain("Tables: 3");
    });

    it("outputs JSON with --json", () => {
      const { stdout } = run(["analyze", sqlFile, "--json"]);
      const analysis = JSON.parse(stdout);
      expect(analysis).toHaveProperty("metrics");
      expect(analysis).toHaveProperty("antiPatterns");
      expect(analysis).toHaveProperty("qualityScore");
      expect(analysis.metrics.tableCount).toBe(3);
      expect(analysis.qualityScore.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe("diff", () => {
    it("shows diff between two schemas", () => {
      const { stdout } = run(["diff", sqlFile, sqlFileV2]);
      expect(stdout).toContain("Schema Diff");
      expect(stdout).toContain("comments");
    });

    it("detects added fields", () => {
      const { stdout } = run(["diff", sqlFile, sqlFileV2]);
      expect(stdout).toContain("avatar_url");
      expect(stdout).toContain("slug");
    });

    it("outputs JSON with --json", () => {
      const { stdout } = run(["diff", sqlFile, sqlFileV2, "--json"]);
      const diff = JSON.parse(stdout);
      expect(diff).toHaveProperty("addedTables");
      expect(diff).toHaveProperty("removedTables");
      expect(diff).toHaveProperty("modifiedTables");
      expect(diff).toHaveProperty("summary");
      expect(diff.removedTables).toContain("comments");
    });

    it("fails when file2 is missing", () => {
      const { exitCode, stderr } = run(["diff", sqlFile], { expectError: true });
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Missing input files");
    });
  });
});
