# CLAUDE.md — db-schema-viewer

## Project Overview

Client-side database schema visualizer built with Next.js. Users upload SQL (or ORM schema files), see interactive ER diagrams, get AI-powered reviews, and share via compressed URLs. 100% browser-side — no backend.

## Tech Stack

- **Framework**: Next.js 16 (App Router, static export for GitHub Pages, standalone for Docker)
- **Canvas**: @xyflow/react 12 (React Flow)
- **SQL Parsing**: node-sql-parser 5 + custom regex parsers
- **AI**: Vercel AI SDK (`ai`) + @ai-sdk/{openai,anthropic,google,mistral}
- **Styling**: Tailwind CSS 4 + Radix UI primitives + Lucide icons
- **Charts**: Recharts 3
- **Sharing**: lz-string (URL compression)
- **Export**: html-to-image + jspdf (lazy-loaded)
- **Testing**: Vitest + happy-dom
- **Package manager**: pnpm 10

## Commands

```bash
pnpm dev              # Dev server with Turbopack
pnpm build            # Production build (static export by default)
pnpm build:export     # Explicit static export for GitHub Pages
pnpm lint             # ESLint on src/
pnpm typecheck        # TypeScript strict mode check
pnpm test             # Vitest watch mode
pnpm test:ci          # Vitest single run (CI)
pnpm test:coverage    # Vitest with coverage report
```

## Project Structure

```
src/
  app/
    page.tsx                          # Root — renders Landing or EditorLayout
    layout.tsx                        # HTML shell + Sonner toaster
    _components/
      landing/Landing.tsx             # Home page with upload, samples, templates
      canvas/
        EditorLayout.tsx              # Main editor: toolbar + sidebar + canvas + modals
        SchemaCanvas.tsx              # @xyflow/react canvas wrapper
        TableNode.tsx                 # Custom React Flow node for tables
        RelationshipEdge.tsx          # Custom edge with Crow's Foot / Chen notation
      schema/
        SchemaUpload.tsx              # Guided upload wizard (format selection → upload/paste)
        SchemaSidebar.tsx             # Left panel: table list, search, field details
      export/ExportDialog.tsx         # Export: Image/PDF/SQL/Markdown/Mermaid/Prisma/Drizzle
      ai/AIPanel.tsx                  # AI chat + "Challenge My Schema" review
      data/
        DataExplorer.tsx              # SQL dump exploration (INSERT data)
        DataCharts.tsx                # Recharts visualizations
      analysis/SchemaDiffPanel.tsx    # Schema diff: compare current vs uploaded schema
      settings/APIKeySettings.tsx     # AI provider/key/endpoint configuration
  lib/
    domain/index.ts                   # Core types: DBTable, DBField, Diagram, DatabaseType
    parsing/parse-schema-file.ts      # Shared: detect format → parse → auto-layout
    sql/
      index.ts                        # parseSQLToDiagram (main entry)
      sql-import.ts                   # SQL → ParsedTable/ParsedRelationship
      detect-db-type.ts               # Auto-detect DB dialect from SQL content
      sample-schemas.ts               # Built-in sample schemas
      schema-templates.ts             # Extended templates (Social, IoT, LMS, Analytics)
      dialects/
        node-sql-parser-dialect.ts    # PG/MySQL/SQLite via node-sql-parser
        regex-dialect.ts              # BigQuery/Snowflake/ClickHouse via regex
    sql-export/index.ts               # Diagram → SQL DDL per target dialect
    export/
      image-export.ts                 # PNG/SVG via html-to-image (theme-aware)
      pdf-export.ts                   # Multi-page PDF (title, TOC, diagram, table details)
      markdown-export.ts              # Diagram → Markdown documentation
      mermaid-export.ts               # Diagram → Mermaid ERD
      prisma-export.ts                # Diagram → Prisma schema
      drizzle-export.ts               # Diagram → Drizzle ORM TypeScript
    drizzle/drizzle-parser.ts         # Drizzle ORM .ts → Diagram
    prisma/prisma-parser.ts           # .prisma → Diagram
    dbml/dbml-parser.ts               # .dbml → Diagram
    typeorm/typeorm-parser.ts         # TypeORM @Entity .ts → Diagram
    analysis/
      schema-analyzer.ts             # Schema quality analysis (naming, indexing, etc.)
      schema-diff.ts                  # Diff two Diagrams (added/removed/modified)
    ai/
      ai-service.ts                   # Vercel AI SDK streaming + structured output
      ai-prompts.ts                   # System prompts + schema context serialization
    sharing/encode-state.ts           # lz-string compress/decompress for URL sharing
    layout/auto-layout.ts             # Grid-based auto-layout algorithm
    storage/
      cookie-storage.ts              # AI settings in cookies (secure, sameSite: strict)
      local-storage.ts               # Diagram persistence in localStorage
    dump/
      dump-parser.ts                 # Parse INSERT INTO statements from SQL dumps
      data-types.ts                  # Column type inference (numeric, string, date)
  hooks/
    use-keyboard-shortcuts.ts        # Cmd+I/E/K/S, Cmd+Shift+S, Escape
    use-theme.ts                     # Dark/light theme with localStorage persistence
  __tests__/                         # Mirrors lib/ structure, 26 test files, 217+ tests
```

## Architecture Decisions

- **Static export** (default): Deployed on GitHub Pages via `output: "export"`. No server needed.
- **Standalone mode**: Set `NEXT_OUTPUT_MODE=standalone` for Docker deployment with CSP headers.
- **All parsing is client-side**: node-sql-parser runs in the browser. No server round-trips.
- **AI calls go direct**: Browser → AI provider API. Keys stored in cookies (never sent to our servers).
- **URL sharing**: Diagram state compressed with lz-string into `?d=` query param. No database.
- **Theme**: CSS class-based (`dark`/`light` on `<html>`), persisted in localStorage.

## Supported Formats

**Import (parsing):** SQL (PG, MySQL, SQLite, MariaDB, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake), Drizzle ORM (.ts), Prisma (.prisma), TypeORM (.ts with @Entity), DBML (.dbml)

**Export (code generation):** SQL (all dialects), Prisma schema, Drizzle ORM, Markdown, Mermaid ERD, PNG, SVG, PDF

## Key Patterns

- **File format detection**: `parseSchemaFile()` in `lib/parsing/` routes by file extension + content heuristics (e.g., `@Entity` in .ts → TypeORM, else → Drizzle)
- **Modals**: Use `createPortal(content, document.body)` for all dialogs
- **Toast notifications**: `sonner` library, imported as `toast` from `"sonner"`
- **Icons**: Always use `lucide-react`, never raw SVG
- **State management**: React useState/useCallback at component level, no global store
- **TypeScript**: Strict mode + `noUncheckedIndexedAccess` — use `!` assertion only on statically-known-safe array accesses

## Testing

- Tests live in `src/__tests__/lib/` mirroring the `src/lib/` structure
- Use Vitest with happy-dom environment
- Import from `@/lib/...` (path alias works in vitest via resolve.alias)
- DOM-dependent code (image-export, pdf-export) is not unit-tested — needs real browser
- AI service is not unit-tested — requires SDK mocking
- Run `pnpm test:ci` before committing

## CI/CD

- **CI** (`.github/workflows/ci.yml`): On push/PR to main → typecheck → lint → test → build
- **Deploy** (`.github/workflows/deploy.yml`): On push to main → build static export → deploy to GitHub Pages

## Docker

- Multi-stage Dockerfile (deps → builder → runner) with non-root user
- `docker-compose.yml` with optional Ollama service for local AI
- Uses standalone Next.js output mode in Docker
