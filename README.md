# DB Schema Viewer

[![CI](https://github.com/maxgfr/db-schema-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/maxgfr/db-schema-viewer/actions/workflows/ci.yml)
[![Deploy](https://github.com/maxgfr/db-schema-viewer/actions/workflows/deploy.yml/badge.svg)](https://github.com/maxgfr/db-schema-viewer/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Client-side database schema visualizer with AI-powered analysis. Upload SQL, visualize interactive diagrams, share via URL, export to PNG/PDF/SQL. **100% client-side** — your data never leaves your browser.

## Features

- **Multi-Database Support** — PostgreSQL, MySQL, SQLite, MariaDB, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake
- **Auto-Detection** — Automatically detects database type from SQL syntax
- **Interactive Diagrams** — Drag, zoom, pan tables with relationship edges (powered by React Flow)
- **AI-Powered Review** — Ask questions about your schema or run "Challenge My Schema" for structured feedback
- **Shareable URLs** — Compress and share diagrams via URL (like Excalidraw)
- **Export** — PNG, SVG, PDF, and SQL (with cross-dialect conversion)
- **Data Explorer** — Upload small SQL dumps, view data in tables, generate charts
- **Privacy First** — Everything runs in the browser. API keys stored in cookies, diagrams in localStorage.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 + React 19 (App Router, static export) |
| Canvas | @xyflow/react 12 |
| SQL Parsing | node-sql-parser 5 |
| AI | Vercel AI SDK + @ai-sdk/{openai,anthropic,google,mistral} |
| Validation | Zod |
| UI | Tailwind CSS 4 + Lucide icons |
| Charts | Recharts 3 |
| Sharing | lz-string |
| Export | html-to-image + jsPDF |
| Testing | Vitest + happy-dom + Testing Library |
| Package Manager | pnpm 10 |

## Getting Started

```bash
# Clone
git clone https://github.com/maxgfr/db-schema-viewer.git
cd db-schema-viewer

# Install
pnpm install

# Dev
pnpm dev

# Test
pnpm test

# Build
pnpm build
```

## Supported Databases

| Database | Parser | Detection |
|----------|--------|-----------|
| PostgreSQL | node-sql-parser (PG dialect) | SERIAL, JSONB, UUID, :: |
| MySQL | node-sql-parser (MySQL dialect) | AUTO_INCREMENT, ENGINE= |
| MariaDB | node-sql-parser (MySQL dialect) | MariaDB, ENGINE=Aria |
| SQLite | node-sql-parser (SQLite dialect) | AUTOINCREMENT, PRAGMA |
| Supabase | PG parser + extensions | auth.users, supabase |
| CockroachDB | PG parser + extensions | INTERLEAVE, crdb_internal |
| ClickHouse | MySQL parser + preprocessing | MergeTree, UInt64 |
| BigQuery | Regex-based parser | INT64, STRING, STRUCT< |
| Snowflake | Regex-based parser | VARIANT, STAGE, PIPE |

## License

MIT
