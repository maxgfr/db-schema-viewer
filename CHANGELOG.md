# [3.0.0](https://github.com/maxgfr/db-schema-viewer/compare/v2.1.6...v3.0.0) (2026-11-02)


### Bug Fixes

* **storage:** keep projects in IndexedDB and name all storage after the app ([#25](https://github.com/maxgfr/db-schema-viewer/issues/25)) ([85f391d](https://github.com/maxgfr/db-schema-viewer/commit/85f391d0268d79c48c504a87b0a3fe4cee7aa608))


### BREAKING CHANGES

* **storage:** for db-schema-toolkit's peers), so a save is read back,
  key included, and the dialog says when the settings only last for the page
  (all eight locales).

* test(settings): mock the kept-settings check and cover the storage-full warning

* fix(settings): free the old db-sv-ai-settings entry before writing the new one

With localStorage nearly full, the renamed copy might not fit beside the old
one. Remove the old preferences first, put them back if the new copy does
not read back, and retry on the next load.

## [2.1.6](https://github.com/maxgfr/db-schema-viewer/compare/v2.1.5...v2.1.6) (2026-10-17)


### Bug Fixes

* keep the AI settings footer in place while the model list loads ([49854d2](https://github.com/maxgfr/db-schema-viewer/commit/49854d28c6970067e7f7c0809c48102ebb03ef1d)), closes [#17](https://github.com/maxgfr/db-schema-viewer/issues/17)

## [2.1.5](https://github.com/maxgfr/db-schema-viewer/compare/v2.1.4...v2.1.5) (2026-10-17)


### Bug Fixes

* add sticky notes where the canvas is visible ([b020b96](https://github.com/maxgfr/db-schema-viewer/commit/b020b963d78da65290c1140583787566dc3ebdc6)), closes [#21](https://github.com/maxgfr/db-schema-viewer/issues/21)

## [2.1.4](https://github.com/maxgfr/db-schema-viewer/compare/v2.1.3...v2.1.4) (2026-10-17)


### Bug Fixes

* **deps:** llm-models 1.10.0, so the model picker only lists chat models ([00ef059](https://github.com/maxgfr/db-schema-viewer/commit/00ef0595f76ce6aed427b0783cb2458a53d9ca95)), closes [#19](https://github.com/maxgfr/db-schema-viewer/issues/19)

## [2.1.3](https://github.com/maxgfr/db-schema-viewer/compare/v2.1.2...v2.1.3) (2026-10-17)


### Bug Fixes

* give the diff AI each change with its values, and translate the diff summary ([f22afc0](https://github.com/maxgfr/db-schema-viewer/commit/f22afc090f9643d4569a07e398495685a02845e5)), closes [#15](https://github.com/maxgfr/db-schema-viewer/issues/15)

## [2.1.2](https://github.com/maxgfr/db-schema-viewer/compare/v2.1.1...v2.1.2) (2026-10-17)


### Bug Fixes

* bin chart dates in UTC so first-of-month dates stay in their month ([c75d424](https://github.com/maxgfr/db-schema-viewer/commit/c75d4248687ba09ee51f99a7099eaf6a9e9a1e7f)), closes [#13](https://github.com/maxgfr/db-schema-viewer/issues/13)

## [2.1.1](https://github.com/maxgfr/db-schema-viewer/compare/v2.1.0...v2.1.1) (2026-10-16)


### Bug Fixes

* **toolkit:** send the rows to the data chat instead of letting the model guess them ([11af991](https://github.com/maxgfr/db-schema-viewer/commit/11af991d0257f1e69293c7a1acb83de6bbc4e154)), closes [#11](https://github.com/maxgfr/db-schema-viewer/issues/11)

# [2.1.0](https://github.com/maxgfr/db-schema-viewer/compare/v2.0.0...v2.1.0) (2026-10-16)


### Features

* live model catalog, key encrypted for the tab, settings shared with csv-ai-analyzer ([38e51e0](https://github.com/maxgfr/db-schema-viewer/commit/38e51e0bf0bf39fd7d4798f0d919bc219fecdc6a)), closes [#9](https://github.com/maxgfr/db-schema-viewer/issues/9)
* **toolkit:** read the response language as a code or a name ([6d6c1b3](https://github.com/maxgfr/db-schema-viewer/commit/6d6c1b3eb22a5f9da0eb66fedfcc56bde6bbba1c)), closes [#9](https://github.com/maxgfr/db-schema-viewer/issues/9)

# [2.0.0](https://github.com/maxgfr/db-schema-viewer/compare/v1.3.1...v2.0.0) (2026-10-16)


* feat(toolkit)!: create models through llm-connect, on ai v6 ([9d8c18b](https://github.com/maxgfr/db-schema-viewer/commit/9d8c18b46bea4090a6866beb0587c0bec4268661)), closes [#7](https://github.com/maxgfr/db-schema-viewer/issues/7)


### BREAKING CHANGES

* the ai peer dependency moves from ^5 to ^6 and the
@ai-sdk/* peers from ^2 to ^3 (@ai-sdk/openai-compatible ^2 is a new
optional peer). AISettings.providerId is optional.

## [1.3.1](https://github.com/maxgfr/db-schema-viewer/compare/v1.3.0...v1.3.1) (2026-10-12)


### Bug Fixes

* **toolkit:** read TypeORM join tables, column name options and merged FK columns ([9cd1d60](https://github.com/maxgfr/db-schema-viewer/commit/9cd1d60d5f990d33411586c063e951ab07c0a066))
* **toolkit:** use SQL column names from Drizzle schemas ([916d2d6](https://github.com/maxgfr/db-schema-viewer/commit/916d2d6c946833235e421818eec02d5580da7fd1))
* **web:** keep each Web Worker on its own script behind the service worker ([4ad58b2](https://github.com/maxgfr/db-schema-viewer/commit/4ad58b2b25778bcb299278542f6ad7bb61b440f7))

# [1.3.0](https://github.com/maxgfr/db-schema-viewer/compare/v1.2.0...v1.3.0) (2026-10-12)


### Bug Fixes

* **toolkit:** correct exporters, schema analyzer and CLI flags ([507daf3](https://github.com/maxgfr/db-schema-viewer/commit/507daf3f5bce8f53321fdcaa672bf497d0e97fc0))
* **toolkit:** harden schema parsers and resolve schema-qualified tables ([6d6101f](https://github.com/maxgfr/db-schema-viewer/commit/6d6101fd5ef94ace717a7776a56be5c17ea94eaf))
* **toolkit:** realistic fake data and non-overlapping shuffle layout ([09e4b4b](https://github.com/maxgfr/db-schema-viewer/commit/09e4b4b1f9134e7bd02f640e312330e0aa3e4b29))
* **web:** encrypt the AI key at rest and enforce a CSP on GitHub Pages ([232394a](https://github.com/maxgfr/db-schema-viewer/commit/232394a9343a4e6b8de28028aabd4bab45fb4b46))
* **web:** keep tables on Backspace and export images with orphan relationships ([73d8feb](https://github.com/maxgfr/db-schema-viewer/commit/73d8febfbab3cc63f58d385736912ab5ba3458d8))
* **web:** keyboard, screen reader and IME fixes across dialogs and panels ([a432366](https://github.com/maxgfr/db-schema-viewer/commit/a43236679214106dbf24123e97ede92de7eb568e))
* **web:** never overwrite a local project when opening a link or file ([9bd4a05](https://github.com/maxgfr/db-schema-viewer/commit/9bd4a05304376c15bb20324b7c5bec0819dd269d))


### Features

* **web:** generate a slim model catalog with llm-models ([2da1f48](https://github.com/maxgfr/db-schema-viewer/commit/2da1f481eba960fb2d12aa3de62cd342a7f9c486))

# [1.2.0](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.13...v1.2.0) (2026-09-08)


### Features

* add persistent projects and improve viewer reliability ([f05785a](https://github.com/maxgfr/db-schema-viewer/commit/f05785a5bd8338f505fd26f7d3d33729ee7d9a84))

## [1.1.13](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.12...v1.1.13) (2026-04-06)


### Bug Fixes

* remove redundant push trigger for Docker builds on main ([dc98b6c](https://github.com/maxgfr/db-schema-viewer/commit/dc98b6cf0c76675357d9dd90e9264d400fc03871))

## [1.1.12](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.11...v1.1.12) (2026-04-06)


### Bug Fixes

* prevent concurrent docker builds ([81f5075](https://github.com/maxgfr/db-schema-viewer/commit/81f50755106db17441aa13dbc7ff5084211e49c1))

## [1.1.11](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.10...v1.1.11) (2026-04-06)


### Bug Fixes

* Remove pretty-printing from JSON output in fetch-models script ([f20ce35](https://github.com/maxgfr/db-schema-viewer/commit/f20ce351a99b34d136deff7ce342963d16c1684c))

## [1.1.10](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.9...v1.1.10) (2026-04-06)


### Bug Fixes

* restore sourceContent from storage for shared diagram URLs ([fbb6cdf](https://github.com/maxgfr/db-schema-viewer/commit/fbb6cdf444b5b01af4d3ba37ce927a1679c46fd5))

## [1.1.9](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.8...v1.1.9) (2026-04-06)


### Bug Fixes

* implement network-first strategy for HTML pages in service worker ([8896890](https://github.com/maxgfr/db-schema-viewer/commit/8896890dcc5e1637d92b5cc491c4f36f2e2a93a5))

## [1.1.8](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.7...v1.1.8) (2026-04-06)


### Bug Fixes

* use querySchema for AI provider connection testing ([12c6fd6](https://github.com/maxgfr/db-schema-viewer/commit/12c6fd66aeca057c07b1b2ccdb78b6dfe9905da9))

## [1.1.7](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.6...v1.1.7) (2026-04-06)


### Bug Fixes

* use Chat Completions API for custom AI endpoints ([fca5ef9](https://github.com/maxgfr/db-schema-viewer/commit/fca5ef9f3a3341ee62e7fc67a444233454385859))

## [1.1.6](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.5...v1.1.6) (2026-04-06)


### Bug Fixes

* add multilingual support and local model setup ([34d6c6a](https://github.com/maxgfr/db-schema-viewer/commit/34d6c6a31919a8a3eb48b994e7e269fbf831f157))
* use proper Chinese quotation marks in zh translations ([a688740](https://github.com/maxgfr/db-schema-viewer/commit/a68874071928d9a1333e83952f733cf23665f8d9))

## [1.1.5](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.4...v1.1.5) (2026-04-04)


### Bug Fixes

* add language setting for AI responses ([4a48ff9](https://github.com/maxgfr/db-schema-viewer/commit/4a48ff940cca3cdf66dd29dbfdcdc87456f4cbd8))

## [1.1.4](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.3...v1.1.4) (2026-04-03)


### Bug Fixes

* add dark theme styles for canvas and fix release order ([3a449ca](https://github.com/maxgfr/db-schema-viewer/commit/3a449cac30a8f6208260ebc6d3a27320bcaa12ee))

## [1.1.3](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.2...v1.1.3) (2026-04-03)


### Bug Fixes

* document CLI commands and add package documentation guide ([639939d](https://github.com/maxgfr/db-schema-viewer/commit/639939d373684235b1c9dd697d395425d93d51ce))

## [1.1.2](https://github.com/maxgfr/db-schema-viewer/compare/v1.1.1...v1.1.2) (2026-04-03)


### Bug Fixes

* improve CLI with missing features and doc fixes ([88daefc](https://github.com/maxgfr/db-schema-viewer/commit/88daefcaa6e1a2b62ae3b9e7c0df197e1c96b873))

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
