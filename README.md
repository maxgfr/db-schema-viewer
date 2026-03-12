# DB Schema Viewer

[![CI](https://github.com/maxgfr/db-schema-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/maxgfr/db-schema-viewer/actions/workflows/ci.yml)
[![Deploy](https://github.com/maxgfr/db-schema-viewer/actions/workflows/deploy.yml/badge.svg)](https://github.com/maxgfr/db-schema-viewer/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-104%20passing-brightgreen)](https://github.com/maxgfr/db-schema-viewer/actions)

> **100% client-side** database schema visualizer. Upload SQL, Drizzle or Prisma schemas, visualize interactive diagrams, analyze with AI, export to PDF/PNG/SQL. Your data never leaves your browser.

**[Live Demo](https://maxgfr.github.io/db-schema-viewer/)**

---

## Philosophy

- **Everything runs locally** — no backend, no data transmission, no account. API keys in cookies, diagrams in localStorage.
- **Simple UI** — upload a schema, see a diagram. Primary keys, foreign keys, relations (1:1, 1:N, N:M) visible at a glance.
- **Schema analysis, not schema editing** — the tool is a *viewer* and *analyzer*, not a full database designer.
- **Multi-format input** — SQL (9 dialects), Drizzle ORM, Prisma (all in beta for ORM formats).

---

## Features

### Schema Visualization
- Interactive drag/zoom/pan canvas (React Flow) with table nodes and relationship edges
- Color-coded tables with PK (amber), FK (blue) icons per field
- Cardinality labels on edges (1, N) with smooth-step paths
- Expandable table nodes (12+ fields collapse with "show more")
- MiniMap + Controls for navigation
- Searchable sidebar with table/field filtering

### Schema Input
| Format | Status | Parser | Supported Variants |
|--------|--------|--------|--------------------|
| SQL | **Stable** | `node-sql-parser` + regex fallback | PostgreSQL, MySQL, MariaDB, SQLite, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake |
| Drizzle ORM (.ts) | **Beta** | Regex-based | pgTable, mysqlTable, sqliteTable |
| Prisma (.prisma) | **Beta** | Regex-based | All providers (postgresql, mysql, sqlite, cockroachdb) |
| Paste SQL | **Stable** | Same as file upload | All dialects |

### Auto-Detection
Weighted pattern matching detects the database type from SQL syntax:
- PostgreSQL: `SERIAL`, `JSONB`, `UUID`, `::`
- MySQL: `AUTO_INCREMENT`, `ENGINE=InnoDB`, backticks
- SQLite: `AUTOINCREMENT`, `PRAGMA`, `WITHOUT ROWID`
- MariaDB: `ENGINE=Aria`, `SYSTEM VERSIONING`
- Supabase: `auth.users`, `storage.buckets`, `pgsodium`
- CockroachDB: `INTERLEAVE IN PARENT`, `crdb_internal`
- ClickHouse: `MergeTree`, `UInt64`, `LowCardinality`
- BigQuery: `INT64`, `STRING`, `STRUCT<`, `ARRAY<`
- Snowflake: `VARIANT`, `NUMBER(38,0)`, `CREATE STAGE`

### AI-Powered Analysis
- **Chat mode** — Ask questions about your schema with streaming responses and conversation history
- **Challenge mode** — Structured review with score (0-100), severity levels (info/warning/critical), and categories (naming, normalization, indexing, relationships, types, performance, security)
- **Multi-provider** — OpenAI, Anthropic, Google Gemini, Mistral, or any OpenAI-compatible endpoint
- **Secure** — API keys stored in cookies (365d, secure, sameSite strict), never sent to our servers

### Export
| Format | Details |
|--------|---------|
| **PNG** | 2x scale by default, transparent background option |
| **SVG** | Vector format, lossless |
| **PDF** | Auto-orientation, title with table/relationship count |
| **SQL** | Cross-dialect conversion: export a PG schema as MySQL, SQLite, BigQuery, etc. |

### Sharing
- Compress schema to URL via lz-string (like Excalidraw)
- `?d=<encoded>` parameter, no server needed
- Size warning when URL exceeds 8KB

### Data Exploration
- Upload small SQL dumps (INSERT INTO statements, 5MB max)
- Paginated table view with NULL highlighting
- 5 chart types: Bar, Line, Pie, Scatter, Area
- Aggregation modes: Sum, Avg, Count, None
- Automatic column type inference (numeric vs categorical)

### Theme
- Dark / Light mode toggle
- System preference detection (`prefers-color-scheme`)
- Flash-free via inline script (no FOUC)
- All components use CSS variable theming

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 + React 19 (App Router, static export) |
| Canvas | @xyflow/react 12 |
| SQL Parsing | node-sql-parser 5 + custom regex parsers |
| AI | Vercel AI SDK (ai + @ai-sdk/{openai, anthropic, google, mistral}) |
| Validation | Zod 4 |
| UI | Tailwind CSS 4 + Radix UI + Lucide icons |
| Charts | Recharts 3 |
| Sharing | lz-string |
| Export | html-to-image + jsPDF |
| Testing | Vitest + happy-dom (104 tests) |
| CI/CD | GitHub Actions → GitHub Pages |
| Package Manager | pnpm 10 |

---

## Getting Started

```bash
git clone https://github.com/maxgfr/db-schema-viewer.git
cd db-schema-viewer
pnpm install
pnpm dev        # http://localhost:3000
```

```bash
pnpm test       # Run tests in watch mode
pnpm test:ci    # Run tests once (CI)
pnpm lint       # ESLint
pnpm typecheck  # TypeScript
pnpm build:export  # Static build for GitHub Pages
```

---

## Supported Databases

| Database | Parser | Dialect | Detection Patterns |
|----------|--------|---------|--------------------|
| PostgreSQL | node-sql-parser | PostgreSQL | SERIAL, JSONB, UUID, ::, TIMESTAMPTZ |
| MySQL | node-sql-parser | MySQL | AUTO_INCREMENT, ENGINE=InnoDB, UNSIGNED |
| MariaDB | node-sql-parser | MySQL | ENGINE=Aria, SYSTEM VERSIONING |
| SQLite | node-sql-parser | SQLite | AUTOINCREMENT, PRAGMA, WITHOUT ROWID |
| Supabase | node-sql-parser | PostgreSQL | auth.users, storage.buckets |
| CockroachDB | node-sql-parser | PostgreSQL | INTERLEAVE IN PARENT, crdb_internal |
| ClickHouse | node-sql-parser | MySQL (preprocessed) | MergeTree, UInt64, LowCardinality |
| BigQuery | Regex parser | — | INT64, STRING, STRUCT<, ARRAY< |
| Snowflake | Regex parser | — | VARIANT, NUMBER(38,0), CREATE STAGE/PIPE |

### ORM Schema Loaders (Beta)

| ORM | File | What's Parsed |
|-----|------|---------------|
| **Drizzle** | `.ts` / `.js` | pgTable/mysqlTable/sqliteTable, column types, .primaryKey(), .notNull(), .unique(), .references(), relations() |
| **Prisma** | `.prisma` | model, enum, @id, @unique, @default, @relation, @@id, @@index, @@map, datasource provider |

---

## Test Coverage

```
14 test files — 104 tests passing

src/__tests__/lib/
├── domain/          domain.test.ts          (7 tests)  — Zod schema validation
├── drizzle/         drizzle-parser.test.ts  (6 tests)  — Drizzle ORM parsing
├── dump/            dump-parser.test.ts     (7 tests)  — SQL dump INSERT parsing
│                    data-types.test.ts      (7 tests)  — Column type inference
├── export/          sql-export.test.ts      (4 tests)  — Cross-dialect SQL generation
├── layout/          auto-layout.test.ts     (4 tests)  — Grid layout algorithm
├── prisma/          prisma-parser.test.ts   (12 tests) — Prisma schema parsing
├── sharing/         encode-state.test.ts    (5 tests)  — URL compression/decompression
├── sql/             detect-db-type.test.ts  (14 tests) — DB type detection (all 9 + generic)
│                    dialects.test.ts        (11 tests) — Per-dialect parsing
│                    sample-schemas.test.ts  (9 tests)  — Sample schema roundtrip
│                    sql-import.test.ts      (7 tests)  — SQL→Diagram pipeline
├── storage/         local-storage.test.ts   (5 tests)  — Diagram persistence
└── utils/           utils.test.ts           (6 tests)  — Utility functions
```

---

## Roadmap

### Advanced Schema Analysis

| Feature | Description | Priority |
|---------|-------------|----------|
| **Detailed relations on canvas** | Display full cardinality (0..1, 1..1, 0..N, 1..N) on edges with Crow's Foot, Chen, or UML notation | High |
| **Anti-pattern detection** | Automatically detect (without AI): tables without PK, nullable FK columns, orphan tables, obvious missing FKs, suspicious `data`/`misc`/`info` columns | High |
| **Local quality score** | Compute a client-side schema quality score (0-100) without AI: naming conventions, normalization, index coverage, type consistency | High |
| **Schema metrics** | Table count, field count, relationship count, relational density, FK hierarchy depth, connected components | Medium |
| **Inconsistent type detection** | Flag when the same logical column (e.g., `user_id`) has different types across tables | Medium |
| **Normalization validation** | Detect 1NF/2NF/3NF violations (multi-value columns, transitive dependencies) client-side | Low |

### AI — What More We Can Do

| Feature | Description | Priority |
|---------|-------------|----------|
| **SQL migration generation** | AI suggests migrations to fix detected issues (ADD INDEX, ALTER COLUMN, etc.) in native SQL for the source dialect | High |
| **Index suggestions** | Analyze FKs and column patterns to recommend missing INDEX/UNIQUE constraints | High |
| **Natural language explain** | "Explain this schema as if I were a PM" — business-friendly summary of the data model | High |
| **Schema comparison** | Upload 2 schemas, AI describes differences and evaluates the migration | Medium |
| **Query generation** | "Give me the query to retrieve a user's orders with products" — contextual SQL | Medium |
| **Review by category** | Filter AI challenge by category (security only, performance only, naming only) | Medium |
| **AI report export** | Download challenge results as JSON, Markdown, or PDF | Medium |
| **Challenge history** | Compare score before/after fixes to track improvement | Low |
| **SQL test suggestions** | AI suggests test queries to validate schema constraints | Low |

### Data & Charts

| Feature | Description | Priority |
|---------|-------------|----------|
| **Column sorting** | Click a header to sort ASC/DESC | High |
| **Data search** | Filter rows by value in any column | High |
| **Automatic stats** | Min, Max, Avg, Median, Distinct count per numeric column | High |
| **CSV export** | Download displayed data as CSV | Medium |
| **Histograms** | Value distribution for numeric columns | Medium |
| **Drag-and-drop upload** | Drag and drop the SQL dump directly onto the data area | Medium |
| **Correlation matrix** | Correlation matrix between numeric columns (heatmap) | Low |
| **Date binning** | Automatically group date columns by day/week/month/year | Low |

### Export & Sharing

| Feature | Description | Priority |
|---------|-------------|----------|
| **Multi-page PDF** | Page 1 = diagram, following pages = per-table detail (fields, types, FKs, indexes) | High |
| **Enhanced SQL export** | ON DELETE/UPDATE CASCADE, INDEX, CHECK, COMMENT ON, ENUM, CREATE VIEW | High |
| **Markdown export** | Summary table for each table in Markdown format (for docs) | Medium |
| **DBML export** | Convert schema to DBML format (dbdiagram.io) | Medium |
| **Mermaid export** | Generate an ERD diagram in Mermaid format (for GitHub READMEs) | Medium |
| **PlantUML export** | Generate a PlantUML schema | Low |
| **Embed snippet** | Generate an embeddable `<iframe>` with the encoded schema | Low |

### Additional ORM Loaders (Beta)

| ORM | Patterns to Parse | Priority |
|-----|-------------------|----------|
| **TypeORM** | `@Entity()`, `@Column()`, `@PrimaryGeneratedColumn()`, `@ManyToOne()`, `@OneToMany()` | Medium |
| **DBML** | `Table users { id int [pk] }`, `Ref: posts.user_id > users.id` | Medium |
| **Sequelize** | `define('User', { ... })`, `belongsTo()`, `hasMany()` | Low |
| **MikroORM** | `@Entity()`, `@Property()`, `@ManyToOne()` | Low |
| **Kysely** | `interface Database { users: UsersTable }` + migrations | Low |

### Tests to Add

| Category | Missing Tests | Priority |
|----------|---------------|----------|
| **AI prompts** | Test `schemaToPromptContext()`: output format, edge case handling (0 tables, tables without fields, special names) | High |
| **SQL export roundtrip** | Parse SQL → export to another dialect → re-parse and verify tables/FKs are preserved | High |
| **Drizzle edge cases** | `.default(sql`...`)`, enums, multi-line definitions, code comments, aliased imports | High |
| **Prisma edge cases** | `@@map`, `@map`, explicit many-to-many relations, `@ignore`, composite FK, views | High |
| **URL sharing roundtrip** | Encode a large schema → decode → verify full integrity (including positions) | Medium |
| **Auto-layout** | Test with 50+ tables, disconnected components, self-references | Medium |
| **Dump parser edge cases** | Unicode characters, mixed NULL values, INSERT with SELECT, multi-line values | Medium |
| **Type inference** | Test UUID, JSON, full ISO dates, monetary values, percentages | Medium |
| **Integration tests** | Test the full flow: upload → parse → layout → export (with Testing Library) | Low |
| **Performance tests** | Measure parsing time for schemas with 100+, 500+, 1000+ tables | Low |

### UX & UI

| Feature | Description | Priority |
|---------|-------------|----------|
| **ERD notation toggle** | Switch between Crow's Foot, Chen, and UML for relations | High |
| **Zoom to table** | Double-click a table in the sidebar = zoom + center | Medium |
| **Enhanced sidebar stats** | Field count, FK count, index count per table + visual indicators | Medium |
| **Table grouping** | Group tables by schema (public, auth, etc.) in the sidebar | Medium |
| **Expand/Collapse all** | Buttons to expand/collapse all items in the sidebar | Medium |
| **Canvas annotations** | Clickable sticky notes on the canvas for adding notes | Low |
| **PWA** | Service worker, offline mode, local installation | Low |
| **i18n** | FR/EN language support | Low |

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx              # Root layout + theme script
│   ├── page.tsx                # Main page (Landing ↔ Editor)
│   ├── globals.css             # Theme variables (dark + light)
│   └── _components/
│       ├── canvas/             # EditorLayout, SchemaCanvas, TableNode, RelationshipEdge
│       ├── landing/            # Landing page with sample schemas
│       ├── schema/             # SchemaUpload modal, SchemaSidebar
│       ├── ai/                 # AIPanel (Chat + Challenge tabs)
│       ├── data/               # DataExplorer + DataCharts
│       ├── export/             # ExportDialog (Image/PDF/SQL tabs)
│       └── settings/           # APIKeySettings modal
├── lib/
│   ├── domain/                 # Zod schemas (Diagram, DBTable, DBField, etc.)
│   ├── sql/                    # SQL parsing pipeline
│   │   ├── detect-db-type.ts   # Weighted pattern matching
│   │   ├── sql-import.ts       # Main entry: parseSQLToDiagram()
│   │   ├── sample-schemas.ts   # 5 sample SQL schemas
│   │   └── dialects/           # node-sql-parser + regex parsers
│   ├── drizzle/                # Drizzle ORM parser (beta)
│   ├── prisma/                 # Prisma schema parser (beta)
│   ├── ai/                     # AI service + prompt context builder
│   ├── sharing/                # URL encoding (lz-string)
│   ├── storage/                # Cookie (AI keys) + localStorage (diagrams)
│   ├── layout/                 # Auto-layout algorithm (BFS + grid)
│   ├── export/                 # PNG/SVG/PDF export
│   ├── sql-export/             # Cross-dialect SQL generation
│   ├── dump/                   # SQL dump parser + type inference
│   └── utils.ts                # generateId, getTableColor, cn()
├── hooks/
│   ├── use-theme.ts            # Dark/Light toggle + localStorage
│   └── use-keyboard-shortcuts.ts
├── components/ui/              # Radix UI wrappers (Button, Tooltip)
└── __tests__/                  # 14 test files, 104 tests
```

---

## What This "Fully Local" Approach Enables

The fundamental advantage of a 100% client-side viewer is that it can be used:

1. **In enterprises without data leak concerns** — no schema data is transmitted to a third-party server. The tool can be deployed on an intranet or used offline.

2. **For security audits** — analyze a production schema without exposing it. The AI challenge sends only the structure (table/column names and types), never actual data.

3. **For documentation** — generate multi-page PDFs with the diagram + table/field details to include in technical documentation.

4. **For teaching** — students can visualize and understand relationships (0..1, 1..N, N:M), primary keys, and foreign keys without installing a DBMS.

5. **For code review** — upload a schema.prisma or schema.ts directly from the repo, visualize relationships, then run an AI challenge to detect issues before merging.

6. **For migration** — import a PostgreSQL schema, export it as MySQL to see type differences and detect incompatibilities.

---

## Contributing

```bash
pnpm install
pnpm dev          # Start dev server
pnpm test         # Run tests in watch mode
pnpm lint         # Lint
pnpm typecheck    # Type check
```

Before submitting a PR, make sure:
- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — no errors
- `pnpm test:ci` — all tests pass
- `pnpm build:export` — build succeeds

---

## License

MIT
