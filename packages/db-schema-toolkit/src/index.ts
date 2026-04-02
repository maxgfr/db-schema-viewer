// ── Domain types ────────────────────────────────────────────────
export {
  DatabaseType,
  DATABASE_TYPE_LABELS,
  Cardinality,
  DBField,
  DBIndex,
  DBTable,
  DBRelationship,
  Diagram,
} from "./domain/index";

// ── Parsing ─────────────────────────────────────────────────────
export { parseSchemaFile, detectFormat } from "./parsing/parse-schema-file";
export { buildDiagram } from "./parsing/build-diagram";
export { extractBraceBlock } from "./parsing/extract-brace-block";
export {
  inlineHelperFunctions,
  inlineObjectSpreads,
  resolveClassInheritance,
} from "./parsing/inline-helpers";
export type {
  ParsedColumn,
  ParsedIndex,
  ParsedTable,
  ParsedRelationship,
  ParseResult,
} from "./parsing/types";

// ── SQL ─────────────────────────────────────────────────────────
export { parseSQLToDiagram, parseSQLWithType } from "./sql/index";
export { detectDatabaseType } from "./sql/detect-db-type";

// ── ORM parsers ─────────────────────────────────────────────────
export { parseDrizzleSchema } from "./drizzle/drizzle-parser";
export { parsePrismaSchema } from "./prisma/prisma-parser";
export { parseDBMLSchema } from "./dbml/dbml-parser";
export { parseTypeORMSchema } from "./typeorm/typeorm-parser";
export { parseMikroORMSchema } from "./mikroorm/mikroorm-parser";
export { parseSequelizeSchema } from "./sequelize/sequelize-parser";
export { parseKyselySchema } from "./kysely/kysely-parser";

// ── Layout ──────────────────────────────────────────────────────
export { autoLayout, shuffleLayout } from "./layout/auto-layout";

// ── Sharing (pure logic) ────────────────────────────────────────
export { encodeState, decodeState } from "./sharing/encode-state";
export type { SharedAnnotation } from "./sharing/encode-state";

// ── Utilities ───────────────────────────────────────────────────
export { generateId, getTableColor, TABLE_COLORS } from "./utils";

// ── Samples, templates & examples ───────────────────────────────
export { SAMPLE_SCHEMAS } from "./sql/sample-schemas";
export type { SampleSchema } from "./sql/sample-schemas";
export { SCHEMA_TEMPLATES } from "./sql/schema-templates";
export type { SchemaTemplate } from "./sql/schema-templates";
export { EXAMPLE_SCHEMAS } from "./examples/example-schemas";
