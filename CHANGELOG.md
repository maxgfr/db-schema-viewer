## [1.1.1](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.0...v1.1.1) (2026-04-02)


### Bug Fixes

* move oxc-parser from optionalDependencies to devDependencies ([5329690](https://github.com/maxgfr/db-schema-viewer/commit/5329690cb47d5a1474f7408c728e928511afdba9))

# [1.1.0](https://github.com/maxgfr/db-schema-viewer/compare/v1.0.0...v1.1.0) (2026-04-02)


### Features

* add CLI to db-schema-toolkit and improve editor UX ([506f73d](https://github.com/maxgfr/db-schema-viewer/commit/506f73dda589201a235ce4cc1334999557d39fbd))

# 1.0.0 (2026-04-02)


### Bug Fixes

* add file read error handling and improve type safety ([7f72ced](https://github.com/maxgfr/db-schema-viewer/commit/7f72ced3765b3864870d942c7c83cd3280389e5d))
* add markdown copy and mermaid download to export dialog ([2e94a78](https://github.com/maxgfr/db-schema-viewer/commit/2e94a78daafc65615ab12d6d677dcda9a720e804))
* add package build step to deploy workflow and fix Docker workspace ([dc2cfe7](https://github.com/maxgfr/db-schema-viewer/commit/dc2cfe7011e328d54b4115f7c447f98ddd6ebde4))
* add test coverage for schema analysis and SQL exports ([f3a4ed3](https://github.com/maxgfr/db-schema-viewer/commit/f3a4ed3f5421f9a6559a85719741050fb1d196d2))
* align release workflow with csv-ai-analyzer pattern ([7318be9](https://github.com/maxgfr/db-schema-viewer/commit/7318be98976b9119862365982c89981d2c09ddaa))
* blob download race condition, add Mermaid to Markdown export, full-pipeline export tests ([0706162](https://github.com/maxgfr/db-schema-viewer/commit/07061621d7a3e7c65cc1dd6ed5c77e37efabebf8))
* image export theme, keyboard shortcut conflict, export dialog layout + add missing tests ([ac66691](https://github.com/maxgfr/db-schema-viewer/commit/ac6669149127efed8f97b997cc864a225c9f5caa)), closes [#0f172a](https://github.com/maxgfr/db-schema-viewer/issues/0f172a)
* improve dark mode colors and refactor modal rendering ([2a41d28](https://github.com/maxgfr/db-schema-viewer/commit/2a41d2828c71dd268c94e4fd3914613e835ee01f))
* improve hidden handle rendering and debounce URL sync ([b62e180](https://github.com/maxgfr/db-schema-viewer/commit/b62e180fb21856f08985ae71db28d2414dff261b))
* include sticky note annotations in shared URL state ([e349763](https://github.com/maxgfr/db-schema-viewer/commit/e3497631a05c0c5734d392be959eb31c55ceec8c))
* Mermaid cardinality notation and full diagram image export ([d229a58](https://github.com/maxgfr/db-schema-viewer/commit/d229a584dc5a083d8fcefd69977e652db4b7d4a2))
* Refactor DataChat and DataExplorer components; introduce DataExplorerContext for state management ([71e9298](https://github.com/maxgfr/db-schema-viewer/commit/71e9298bac8c8793a73bca8c95a0365e4d669b68))
* resolve shared patterns in ORM schemas via inlining and inheritance ([5904cb3](https://github.com/maxgfr/db-schema-viewer/commit/5904cb3c06d696dc140202a6d88468b5c4ddab23))
* sync sticky note annotations with React Flow nodes ([3d8e237](https://github.com/maxgfr/db-schema-viewer/commit/3d8e23710ac1263400e394ffc220aa64f3078923))
* sync sticky note annotations with React Flow nodes ([c14ae63](https://github.com/maxgfr/db-schema-viewer/commit/c14ae6355bb12130ec05caebdc066814643a064d))
* upgrade semantic-release to v25 for OIDC npm publishing ([6f42371](https://github.com/maxgfr/db-schema-viewer/commit/6f42371e0822370ea43d231a4c1701895df8cb7c))
* use npx tsup in semantic-release exec instead of pnpm --filter ([e96fff3](https://github.com/maxgfr/db-schema-viewer/commit/e96fff376299bced3ab5c5bdb024ff4e997cc85b))


### Features

* add AI-powered data chat to schema data explorer ([f17c24c](https://github.com/maxgfr/db-schema-viewer/commit/f17c24c3c0c1e6ed337253fd79775dc492d8adcb))
* add chat reset and improve table switching in data components ([81ab6a1](https://github.com/maxgfr/db-schema-viewer/commit/81ab6a1fa6be664541d919b01dd47506961ebde3))
* add Drizzle ORM parser (beta), dark/light theme, full DB test coverage ([be50962](https://github.com/maxgfr/db-schema-viewer/commit/be50962ba279619be504b6f45cba42716504f29f))
* add fake data generator for testing schema with realistic data ([eacc819](https://github.com/maxgfr/db-schema-viewer/commit/eacc819677c75a113e6db1bc414920b3ac2eff42))
* add GitHub repository link to editor toolbar ([9d65f08](https://github.com/maxgfr/db-schema-viewer/commit/9d65f081251e5dc332a74c89daec07d2923705fa))
* add GitHub star button in hero and footer links ([1c2abfd](https://github.com/maxgfr/db-schema-viewer/commit/1c2abfddb9e2a9625d7312ba402d2a52e0910991))
* add internationalization with English and French support ([c1ba8f6](https://github.com/maxgfr/db-schema-viewer/commit/c1ba8f64f7859be9d239195461d4b101adc00dfa))
* add markdown rendering and reset controls ([6bdb10c](https://github.com/maxgfr/db-schema-viewer/commit/6bdb10c3063ac86b4b60d8c7a95bb298cbae76c4))
* add multi-table support to data chat and analysis ([6a4423b](https://github.com/maxgfr/db-schema-viewer/commit/6a4423b3d73eee56f74d97c091e9eda6a84a1e81))
* add Prisma schema parser (beta) with full test coverage ([a8b84ec](https://github.com/maxgfr/db-schema-viewer/commit/a8b84ec568de03f721181f117618018b1d3fd5b5))
* add SEO metadata, PWA manifest, and social sharing ([502e081](https://github.com/maxgfr/db-schema-viewer/commit/502e081aa495903e9dbf217237795e0657da99f0))
* AI-powered chart suggestions and custom chart generation ([43c0a31](https://github.com/maxgfr/db-schema-viewer/commit/43c0a3144ef6b7be934961436dfd5c93f9283b71))
* Docker support, security hardening, local-only AI messaging ([dc53405](https://github.com/maxgfr/db-schema-viewer/commit/dc5340568d53b3ecc9be780ed3ff51427f63784d))
* dynamic model catalog from models.dev + UI/UX improvements ([cf6cdb4](https://github.com/maxgfr/db-schema-viewer/commit/cf6cdb4b01469f3ee2553a71a90a8dee0f8c74f9))
* enhance DataExplorer with source tracking and improved UI ([cc0a106](https://github.com/maxgfr/db-schema-viewer/commit/cc0a1061b70bd7a53057762c944f1a29bf27b633))
* enhance diagram schema and parser ([0b1f313](https://github.com/maxgfr/db-schema-viewer/commit/0b1f3137cd78966230486898a3ccc128aeed7907))
* extract db-schema-toolkit npm package ([ad734e1](https://github.com/maxgfr/db-schema-viewer/commit/ad734e12bc2d710da865345dc7e5818b1d1a4ad0))
* guided upload wizard, remove Beta labels, improve Data Explorer, add CLAUDE.md ([56b7e3a](https://github.com/maxgfr/db-schema-viewer/commit/56b7e3ab86b1435ee53e33512653eb33252bc145))
* iteration 8 - polish, keyboard shortcuts, sample schemas, Radix UI components ([9ef816c](https://github.com/maxgfr/db-schema-viewer/commit/9ef816c8e316e8d7d411962bd057519edc737c1f))
* roadmap features - DBML/TypeORM parsers, schema diff, ERD notation, Prisma/Drizzle export, templates ([317259c](https://github.com/maxgfr/db-schema-viewer/commit/317259cfb2f61ceef4492cade40be4844c7ee0f0))
* schema analysis engine, export formats, enhanced UI components ([b1d79ca](https://github.com/maxgfr/db-schema-viewer/commit/b1d79ca8c86e3d280fcda7aef691414d3d269450))
* support Drizzle callback syntax and pgTableCreator parsing ([f7d5c5a](https://github.com/maxgfr/db-schema-viewer/commit/f7d5c5a496437068eaa84f73ab6f40cfdfe0d0fd))
* use hash fragment for URL sharing instead of query param ([5933fdd](https://github.com/maxgfr/db-schema-viewer/commit/5933fdd28cbdfcc8ac783cf5782b521093bf9ed3))
