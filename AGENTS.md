# AGENTS.md — db-schema-viewer

## Project Overview

Client-side database schema visualizer built with Next.js. Users upload SQL (or ORM schema files), see interactive ER diagrams, get AI-powered reviews, and share via compressed URLs. 100% browser-side — no backend.

## Tech Stack

- **Framework**: Next.js 16 (App Router, static export for GitHub Pages, standalone for Docker)
- **Canvas**: @xyflow/react 12 (React Flow)
- **SQL Parsing**: node-sql-parser 5 + custom regex parsers
- **AI**: Vercel AI SDK (`ai` v6) + @ai-sdk/{openai,anthropic,google,mistral} v3 + @ai-sdk/openai-compatible v2, through [llm-connect](https://github.com/maxgfr/llm-models/tree/main/packages/llm-connect)
- **Styling**: Tailwind CSS 4 + Radix UI primitives + Lucide icons
- **Charts**: Recharts 3
- **Sharing**: lz-string (URL compression)
- **Export**: html-to-image + jspdf (lazy-loaded)
- **Testing**: Vitest + happy-dom; Playwright against production static output
- **Package manager**: pnpm 10

## Commands

```bash
pnpm dev              # Build toolkit, then tsup --watch + next dev (Turbopack) in parallel
pnpm build            # Production build (static export by default)
pnpm build:export     # Explicit static export for GitHub Pages
pnpm lint             # ESLint on src/
pnpm typecheck        # TypeScript strict mode check
pnpm test             # Vitest watch mode
pnpm test:ci          # Build toolkit, then run toolkit and web tests
pnpm test:e2e         # Browser journeys; run pnpm build first
pnpm benchmark       # Parser, graph and sharing microbenchmarks
pnpm benchmark:browser # Browser import/filter and dump timings after pnpm build
pnpm test:coverage    # Build toolkit, then Vitest with coverage report
```

## Project Structure

Parsers, exporters, analysis, AI prompts and dump/fake-data logic live in the `db-schema-toolkit` workspace package; the web app imports them from `db-schema-toolkit`, `db-schema-toolkit/export`, `/analysis`, `/ai` and `/data`.

```
packages/db-schema-toolkit/src/
  index.ts, export.ts, analysis.ts, ai.ts, data.ts   # Package entry points (one per subpath export)
  cli.ts                              # db-schema-toolkit CLI
  domain/index.ts                     # Core types: DBTable, DBField, Diagram, DatabaseType
  parsing/parse-schema-file.ts        # Shared: detect format → parse → auto-layout
  sql/
    index.ts                          # parseSQLToDiagram (main entry)
    sql-import.ts                     # SQL → ParsedTable/ParsedRelationship
    detect-db-type.ts                 # Auto-detect DB dialect from SQL content
    sample-schemas.ts                 # Built-in sample schemas
    schema-templates.ts               # Extended templates (Social, IoT, LMS, Analytics)
    dialects/
      node-sql-parser-dialect.ts      # PG/MySQL/SQLite via node-sql-parser
      regex-dialect.ts                # BigQuery/Snowflake/ClickHouse via regex
  drizzle/, prisma/, dbml/, typeorm/,
  mikroorm/, sequelize/, kysely/      # Regex-based ORM/DSL parsers → Diagram
  sql-export/index.ts                 # Diagram → SQL DDL per target dialect
  export/                             # Diagram → Markdown, Mermaid, Prisma, Drizzle, DBML, PlantUML
  examples/example-schemas.ts         # Multi-format example schemas
  analysis/
    schema-analyzer.ts                # Schema quality analysis (naming, indexing, etc.)
    schema-diff.ts                    # Diff two Diagrams (added/removed/modified)
  ai/
    ai-service.ts                     # Vercel AI SDK streaming + structured output (model from llm-connect's loadModel)
    ai-prompts.ts                     # System prompts + schema context serialization
  sharing/encode-state.ts             # lz-string compress/decompress for URL sharing
  layout/auto-layout.ts               # Grid-based auto-layout algorithm
  dump/
    dump-parser.ts                    # Parse INSERT INTO statements from SQL dumps
    data-types.ts                     # Column type inference (numeric, string, date)
    fake-data-generator.ts            # Seeded fake rows from a Diagram

src/
  app/
    page.tsx                          # Root — renders Landing or EditorLayout
    layout.tsx                        # HTML shell, CSP <meta>, Sonner toaster
    _components/
      landing/                        # Home page (upload, samples, templates) + recent projects
      canvas/
        EditorLayout.tsx              # Main editor: toolbar + sidebar + canvas + modals
        SchemaCanvas.tsx              # @xyflow/react canvas wrapper
        TableNode.tsx                 # Custom React Flow node for tables
        StickyNoteNode.tsx            # Sticky-note annotations on the canvas
        RelationshipEdge.tsx          # Custom edge with Crow's Foot / Chen notation
      schema/
        SchemaUpload.tsx              # Guided upload wizard (format selection → upload/paste)
        SchemaSidebar.tsx             # Left panel: table list, search, field details
      export/ExportDialog.tsx         # Export: project, image, PDF, SQL, Markdown, Mermaid, DBML, PlantUML, Prisma, Drizzle, embed
      ai/AIPanel.tsx                  # AI chat + "Challenge My Schema" review
      data/                           # SQL dump exploration, charts and data chat
      analysis/SchemaDiffPanel.tsx    # Schema diff: compare current vs uploaded schema
      source/SourceViewer.tsx         # View original schema source code
      settings/APIKeySettings.tsx     # AI provider/key/endpoint configuration (llm-connect store)
  workers/
    schema.worker.ts                  # parseSchemaFile off the main thread
    data.worker.ts                    # Dump parsing and fake-data generation
  lib/
    parsing/                          # Worker requests (one worker per operation, cancellable)
    graph/navigation.ts               # Relationship index + table filtering for navigation
    project/project.ts                # Versioned .dbschema.json envelope (zod)
    i18n/                             # I18n context + translations (en, fr, de, es, it, ja, ru, zh)
    security/csp.mjs                  # Single source for the Content-Security-Policy
    export/                           # PNG/SVG (html-to-image) and multi-page PDF (jsPDF)
    sharing/encode-state.ts           # URL fragment encoding for diagrams, notes and view settings
    storage/
      ai-settings.ts                  # AI settings + encrypted API key (localStorage / IndexedDB)
      local-storage.ts                # Project persistence in localStorage
  hooks/
    use-keyboard-shortcuts.ts         # Cmd+I/E/K/S, Cmd+Shift+S, Escape
    use-project-session.ts            # Autosave, notes and view settings
    use-theme.ts                      # Dark/light theme with localStorage persistence
  __tests__/                          # Web components, hooks and lib tests
```

## Architecture Decisions

- **Static export** (default): Deployed on GitHub Pages via `output: "export"`. No server needed.
- **Standalone mode**: Set `NEXT_OUTPUT_MODE=standalone` for Docker deployment with security headers.
- **All parsing is client-side**: schema imports, dumps and fake data run in cancellable Web Workers in the web app. Toolkit parsers are regex-based and synchronous; browser APIs stay outside the package.
- **Projects**: `src/lib/project/project.ts` validates the versioned `.dbschema.json` envelope. `useProjectSession` owns autosave, notes and view settings; storage uses one atomic record per project and reads legacy diagrams. Keep credentials, chats and dump rows out of project files.
- **Filtering**: navigation hides tables without changing the source diagram. Every export uses the full diagram, including image exports.
- **AI dependencies**: provider SDKs load on demand (llm-connect `loadModel`); only the selected SDK must be installed by library consumers. `AISettings` is llm-connect's `LlmSettings`; its `language` is a code (`"fr"`), and the toolkit also reads the names older settings stored (`"French"`) through `languageName`.
- **AI calls go direct**: Browser → AI provider API, never through our servers.
- **AI key storage** (`src/lib/storage/ai-settings.ts`, exposed to the settings store as `aiSettingsStorage`): a thin adapter over llm-connect's `secureStorage`. Non-secret settings live in localStorage (`db-sv-ai-settings`); the API key is always encrypted with AES-GCM under a non-extractable `CryptoKey` kept in IndexedDB (`db-sv-secrets`). With "Remember the key on this device" (default off) the ciphertext goes to IndexedDB; otherwise to sessionStorage (`db-sv-ai-settings-key`), so it survives a reload and is gone with the tab. Legacy `db-sv-*` cookies are migrated once, then deleted; language names (`"French"`) are read as codes. An active XSS can still ask the browser to decrypt the key; the CSP is the defence for that case.
- **Custom endpoints**: https, or plain http on this machine only (`localhost`, `127.0.0.0/8`, `[::1]`); llm-connect refuses the rest (`insecure-endpoint`), and a custom endpoint needs a model name to count as configured.
- **CSP**: `src/lib/security/csp.mjs` is the single source. The static export carries it as a `<meta http-equiv>` in `src/app/layout.tsx`; standalone sends it as an HTTP header from `next.config.js` (headers only in standalone), together with `frame-ancestors 'none'`, `Permissions-Policy`, `X-Content-Type-Options` and `Referrer-Policy`. No `'unsafe-eval'` in production; `connect-src` allows `'self'`, `https:` and localhost for custom endpoints; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- **Model catalog**: built in the browser when the settings open (`liveCatalog` from llm-connect, which imports `llm-models` on demand and fetches models.dev and OpenRouter). `public/models.json` is only the fallback: it is not committed, `pnpm fetch-models` writes it before every build (`prebuild`, and a step in CI and Deploy), and a failure there does not stop the build. It keeps only the providers llm-connect can call, with `id/name/npm/api/defaultModel`, and models `{id, name, tool_call, reasoning}`; deprecated models are dropped.
- **URL sharing**: Diagram state compressed with lz-string into the `#d=` fragment; optional notes and view settings follow it. No database.
- **Theme**: CSS class-based (`dark`/`light` on `<html>`), persisted in localStorage.

## Supported Formats

**Import (parsing):** SQL (PG, MySQL, SQLite, MariaDB, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake), Drizzle ORM (.ts), Prisma (.prisma), TypeORM (.ts with @Entity), MikroORM (.ts with @Entity + @Property), Sequelize (.ts/.js), Kysely (.ts), DBML (.dbml), project files (.dbschema.json, web app only)

**Export (code generation):** SQL (all dialects), Prisma schema, Drizzle ORM, DBML, PlantUML, Markdown, Mermaid ERD, JSON (CLI), PNG, SVG, PDF (web app)

## Key Patterns

- **File format detection**: `parseSchemaFile()` in `packages/db-schema-toolkit/src/parsing/` routes by file extension + content heuristics (e.g., `@Entity` + `@Property` → MikroORM, `@Entity` → TypeORM, `sequelize.define` → Sequelize, `Generated<` → Kysely, else → Drizzle)
- **Modals**: Use `createPortal(content, document.body)` for all dialogs
- **Toast notifications**: `sonner` library, imported as `toast` from `"sonner"`
- **Icons**: Always use `lucide-react`, never raw SVG
- **State management**: React useState/useCallback at component level, no global store
- **TypeScript**: Strict mode + `noUncheckedIndexedAccess` — use `!` assertion only on statically-known-safe array accesses

## Testing

- Web tests live in `src/__tests__/` (`components/`, `hooks/`, `lib/` mirroring `src/lib/`)
- Use Vitest with happy-dom environment
- Import from `@/lib/...` (path alias works in vitest via resolve.alias)
- Image/PDF downloads are exercised in real browsers; PDF pagination also has a focused jsPDF test.
- AI service tests mock the SDK; browser tests intercept provider responses. They do not validate live provider availability or response quality.
- Toolkit parser/export/analysis/data/CLI tests live in `packages/db-schema-toolkit/__tests__/`.
- Browser journeys in `e2e/` cover Chromium, Firefox, WebKit and mobile WebKit. Match `NEXT_PUBLIC_BASE_PATH` between the build and test commands.
- Example schema fixtures in `examples/` (Drizzle, Prisma, DBML, TypeORM) are parsed and validated in tests

### Pre-commit checks

All four must pass before committing:

```bash
pnpm typecheck        # TypeScript strict mode — no errors allowed
pnpm lint             # ESLint — no warnings allowed
pnpm test:ci          # Vitest single run — all tests must pass
pnpm build            # Production build — must succeed
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`): On push/PR to main → typecheck → lint → tests → static build with base path → browser journeys → standalone build
- **Deploy** (`.github/workflows/deploy.yml`): On push to main → `pnpm fetch-models` → build static export → deploy to GitHub Pages
- **Publish** (`.github/workflows/release.yml`): On push to main (concurrency group `release`) → build package → typecheck → lint → tests → semantic-release (npm publish of `db-schema-toolkit`, GitHub release with the CLI tarball)
- **Docker** (`.github/workflows/docker.yml`): On `v*` tags and after "Publish" completes on main → multi-arch image pushed to GHCR; the semver tag is read with `git describe --tags --exact-match`

## Docker

- Two-stage Dockerfile (builder → runner) on `node:24-alpine`, with a non-root user
- `docker-compose.yml` with optional Ollama service for local AI
- Uses standalone Next.js output mode in Docker

## Package documentation (`packages/db-schema-toolkit/`)

When adding or modifying CLI commands, exported functions, or supported formats in the package, keep these files in sync:

- `packages/db-schema-toolkit/README.md` — full library + CLI docs (published to npm)
- `packages/db-schema-toolkit/llms.txt` — concise CLI reference for AI agents
- `packages/db-schema-toolkit/PROMPT.md` — copy-pasteable prompt for AI assistants
- Root `README.md` — CLI section must mirror the package's command list

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
