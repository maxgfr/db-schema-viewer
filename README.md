# DB Schema Viewer

[![CI](https://github.com/maxgfr/db-schema-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/maxgfr/db-schema-viewer/actions/workflows/ci.yml)
[![Deploy](https://github.com/maxgfr/db-schema-viewer/actions/workflows/deploy.yml/badge.svg)](https://github.com/maxgfr/db-schema-viewer/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-616%20passing-brightgreen)](https://github.com/maxgfr/db-schema-viewer/actions)

> **100% client-side** database schema visualizer. Upload SQL, Drizzle, Prisma, TypeORM, Sequelize, MikroORM, Kysely, or DBML schemas, visualize interactive ER diagrams, analyze with AI, and export to 10 formats. Your data never leaves your browser.

**[Live Demo](https://maxgfr.github.io/db-schema-viewer/)**

---

## Philosophy

- **Everything runs locally** — no backend, no data transmission, no account. API keys in cookies, diagrams in localStorage.
- **Simple UI** — upload a schema, see a diagram. Primary keys, foreign keys, relations (1:1, 1:N, N:M) visible at a glance.
- **Schema analysis, not schema editing** — the tool is a *viewer* and *analyzer*, not a full database designer.
- **Multi-format input** — SQL (9 dialects), Drizzle ORM, Prisma, TypeORM, Sequelize, MikroORM, Kysely, DBML.

---

## Features

### Schema Visualization
- Interactive drag/zoom/pan canvas (React Flow) with table nodes and relationship edges
- **3 ERD notations**: Crow's Foot, UML, and Chen — toggle with one click
- Color-coded tables with PK (amber), FK (blue) icons per field
- Expandable table nodes (12+ fields collapse with "show more")
- MiniMap + Controls for navigation
- **Double-click to zoom** on any table from the sidebar
- **Table grouping** by schema (public, auth, etc.) in the sidebar
- **Expand/collapse all** tables in the sidebar
- **Enhanced stats**: FK count, index count, field count per table
- **Canvas annotations**: add draggable sticky notes on the canvas (4 colors)

### Schema Input

| Format | Status | Parser | Supported Variants |
|--------|--------|--------|--------------------|
| SQL | **Stable** | `node-sql-parser` + regex fallback | PostgreSQL, MySQL, MariaDB, SQLite, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake |
| Drizzle ORM (.ts) | **Beta** | Regex-based | pgTable, mysqlTable, sqliteTable, pgTableCreator |
| Prisma (.prisma) | **Beta** | Regex-based | All providers (postgresql, mysql, sqlite, cockroachdb) |
| TypeORM (.ts) | **Beta** | Regex-based | @Entity, @Column, @ManyToOne, @OneToMany, @OneToOne |
| DBML (.dbml) | **Beta** | Regex-based | Table, Ref, indexes, inline refs |
| Sequelize (.ts/.js) | **Beta** | Regex-based | sequelize.define(), Model.init(), DataTypes, associations |
| MikroORM (.ts) | **Beta** | Regex-based | @Entity, @Property, @PrimaryKey, @ManyToOne, @OneToOne |
| Kysely (.ts) | **Beta** | Regex-based | interface Database, Generated<T>, ColumnType<S,I,U> |
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

### Schema Analysis (client-side, no AI)
- **Anti-pattern detection**: tables without PK, nullable FK, orphan tables, naming inconsistencies, reserved words, type mismatches, wide tables, missing FK indexes
- **Normalization validation**: detect potential 1NF violations (multi-value columns, JSON/array types), 2NF issues (composite keys with partial dependencies), and 3NF hints (transitive dependencies)
- **Quality score** (0-100): naming conventions, normalization, relationships, indexing
- **Schema metrics**: table count, field count, relationship count, relational density, FK hierarchy depth, connected components
- **Schema diff**: upload a second schema to compare — added/removed/modified tables, fields, indexes, and relationships

### AI-Powered Analysis
- **Chat mode** — Ask questions about your schema with streaming responses and conversation history
- **Quick actions** — Explain as PM, Suggest indexes, Generate migration, Generate query, Find issues, Test queries
- **Challenge mode** — Structured review with score (0-100), severity levels, and 8 categories
- **Challenge history** — Track score evolution over time with trend indicators
- **Schema diff AI** — Upload two schemas, then let AI evaluate the migration safety and breaking changes
- **Report export** — Download challenge results as JSON or Markdown
- **Review by category** — Filter issues by severity (critical/warning/info) and category (naming, security, performance...)
- **Multi-provider** — OpenAI, Anthropic, Google Gemini, Mistral, or any OpenAI-compatible endpoint
- **Secure** — API keys stored in cookies (365d, secure, sameSite strict), never sent to our servers

### Export

| Format | Details |
|--------|---------|
| **PNG** | 2x scale by default, transparent background option |
| **SVG** | Vector format, lossless |
| **PDF** | Multi-page: title + TOC + diagram + per-table detail (fields, types, FKs, indexes) |
| **SQL** | Cross-dialect conversion with CASCADE, CREATE INDEX, COMMENT ON, ENUM types, CREATE VIEW |
| **Markdown** | Full documentation with tables, columns, indexes, relationships, and embedded Mermaid ERD |
| **Mermaid** | ERD diagram for GitHub READMEs and Mermaid-compatible renderers |
| **DBML** | Compatible with dbdiagram.io |
| **PlantUML** | Entity-relationship diagram |
| **Prisma** | .prisma schema file with models, relations, and field attributes |
| **Drizzle** | TypeScript Drizzle ORM code with table definitions and column builders |
| **Embed** | Embeddable `<iframe>` snippet with encoded schema URL |

### Sharing
- Compress schema to URL via lz-string (like Excalidraw)
- `#d=<encoded>` hash fragment, no server needed
- Size warning when URL exceeds 8KB

### Data Exploration
- Upload small SQL dumps (INSERT INTO statements, 5MB max) or generate fake data from your schema
- **Drag-and-drop** upload at any time (empty state or with data loaded)
- Paginated table view with NULL highlighting
- **Column sorting** — click a header to sort ASC/DESC, click again to reverse, third click to reset
- **Data search** — filter rows by value across all columns
- **Automatic stats** — min, max, avg, median, distinct count per numeric column in table footer
- **Histograms** — value distribution charts for all numeric columns
- **Correlation matrix** — Pearson correlation heatmap between numeric columns
- **Date binning** — group date columns by day, week, month, or year
- 5 chart types: Bar, Line, Pie, Scatter, Area with aggregation (sum, avg, count, min, max)
- **AI charts** — let AI suggest the best visualizations, or describe a chart in natural language
- **CSV export** — download displayed data (respects current search/sort)
- **Data chat** — ask questions about your data with AI, per-table conversation history

### Theme
- Dark / Light mode toggle with system preference detection
- Flash-free via inline script (no FOUC)
- All components use CSS variable theming

### PWA
- Installable as a desktop/mobile app
- Service worker for offline access to the application shell
- Cache-first strategy with background updates for static assets

### i18n
- **English** and **French** language support
- Language toggle in the editor toolbar (Globe icon)
- Browser language auto-detection with localStorage persistence
- 400+ translation keys covering all UI surfaces

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
| Testing | Vitest + happy-dom (616 tests) |
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

### ORM & Schema Loaders

| Format | File | What's Parsed |
|--------|------|---------------|
| **Drizzle** | `.ts` / `.js` | pgTable/mysqlTable/sqliteTable/pgTableCreator, column types, .primaryKey(), .notNull(), .unique(), .references(), .default(), relations(), pgEnum, indexes, composite PK |
| **Prisma** | `.prisma` | model, enum, @id, @unique, @default, @relation, @@id, @@index, @@map, @map, datasource provider |
| **TypeORM** | `.ts` | @Entity, @Column, @PrimaryGeneratedColumn, @ManyToOne, @OneToMany, @OneToOne, @JoinColumn, @Index |
| **DBML** | `.dbml` | Table, columns with [pk/unique/not null/default/ref], Ref blocks, inline refs, indexes, aliases |
| **Sequelize** | `.ts` / `.js` | sequelize.define(), Model.init(), DataTypes mapping, primaryKey, allowNull, unique, defaultValue, references, belongsTo/hasMany/hasOne/belongsToMany |
| **MikroORM** | `.ts` | @Entity, @Property, @PrimaryKey, @Unique, @ManyToOne, @OneToOne, @Enum, @Index, TypeScript type inference |
| **Kysely** | `.ts` | interface Database, Generated<T>, ColumnType<S,I,U>, nullable unions, optional fields, FK by naming convention |

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
│       ├── schema/             # SchemaUpload modal, SchemaSidebar (grouping, zoom, stats)
│       ├── ai/                 # AIPanel (Chat + Challenge + History)
│       ├── analysis/           # SchemaDiffPanel (with AI comparison)
│       ├── data/               # DataExplorer + DataCharts (histograms, AI charts)
│       ├── export/             # ExportDialog (10 format tabs)
│       ├── source/             # SourceViewer (original schema code)
│       └── settings/           # APIKeySettings modal
├── lib/
│   ├── domain/                 # Zod schemas (Diagram, DBTable, DBField, etc.)
│   ├── sql/                    # SQL parsing pipeline
│   │   ├── detect-db-type.ts   # Weighted pattern matching
│   │   ├── sql-import.ts       # Main entry: parseSQLToDiagram()
│   │   ├── sample-schemas.ts   # Built-in sample schemas
│   │   ├── schema-templates.ts # Extended templates (Social, IoT, LMS, Analytics)
│   │   └── dialects/           # node-sql-parser + regex parsers
│   ├── drizzle/                # Drizzle ORM parser
│   ├── prisma/                 # Prisma schema parser
│   ├── typeorm/                # TypeORM entity parser
│   ├── sequelize/              # Sequelize ORM parser
│   ├── mikroorm/               # MikroORM entity parser
│   ├── kysely/                 # Kysely type definition parser
│   ├── dbml/                   # DBML parser
│   ├── ai/                     # AI service + prompt context builder
│   ├── analysis/               # Schema analyzer + diff engine
│   ├── sharing/                # URL encoding (lz-string)
│   ├── storage/                # Cookie (AI keys) + localStorage (diagrams)
│   ├── layout/                 # Auto-layout algorithm (BFS + grid)
│   ├── parsing/                # Shared: format detection + routing
│   ├── export/                 # PNG/SVG/PDF/Markdown/Mermaid/DBML/PlantUML/Prisma/Drizzle
│   ├── sql-export/             # Cross-dialect SQL generation (CASCADE, INDEX, COMMENT ON, ENUM, VIEW)
│   ├── dump/                   # SQL dump parser + type inference + fake data generator
│   ├── i18n/                   # Translations (en.ts, fr.ts) + context provider
│   └── utils.ts                # generateId, getTableColor, cn()
├── hooks/
│   ├── use-theme.ts            # Dark/Light toggle + localStorage
│   └── use-keyboard-shortcuts.ts
├── components/ui/              # Radix UI wrappers (Button, Tooltip)
└── __tests__/                  # 48 test files, 616 tests
```

---

## What This "Fully Local" Approach Enables

The fundamental advantage of a 100% client-side viewer is that it can be used:

1. **In enterprises without data leak concerns** — no schema data is transmitted to a third-party server. The tool can be deployed on an intranet or used offline.

2. **For security audits** — analyze a production schema without exposing it. The AI challenge sends only the structure (table/column names and types), never actual data.

3. **For documentation** — generate multi-page PDFs with the diagram + table/field details to include in technical documentation.

4. **For teaching** — students can visualize and understand relationships (0..1, 1..N, N:M), primary keys, and foreign keys without installing a DBMS.

5. **For code review** — upload a schema.prisma or schema.ts directly from the repo, visualize relationships, then run an AI challenge to detect issues before merging.

6. **For migration** — import a PostgreSQL schema, export it as MySQL to see type differences and detect incompatibilities. Use the AI-powered diff to evaluate migration safety.

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

[MIT](LICENSE)
