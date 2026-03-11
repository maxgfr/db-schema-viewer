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

### Analyse de schéma avancée

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Relations détaillées sur le canvas** | Afficher la cardinalité complète (0..1, 1..1, 0..N, 1..N) sur les edges avec notation crow's foot, Chen ou UML au choix | Haute |
| **Détection des anti-patterns** | Identifier automatiquement (sans AI) : tables sans PK, colonnes nullable FK, tables orphelines, FKs manquants évidents, colonnes `data`/`misc`/`info` suspectes | Haute |
| **Score de qualité local** | Calculer un score (0-100) de qualité du schéma côté client (sans AI) : conventions de nommage, normalisation, couverture des index, cohérence des types | Haute |
| **Métriques de schéma** | Nombre de tables, champs, relations, densité relationnelle, profondeur de hiérarchie FK, composantes connectées | Moyenne |
| **Détection de types incohérents** | Signaler quand la même colonne logique (ex: `user_id`) a des types différents dans plusieurs tables | Moyenne |
| **Validation de normalisation** | Détecter les violations de 1NF/2NF/3NF (colonnes multi-valeurs, dépendances transitives) côté client | Basse |

### AI — Ce qu'on peut faire de plus

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Génération de migration SQL** | L'AI propose des migrations pour corriger les problèmes détectés (ADD INDEX, ALTER COLUMN, etc.) en SQL natif pour le dialecte source | Haute |
| **Suggestion d'indexes** | Analyser les FK et les patterns de colonnes pour recommander des INDEX/UNIQUE manquants | Haute |
| **Explain en langage naturel** | "Explique-moi ce schéma comme si j'étais un PM" — résumé business-friendly du modèle de données | Haute |
| **Comparaison de schémas** | Uploader 2 schémas, l'AI décrit les différences et évalue la migration | Moyenne |
| **Génération de requêtes** | "Donne-moi la requête pour récupérer les commandes d'un utilisateur avec les produits" — SQL contextuel | Moyenne |
| **Review par catégorie** | Filtrer le challenge AI par catégorie (sécurité seule, performance seule, naming seul) | Moyenne |
| **Export du rapport AI** | Télécharger le résultat du challenge en JSON, Markdown ou PDF | Moyenne |
| **Historique des challenges** | Comparer le score avant/après correction pour suivre l'amélioration | Basse |
| **Suggestions de tests SQL** | L'AI propose des requêtes de test pour valider les contraintes du schéma | Basse |

### Data & Charts

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Tri par colonne** | Cliquer sur un header pour trier ASC/DESC | Haute |
| **Recherche dans les données** | Filtrer les lignes par valeur dans n'importe quelle colonne | Haute |
| **Stats automatiques** | Min, Max, Avg, Median, Distinct count par colonne numérique | Haute |
| **Export CSV** | Télécharger les données affichées en CSV | Moyenne |
| **Histogrammes** | Distribution des valeurs pour les colonnes numériques | Moyenne |
| **Drag-and-drop upload** | Glisser-déposer le dump SQL directement sur la zone de données | Moyenne |
| **Corrélation matrix** | Matrice de corrélation entre colonnes numériques (heatmap) | Basse |
| **Date binning** | Grouper automatiquement les colonnes date par jour/semaine/mois/année | Basse |

### Export & Partage

| Feature | Description | Priorité |
|---------|-------------|----------|
| **PDF multi-pages** | Page 1 = diagramme, pages suivantes = détail par table (champs, types, FK, indexes) | Haute |
| **SQL export amélioré** | ON DELETE/UPDATE CASCADE, INDEX, CHECK, COMMENT ON, ENUM, CREATE VIEW | Haute |
| **Export Markdown** | Table récapitulative de chaque table au format Markdown (pour les docs) | Moyenne |
| **Export DBML** | Convertir le schéma au format DBML (dbdiagram.io) | Moyenne |
| **Export Mermaid** | Générer un diagramme ERD au format Mermaid (pour les README GitHub) | Moyenne |
| **Export PlantUML** | Générer un schéma PlantUML | Basse |
| **Embed snippet** | Générer un `<iframe>` embarquable avec le schéma encodé | Basse |

### ORM Loaders supplémentaires (Beta)

| ORM | Pattern à parser | Priorité |
|-----|-----------------|----------|
| **TypeORM** | `@Entity()`, `@Column()`, `@PrimaryGeneratedColumn()`, `@ManyToOne()`, `@OneToMany()` | Moyenne |
| **DBML** | `Table users { id int [pk] }`, `Ref: posts.user_id > users.id` | Moyenne |
| **Sequelize** | `define('User', { ... })`, `belongsTo()`, `hasMany()` | Basse |
| **MikroORM** | `@Entity()`, `@Property()`, `@ManyToOne()` | Basse |
| **Kysely** | `interface Database { users: UsersTable }` + migrations | Basse |

### Tests à ajouter

| Catégorie | Tests manquants | Priorité |
|-----------|----------------|----------|
| **AI prompts** | Tester `schemaToPromptContext()` : format de sortie, gestion des cas limites (0 tables, tables sans champs, noms spéciaux) | Haute |
| **SQL export roundtrip** | Parser un SQL → exporter vers un autre dialecte → re-parser et vérifier que les tables/FK sont préservées | Haute |
| **Drizzle edge cases** | `.default(sql`...`)`, enums, multi-line definitions, commentaires dans le code, imports aliasés | Haute |
| **Prisma edge cases** | `@@map`, `@map`, relations many-to-many explicites, `@ignore`, composite FK, views | Haute |
| **URL sharing roundtrip** | Encoder un gros schéma → décoder → vérifier l'intégrité complète (y compris positions) | Moyenne |
| **Auto-layout** | Tester avec 50+ tables, composantes déconnectées, self-references | Moyenne |
| **Dump parser edge cases** | Caractères Unicode, valeurs NULL mixtes, INSERT avec SELECT, multi-line values | Moyenne |
| **Type inference** | Tester UUID, JSON, dates ISO complètes, valeurs monétaires, pourcentages | Moyenne |
| **Integration tests** | Tester le flux complet upload → parse → layout → export (avec Testing Library) | Basse |
| **Performance tests** | Mesurer le temps de parsing pour des schémas de 100+, 500+, 1000+ tables | Basse |

### UX & UI

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Notation ERD toggle** | Basculer entre crow's foot, Chen, et UML pour les relations | Haute |
| **Zoom sur table** | Double-clic sur une table dans le sidebar = zoom + centrage | Moyenne |
| **Sidebar stats enrichies** | Nb champs, nb FK, nb index par table + indicateurs visuels | Moyenne |
| **Table grouping** | Grouper les tables par schema (public, auth, etc.) dans le sidebar | Moyenne |
| **Expand/Collapse all** | Boutons pour tout développer/réduire dans le sidebar | Moyenne |
| **Annotations canvas** | Post-its cliquables sur le canvas pour ajouter des notes | Basse |
| **PWA** | Service worker, mode offline, installation locale | Basse |
| **i18n** | Support FR/EN | Basse |

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

## Ce que cette approche "tout en local" permet

L'avantage fondamental d'un viewer 100% client-side est qu'il peut être utilisé :

1. **En entreprise sans crainte de fuite** — aucune donnée de schéma ne transite par un serveur tiers. L'outil peut être déployé sur un intranet ou utilisé offline.

2. **Pour l'audit de sécurité** — analyser un schéma de production sans l'exposer. Le challenge AI envoie uniquement la structure (noms de tables/colonnes/types), jamais les données.

3. **Pour la documentation** — générer des PDF multi-pages avec le diagramme + la liste des tables/champs à inclure dans une doc technique.

4. **Pour l'enseignement** — les étudiants peuvent visualiser et comprendre les relations (0..1, 1..N, N:M), les clés primaires, les foreign keys sans installer de SGBD.

5. **Pour le code review** — uploader un schema.prisma ou un schema.ts directement depuis le repo, visualiser les relations, puis lancer un challenge AI pour détecter les problèmes avant le merge.

6. **Pour la migration** — importer un schéma PostgreSQL, l'exporter en MySQL pour voir les différences de types, détecter les incompatibilités.

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
