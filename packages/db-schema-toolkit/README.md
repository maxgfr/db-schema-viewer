# db-schema-toolkit

Parse, analyze, export, and AI-review database schemas from code. Supports **SQL** (PostgreSQL, MySQL, SQLite, MariaDB, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake), **Drizzle**, **Prisma**, **DBML**, **TypeORM**, **MikroORM**, **Sequelize**, and **Kysely**.

[![npm](https://img.shields.io/npm/v/db-schema-toolkit)](https://www.npmjs.com/package/db-schema-toolkit)
[![license](https://img.shields.io/npm/l/db-schema-toolkit)](https://github.com/maxgfr/db-schema-viewer/blob/main/LICENSE)

## Install

### As a library

```bash
npm install db-schema-toolkit
# or
pnpm add db-schema-toolkit
```

### As a CLI

```bash
# Run directly without installing
npx db-schema-toolkit help

# Install globally via npm
npm install -g db-schema-toolkit

# Install via Homebrew
brew install maxgfr/tap/db-schema-toolkit
```

---

## CLI

`db-schema-toolkit` ships a CLI that can parse, export, analyze, and diff schemas directly from the terminal.

### Commands

#### `export` — Convert schema to another format

```bash
db-schema-toolkit export <file> --format <fmt> [--output <file>] [--db-type <type>]
```

| Flag | Short | Description |
|------|-------|-------------|
| `--format` | `-f` | Output format: `sql`, `markdown`, `mermaid`, `prisma`, `drizzle`, `dbml`, `plantuml`, `json` |
| `--output` | `-o` | Write to file instead of stdout |
| `--db-type` | `-d` | Target DB for SQL export: `postgresql`, `mysql`, `mariadb`, `sqlite`, `supabase`, `cockroachdb`, `clickhouse`, `bigquery`, `snowflake` |

```bash
# SQL to Mermaid ERD
db-schema-toolkit export schema.sql -f mermaid

# Prisma to Markdown docs
db-schema-toolkit export schema.prisma -f markdown -o docs.md

# Drizzle to PostgreSQL DDL
db-schema-toolkit export schema.ts -f sql --db-type postgresql

# Any format to JSON (for piping)
db-schema-toolkit export schema.prisma -f json | jq '.tables[].name'
```

#### `analyze` — Schema quality analysis

```bash
db-schema-toolkit analyze <file> [--json] [--output <file>]
```

Returns a quality score (0–100), metrics (table/field/relationship counts, relational density, FK depth), and anti-patterns (missing PKs, naming issues, orphan tables, etc.).

```bash
# Human-readable report
db-schema-toolkit analyze schema.sql

# Machine-readable JSON
db-schema-toolkit analyze schema.sql --json

# Get quality score as a number
db-schema-toolkit analyze schema.sql --json | jq '.qualityScore.overall'

# Find critical issues
db-schema-toolkit analyze schema.sql --json | jq '.antiPatterns[] | select(.severity == "critical")'
```

#### `diff` — Compare two schemas

```bash
db-schema-toolkit diff <file1> <file2> [--json] [--output <file>]
```

Shows added/removed tables, field changes, index changes, and relationship changes.

```bash
# Human-readable diff
db-schema-toolkit diff old-schema.sql new-schema.sql

# JSON diff for CI
db-schema-toolkit diff base.sql head.sql --json > diff.json
```

#### `parse` — Output full diagram as JSON

```bash
db-schema-toolkit parse <file> [--output <file>]
```

Parses any supported format and outputs the raw `Diagram` object as JSON.

```bash
db-schema-toolkit parse schema.prisma | jq '.tables[].name'
```

#### `info` — Quick schema summary

```bash
db-schema-toolkit info <file>
```

Prints a summary: table/view count, fields with types, PK/FK/unique constraints.

#### `help` / `version`

```bash
db-schema-toolkit help          # Usage and examples
db-schema-toolkit help --llm    # Machine-readable help for AI agents
db-schema-toolkit version       # Print version
```

### CI/CD Usage

```yaml
# .github/workflows/schema-check.yml
- name: Check schema quality
  run: |
    npx db-schema-toolkit analyze schema.sql --json > analysis.json
    SCORE=$(jq '.qualityScore.overall' analysis.json)
    if [ "$SCORE" -lt 70 ]; then
      echo "Schema quality score $SCORE is below threshold (70)"
      exit 1
    fi

- name: Schema diff on PR
  run: |
    git show HEAD~1:schema.sql > old.sql || true
    npx db-schema-toolkit diff old.sql schema.sql --json > diff.json
```

---

## Library API

### Quick Start

```ts
import { parseSchemaFile } from "db-schema-toolkit";

const diagram = parseSchemaFile(`
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name TEXT
  );
  CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id)
  );
`, "schema.sql");

console.log(diagram.tables);        // 2 tables
console.log(diagram.relationships); // 1 FK relationship
```

## Entry Points

| Import | Contents |
|--------|----------|
| `db-schema-toolkit` | Types, parsers, format detection, layout, sharing, utilities |
| `db-schema-toolkit/export` | Code generation (SQL, Prisma, Drizzle, Markdown, Mermaid, DBML, PlantUML) |
| `db-schema-toolkit/analysis` | Schema quality analysis, anti-pattern detection, schema diff |
| `db-schema-toolkit/ai` | AI-powered schema review (requires `ai` + provider peer deps) |
| `db-schema-toolkit/data` | SQL dump parsing, column type inference, fake data generation |

## Parsing

### Auto-detect format

```ts
import { parseSchemaFile, detectFormat } from "db-schema-toolkit";

// Detects format from filename + content heuristics
const format = detectFormat(content, "schema.prisma"); // "prisma"
const diagram = parseSchemaFile(content, "schema.prisma");
```

### Individual parsers

```ts
import {
  parseSQLToDiagram,
  parseDrizzleSchema,
  parsePrismaSchema,
  parseDBMLSchema,
  parseTypeORMSchema,
  parseMikroORMSchema,
  parseSequelizeSchema,
  parseKyselySchema,
  detectDatabaseType,
} from "db-schema-toolkit";

// SQL with auto-detected dialect
const diagram = parseSQLToDiagram(sqlContent, "My Schema");

// Or detect dialect explicitly
const dbType = detectDatabaseType(sqlContent); // "postgresql" | "mysql" | ...
```

## Export

```ts
import {
  exportDiagramToSQL,
  exportDiagramToPrisma,
  exportDiagramToDrizzle,
  exportDiagramToMarkdown,
  exportDiagramToMermaid,
  exportDiagramToDBML,
  exportDiagramToPlantUML,
} from "db-schema-toolkit/export";

// SQL DDL for a specific dialect
const sql = exportDiagramToSQL(diagram, "postgresql");

// Prisma schema
const prisma = exportDiagramToPrisma(diagram);

// Mermaid ERD
const mermaid = exportDiagramToMermaid(diagram);

// Markdown documentation
const md = exportDiagramToMarkdown(diagram);

// Drizzle ORM TypeScript
const drizzle = exportDiagramToDrizzle(diagram);
```

## Analysis

```ts
import {
  analyzeSchema,
  computeMetrics,
  detectAntiPatterns,
  diffSchemas,
} from "db-schema-toolkit/analysis";

// Full analysis: metrics + anti-patterns + quality score
const analysis = analyzeSchema(diagram);
console.log(analysis.qualityScore.overall); // 0-100
console.log(analysis.antiPatterns);         // missing PKs, naming issues, etc.

// Compare two schemas
const diff = diffSchemas(oldDiagram, newDiagram);
console.log(diff.addedTables);
console.log(diff.modifiedTables);
```

## AI (optional)

Requires peer dependencies: `ai` + one of `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/mistral`.

```bash
npm install ai @ai-sdk/openai
```

```ts
import { challengeSchema, querySchema, type AISettings } from "db-schema-toolkit/ai";

const settings: AISettings = {
  apiKey: "sk-...",
  model: "gpt-4o",
  providerId: "openai",
  providerNpm: "@ai-sdk/openai",
};

// AI-powered schema review (structured output)
const review = await challengeSchema(settings, diagram);
console.log(review.overallScore); // 0-100
console.log(review.issues);      // severity, category, suggestion

// Interactive Q&A about your schema (streaming)
await querySchema(settings, diagram, "What indexes should I add?",
  (chunk) => process.stdout.write(chunk),
  (full) => console.log("\nDone"),
);
```

## Data

```ts
import { parseSQLDump, inferColumnTypes, generateFakeData } from "db-schema-toolkit/data";

// Parse INSERT statements from a SQL dump
const tables = parseSQLDump(sqlDump);
console.log(tables[0].columns); // ["id", "email", "name"]
console.log(tables[0].rows);    // [{ id: 1, email: "...", ... }, ...]

// Infer column types from data
const types = inferColumnTypes(tables[0].columns, tables[0].rows);
// { id: "number", email: "string", created_at: "date" }

// Generate fake data for a schema
const fakeData = generateFakeData(diagram.tables, diagram.relationships);
```

## Core Types

```ts
import type {
  Diagram,         // Full schema: tables + relationships + metadata
  DBTable,         // Table with fields, indexes, position
  DBField,         // Column: name, type, PK, FK, nullable, etc.
  DBRelationship,  // FK relationship with cardinality
  DatabaseType,    // "postgresql" | "mysql" | "sqlite" | ...
  Cardinality,     // "one-to-one" | "one-to-many" | "many-to-many"
} from "db-schema-toolkit";
```

All types are [Zod](https://zod.dev) schemas, so they work for both TypeScript types and runtime validation:

```ts
import { Diagram } from "db-schema-toolkit";

const parsed = Diagram.parse(jsonData); // runtime validation
```

## Utilities

```ts
import {
  autoLayout,       // Auto-position tables in a grid layout
  shuffleLayout,    // Randomize table positions
  encodeState,      // Compress a Diagram to a URL-safe string
  decodeState,      // Decompress back to a Diagram
  generateId,       // Generate unique IDs
  SAMPLE_SCHEMAS,   // Built-in sample SQL schemas
  SCHEMA_TEMPLATES, // Extended schema templates (Social, IoT, LMS, Analytics)
  EXAMPLE_SCHEMAS,  // Multi-format example schemas
} from "db-schema-toolkit";
```

## Supported Formats

### Import (parsing)

| Format | Function | File detection |
|--------|----------|----------------|
| SQL (PostgreSQL, MySQL, SQLite, MariaDB, Supabase, CockroachDB) | `parseSQLToDiagram` | `.sql` |
| SQL (ClickHouse, BigQuery, Snowflake) | `parseSQLToDiagram` | `.sql` |
| Drizzle ORM | `parseDrizzleSchema` | `.ts` with drizzle imports |
| Prisma | `parsePrismaSchema` | `.prisma` |
| DBML | `parseDBMLSchema` | `.dbml` |
| TypeORM | `parseTypeORMSchema` | `.ts` with `@Entity` |
| MikroORM | `parseMikroORMSchema` | `.ts` with `@mikro-orm` |
| Sequelize | `parseSequelizeSchema` | `.ts`/`.js` with `sequelize.define` |
| Kysely | `parseKyselySchema` | `.ts` with `kysely` |

### Export (code generation)

| Format | Function |
|--------|----------|
| SQL DDL (all dialects) | `exportDiagramToSQL(diagram, targetDb)` |
| Prisma schema | `exportDiagramToPrisma(diagram)` |
| Drizzle ORM TypeScript | `exportDiagramToDrizzle(diagram)` |
| Markdown documentation | `exportDiagramToMarkdown(diagram)` |
| Mermaid ERD | `exportDiagramToMermaid(diagram)` |
| DBML | `exportDiagramToDBML(diagram)` |
| PlantUML | `exportDiagramToPlantUML(diagram)` |

## License

MIT
