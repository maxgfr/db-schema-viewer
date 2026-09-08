# Functional and performance validation

Date: 2026-09-08. Local environment: macOS arm64, Node 24.19.0, pnpm 10.30.0. The results below were collected locally before publication.

## Results

- TypeScript checks and ESLint pass, with zero lint warnings.
- 722 Vitest tests pass: 668 toolkit tests in 50 files and 54 web tests in 8 files.
- 64 browser checks pass: 16 journeys on Chromium, Firefox, WebKit and mobile WebKit (iPhone 13 emulation), against the production static export under `/db-schema-viewer`.
- After strengthening image-export assertions, the 12 affected export, project and navigation checks pass again across all four profiles.
- Static builds pass both at `/` and under `/db-schema-viewer`. The standalone build passes; an actual standalone server serves CSP headers, hydrates in Chromium, imports a two-table SQL schema through a worker, renders its relationship and autosaves without page errors. This tests the standalone output locally, not a Docker container.
- Desktop/mobile editor screenshots were inspected. The four-page PDF was rendered with Poppler; its diagram was inspected again after fixing missing relationships. The UI detector reported no findings on the selected changed components; this is not a WCAG conformance audit.

## Coverage matrix

| Area | Evidence |
| --- | --- |
| SQL dialects, examples, templates | Existing parser suites and full-flow integration tests; literal/comment regression fixtures; exact 100/500/1,000-table and relationship counts |
| Drizzle, Prisma, DBML, TypeORM, Sequelize, MikroORM, Kysely | Parser suites plus real worker imports in all four browser profiles |
| Toolkit packaging and CLI | Native Node imports of all five published entry points, parsing without a bundler, AI entry import without unused provider SDKs; 40 CLI tests |
| Projects and local storage | Version validation, legacy record reading, atomic writes, quota failure/retry, malformed records, notes/view round trips, recent-project reopening |
| Editing and navigation | Search, isolation of direct neighbours, fit results, reset, persisted filters and locale changes; note text survives reload while the input is still focused |
| Sharing | Core and web round trips, empty SQL defaults, malformed percent escapes, validated notes and view settings |
| Exports | Text exporters and round trips; browser previews for all seven text formats; downloaded project, CSV, SVG, PNG and PDF; SVG includes hidden tables, relationship paths and cardinality definitions |
| PDF pagination | Real jsPDF layout with 70 tables of different lengths and multiple contents pages; contents page numbers match actual table starts |
| Data explorer | Dump parsing and fake-data suites; browser pagination/search/CSV, replacing an existing dump, generating data, charts and retaining the panel state |
| Schema comparison | Analysis suites and browser import/comparison without changing the open schema |
| AI | Mocked streaming and structured responses; abort propagation and prevention of successful completion after cancellation; browser conversation retention and report export |
| Large data and cancellation | 200,000-row numeric summary regression; worker success/failure/abort lifecycle tests; timed 40,000-row browser dump import |
| Offline and hosting | Malformed shared URL remains usable; service-worker-controlled reload restores a saved project, including with a deployment base path |

## Fixes and additions

- SQL preprocessing preserves comment-like text in string literals and quoted identifiers. Native ESM consumers can import the SQL parser; optional AI provider SDKs load only when selected.
- Empty string defaults survive sharing. Malformed fragments do not crash initialization, and changing language does not reset the project.
- Projects save notes, layout, notation, colours, viewport and filters in one validated local record. Failed saves retain in-memory work and offer retry. Legacy diagram records remain readable.
- `.dbschema.json` provides a versioned backup/import format. Recent projects can be reopened or deleted. Project serialization excludes AI settings, chat history and parsed dump rows.
- Browser schema imports, dump imports and fake-data generation run in cancellable workers. Heavy panels and provider SDKs load on demand. Data/chat panels retain state while closed, and reset for a different project session.
- Graph updates index relationships and reuse unchanged nodes. View-only URL updates reuse diagram compression. Search by table/field, namespace filters and direct-neighbour isolation leave the source diagram intact.
- Exports include the whole schema through filters. Image capture waits for React Flow to restore relationships and includes marker definitions. PDF contents use actual rendered page numbers.
- Dump replacement stays available after data is loaded; stale search/pagination state is reset. Large numeric arrays no longer overflow the call stack. Async AI responses are cancelled when their owning operation ends.
- Service-worker installation caches the shell's assets, scopes cleanup to this app, awaits cache writes and returns a defined offline fallback.

## Performance measurements

[Raw microbenchmarks](performance.json) contain 15 measured runs after warm-up. The old graph and repeated-compression algorithms are reproduced in `scripts/benchmark.mjs`; result equivalence is checked. These are timings of specific operations, **not an overall application speedup**.

| Tables | Parse + layout, current median | Relationship lookup, before → after | URL update after view change, before → after |
| ---: | ---: | ---: | ---: |
| 100 | 4.829 ms | 0.108 → 0.020 ms | 4.336 → 0.010 ms |
| 500 | 21.192 ms | 2.600 → 0.072 ms | 24.880 → 0.004 ms |
| 1,000 | 48.055 ms | 9.426 → 0.185 ms | 57.562 → 0.004 ms |

At 1,000 tables, indexed relationship lookup takes about 98% less time in this benchmark. URL timings after the change describe a cache hit for an unchanged diagram; edits to the diagram still require compression.

[Browser measurements](browser-performance.json), Chromium 153 at 1440×900, use three runs per schema size. Median import-to-render times are 240 ms (100 tables), 440 ms (500), and 735 ms (1,000). Median filter times are 28, 74, and 203 ms respectively. A 4,817,820-byte dump with 40,000 rows becomes visible in 931 ms in one run. These are current local results, not before/after browser comparisons or guarantees for other devices. Canvas virtualization was not introduced.

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:ci
pnpm exec playwright install chromium firefox webkit
NEXT_PUBLIC_BASE_PATH=/db-schema-viewer pnpm build
NEXT_PUBLIC_BASE_PATH=/db-schema-viewer pnpm test:e2e
NEXT_OUTPUT_MODE=standalone pnpm exec next build
pnpm build
pnpm benchmark
pnpm benchmark:browser
```

Match the base-path environment between build and browser tests. The test server uses port 43871 and refuses to reuse another server. Benchmarking starts its own server on port 43872. CI now checks browser journeys on static output with a base path and also builds standalone output.

## Limits

AI requests use SDK mocks or intercepted provider responses: no paid provider calls were made, and live credentials, CORS, model availability and response quality were not verified. WebKit's protocol-level offline emulation fails before service-worker dispatch in this environment; its offline test instead cuts server connections for that browser context. Other browsers use Playwright's native offline mode.

Mobile tests are emulation, not physical-device tests. Image/PDF checks use a small representative schema; enormous bitmap exports remain subject to browser canvas and memory limits. PDF font coverage for every writing system was not established. Static hosts must configure HTTP headers themselves: Next.js reports that `headers()` does not apply to static exports. Standalone retains its existing provider allowlist in CSP.

Passing these checks establishes coverage of the listed scenarios, not an exhaustive proof that every possible input is free of bugs.
