import type { Diagram, DatabaseType } from "@/lib/domain";
import type { ParsedColumn, ParsedRelationship } from "@/lib/parsing/types";
import { buildDiagram } from "@/lib/parsing/build-diagram";
import { extractBraceBlock } from "@/lib/parsing/extract-brace-block";

interface DrizzleTable {
  variableName: string;
  tableName: string;
  dialect: "pg" | "mysql" | "sqlite" | "unknown";
  columns: ParsedColumn[];
}

interface CallbackRef {
  sourceTableName: string;
  sourceColumn: string;
  targetVar: string;
  targetColumn: string;
}

/**
 * Parse Drizzle ORM schema.ts content into a Diagram.
 * Beta feature — uses regex-based parsing since we can't run TypeScript in the browser.
 */
export function parseDrizzleSchema(content: string, name?: string): Diagram {
  const tables: DrizzleTable[] = [];
  const relationships: ParsedRelationship[] = [];

  // Detect dialect before stripping imports (imports contain dialect hints)
  const dialect = detectDrizzleDialect(content);
  const databaseType = drizzleDialectToDBType(dialect);

  // Strip imports and TypeScript-only syntax that can interfere with regex parsing
  content = stripTypeScriptImports(content);

  // Extract enum definitions (for callback-syntax type resolution)
  const enumMap = extractPgEnums(content);

  // Extract tables (returns callback-style references that need resolution)
  const callbackRefs = extractDrizzleTables(content, tables, enumMap);

  // Resolve callback references (variable name → table name)
  for (const ref of callbackRefs) {
    const targetTable = tables.find((t) => t.variableName === ref.targetVar);
    const targetTableName = targetTable ? targetTable.tableName : ref.targetVar;
    const sourceTable = tables.find((t) => t.tableName === ref.sourceTableName);
    if (sourceTable) {
      const col = sourceTable.columns.find((c) => c.name === ref.sourceColumn);
      if (col) {
        col.references = { table: targetTableName, column: ref.targetColumn };
      }
    }
    relationships.push({
      sourceTable: ref.sourceTableName,
      sourceColumn: ref.sourceColumn,
      targetTable: targetTableName,
      targetColumn: ref.targetColumn,
    });
  }

  // Extract inline references (`.references(() => table.column)`) — old syntax
  extractInlineReferences(content, tables, relationships);

  // Extract explicit relations (`relations(...)`)
  extractExplicitRelations(content, tables, relationships);

  // Convert to Diagram via shared builder
  const parsedTables = tables.map((dt) => ({
    name: dt.tableName,
    schema: undefined,
    columns: dt.columns,
    indexes: [] as { name: string; columns: string[]; unique: boolean }[],
    isView: false,
  }));

  return buildDiagram(parsedTables, relationships, databaseType, name ?? "Drizzle Schema");
}

// ── Import stripping ──────────────────────────────────────────────

/**
 * Remove TypeScript import statements and $type<...>() annotations
 * that can interfere with regex-based parsing.
 */
function stripTypeScriptImports(content: string): string {
  // Remove single-line and multi-line import statements
  content = content.replace(
    /^\s*import\s[\s\S]*?from\s+["'][^"']*["']\s*;?\s*$/gm,
    "",
  );
  // Remove side-effect imports: import "module";
  content = content.replace(/^\s*import\s+["'][^"']*["']\s*;?\s*$/gm, "");
  // Remove .$type<...>() annotations (reference imported types)
  content = content.replace(/\.\$type\s*<[^>]*>\s*\(\s*\)/g, "");
  return content;
}

// ── Dialect detection ──────────────────────────────────────────────

function detectDrizzleDialect(content: string): DrizzleTable["dialect"] {
  if (/from\s+["']drizzle-orm\/pg-core["']/.test(content)) return "pg";
  if (/from\s+["']drizzle-orm\/mysql-core["']/.test(content)) return "mysql";
  if (/from\s+["']drizzle-orm\/sqlite-core["']/.test(content)) return "sqlite";
  if (/\bpgTable\b/.test(content)) return "pg";
  if (/\bmysqlTable\b/.test(content)) return "mysql";
  if (/\bsqliteTable\b/.test(content)) return "sqlite";
  return "unknown";
}

function drizzleDialectToDBType(dialect: DrizzleTable["dialect"]): DatabaseType {
  switch (dialect) {
    case "pg": return "postgresql";
    case "mysql": return "mysql";
    case "sqlite": return "sqlite";
    default: return "postgresql";
  }
}

// ── Enum extraction ────────────────────────────────────────────────

function extractPgEnums(content: string): Map<string, string> {
  const enums = new Map<string, string>();
  const enumRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*pgEnum\s*\(\s*["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    enums.set(match[1]!, match[2]!);
  }
  return enums;
}

// ── Table extraction ───────────────────────────────────────────────

function extractDrizzleTables(
  content: string,
  tables: DrizzleTable[],
  enumMap: Map<string, string>,
): CallbackRef[] {
  const callbackRefs: CallbackRef[] = [];

  // Match: export const users = pgTable('users', { ... })
  // Also: const users = mysqlTable("users", { ... })
  // Also: const users = createTable("users", (d) => ({ ... }))  (callback syntax)
  const tableRegex =
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:(\w+)Table|(\w+)\.(?:pgTable|mysqlTable|sqliteTable))\s*\(\s*["'`](\w+)["'`]\s*,\s*(?:\(\s*(\w+)\s*\)\s*=>\s*\(\s*)?\{/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const variableName = match[1]!;
    const tableFunc = match[2] || match[3];
    const tableName = match[4]!;
    const callbackParam = match[5]; // e.g., 'd' — undefined for old syntax

    let dialect: DrizzleTable["dialect"] = "unknown";
    if (tableFunc) {
      const lower = tableFunc.toLowerCase();
      if (lower === "pg" || lower.includes("pg")) dialect = "pg";
      else if (lower === "mysql" || lower.includes("mysql")) dialect = "mysql";
      else if (lower === "sqlite" || lower.includes("sqlite")) dialect = "sqlite";
    }

    // Extract the table body using brace counting
    const startIdx = content.indexOf("{", match.index + match[0].length - 1);
    if (startIdx === -1) continue;

    const body = extractBraceBlock(content, startIdx);
    if (!body) continue;

    let columns: ParsedColumn[];
    if (callbackParam) {
      const result = parseDrizzleCallbackColumns(body, callbackParam, enumMap);
      columns = result.columns;
      for (const ref of result.refs) {
        callbackRefs.push({
          sourceTableName: tableName,
          sourceColumn: ref.sourceColumn,
          targetVar: ref.targetVar,
          targetColumn: ref.targetColumn,
        });
      }
    } else {
      columns = parseDrizzleColumns(body);
    }

    tables.push({ variableName, tableName, dialect, columns });
  }

  return callbackRefs;
}

// ── Column parsing (object syntax) ────────────────────────────────

function parseDrizzleColumns(body: string): ParsedColumn[] {
  const columns: ParsedColumn[] = [];

  const colRegex =
    /(\w+)\s*:\s*(\w+)\s*\(([^)]*)\)((?:\s*\.\s*\w+\s*\([^)]*\))*)/g;

  let match;
  while ((match = colRegex.exec(body)) !== null) {
    const fieldName = match[1]!;
    const typeFn = match[2]!;
    const modifiers = match[4] || "";

    if (["primaryKey", "foreignKey", "uniqueIndex", "index", "unique"].includes(typeFn)) {
      continue;
    }

    const isPK = /\.primaryKey\s*\(/.test(modifiers) || typeFn === "serial" || typeFn === "bigserial";
    const isNotNull = /\.notNull\s*\(/.test(modifiers);
    const isUnique = /\.unique\s*\(/.test(modifiers);

    columns.push({
      name: fieldName,
      type: mapDrizzleType(typeFn),
      primaryKey: isPK,
      unique: isUnique,
      nullable: !isNotNull && !isPK,
    });
  }

  return columns;
}

// ── Column parsing (callback syntax) ──────────────────────────────

function splitAtTopLevelCommas(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(body.substring(start, i));
      start = i + 1;
    }
  }

  if (start < body.length) {
    parts.push(body.substring(start));
  }

  return parts;
}

function parseDrizzleCallbackColumns(
  body: string,
  paramName: string,
  enumMap: Map<string, string>,
): {
  columns: ParsedColumn[];
  refs: { sourceColumn: string; targetVar: string; targetColumn: string }[];
} {
  const columns: ParsedColumn[] = [];
  const refs: { sourceColumn: string; targetVar: string; targetColumn: string }[] = [];

  const fields = splitAtTopLevelCommas(body);

  for (const field of fields) {
    const trimmed = field.trim();
    if (!trimmed) continue;

    const nameMatch = /^(\w+)\s*:/.exec(trimmed);
    if (!nameMatch) continue;

    const fieldName = nameMatch[1]!;

    // Try callback syntax: fieldName: d.typeFn(...)
    const callbackTypeRegex = new RegExp(
      `:\\s*${paramName}\\s*\\.\\s*(\\w+)\\s*\\(`,
    );
    const typeMatch = callbackTypeRegex.exec(trimmed);
    let typeFn: string;

    if (typeMatch) {
      typeFn = typeMatch[1]!;
    } else {
      // Try standalone function (e.g., pgEnum): fieldName: enumFn(...)
      const standaloneMatch = /:\s*(\w+)\s*\(/.exec(trimmed);
      if (!standaloneMatch) continue;
      typeFn = standaloneMatch[1]!;
      const enumName = enumMap.get(typeFn);
      if (enumName) {
        typeFn = enumName;
      }
    }

    if (
      ["primaryKey", "foreignKey", "uniqueIndex", "index", "unique"].includes(typeFn)
    ) {
      continue;
    }

    const isPK =
      /\.primaryKey\s*\(/.test(trimmed) ||
      typeFn === "serial" ||
      typeFn === "bigserial";
    const isNotNull = /\.notNull\s*\(/.test(trimmed);
    const isUnique = /\.unique\s*\(/.test(trimmed);

    const col: ParsedColumn = {
      name: fieldName,
      type: mapDrizzleType(typeFn),
      primaryKey: isPK,
      unique: isUnique,
      nullable: !isNotNull && !isPK,
    };

    // Check for .references(() => varName.col)
    const refMatch = /\.references\s*\(\s*\(\)\s*=>\s*(\w+)\.(\w+)/.exec(trimmed);
    if (refMatch) {
      refs.push({
        sourceColumn: fieldName,
        targetVar: refMatch[1]!,
        targetColumn: refMatch[2]!,
      });
    }

    columns.push(col);
  }

  return { columns, refs };
}

// ── Inline references (old syntax, whole-file scan) ───────────────

function extractInlineReferences(
  content: string,
  tables: DrizzleTable[],
  relationships: ParsedRelationship[],
): void {
  for (const table of tables) {
    const tableDefRegex = new RegExp(
      `(?:export\\s+)?const\\s+${table.variableName}\\s*=`,
    );
    const tableMatch = tableDefRegex.exec(content);
    if (!tableMatch) continue;

    const startIdx = content.indexOf("{", tableMatch.index);
    if (startIdx === -1) continue;
    const body = extractBraceBlock(content, startIdx);
    if (!body) continue;

    const refRegex =
      /(\w+)\s*:\s*\w+\s*\([^)]*\)(?:\s*\.\s*\w+\s*\([^)]*\))*\s*\.references\s*\(\s*\(\)\s*=>\s*(\w+)\.(\w+)\s*\)/g;

    let refMatch;
    while ((refMatch = refRegex.exec(body)) !== null) {
      const sourceColumn = refMatch[1]!;
      const targetVar = refMatch[2]!;
      const targetColumn = refMatch[3]!;

      const targetTable = tables.find((t) => t.variableName === targetVar);
      const targetTableName = targetTable ? targetTable.tableName : targetVar;

      relationships.push({
        sourceTable: table.tableName,
        sourceColumn,
        targetTable: targetTableName,
        targetColumn,
      });

      const col = table.columns.find((c) => c.name === sourceColumn);
      if (col) {
        col.references = { table: targetTableName, column: targetColumn };
      }
    }
  }
}

// ── Explicit relations() blocks ───────────────────────────────────

function extractExplicitRelations(
  content: string,
  tables: DrizzleTable[],
  relationships: ParsedRelationship[],
): void {
  const relBlockRegex =
    /relations\s*\(\s*(\w+)\s*,\s*\(\s*\{[^}]*\}\s*\)\s*=>\s*\(\s*\{([\s\S]*?)\}\s*\)\s*,?\s*\)/g;

  let blockMatch;
  while ((blockMatch = relBlockRegex.exec(content)) !== null) {
    const body = blockMatch[2]!;

    const entryRegex =
      /\w+\s*:\s*(?:one|many)\s*\(\s*(\w+)\s*,\s*\{[^}]*fields\s*:\s*\[\s*(\w+)\.(\w+)\s*\][^}]*references\s*:\s*\[\s*(\w+)\.(\w+)\s*\]/g;

    let entryMatch;
    while ((entryMatch = entryRegex.exec(body)) !== null) {
      const fieldsTableVar = entryMatch[2]!;
      const fieldsCol = entryMatch[3]!;
      const refsTableVar = entryMatch[4]!;
      const refsCol = entryMatch[5]!;

      const fieldsTable = tables.find((t) => t.variableName === fieldsTableVar);
      const refsTable = tables.find((t) => t.variableName === refsTableVar);

      const fieldsTableName = fieldsTable ? fieldsTable.tableName : fieldsTableVar;
      const refsTableName = refsTable ? refsTable.tableName : refsTableVar;

      const exists = relationships.some(
        (r) =>
          r.sourceTable === fieldsTableName &&
          r.sourceColumn === fieldsCol &&
          r.targetTable === refsTableName &&
          r.targetColumn === refsCol,
      );

      if (!exists) {
        relationships.push({
          sourceTable: fieldsTableName,
          sourceColumn: fieldsCol,
          targetTable: refsTableName,
          targetColumn: refsCol,
        });
      }
    }
  }
}

// ── Type mapping ──────────────────────────────────────────────────

function mapDrizzleType(fn: string): string {
  const map: Record<string, string> = {
    serial: "SERIAL",
    bigserial: "BIGSERIAL",
    integer: "INTEGER",
    int: "INT",
    smallint: "SMALLINT",
    bigint: "BIGINT",
    boolean: "BOOLEAN",
    text: "TEXT",
    varchar: "VARCHAR",
    char: "CHAR",
    uuid: "UUID",
    timestamp: "TIMESTAMP",
    date: "DATE",
    time: "TIME",
    json: "JSON",
    jsonb: "JSONB",
    real: "REAL",
    doublePrecision: "DOUBLE PRECISION",
    numeric: "NUMERIC",
    decimal: "DECIMAL",
    blob: "BLOB",
    mysqlEnum: "ENUM",
    tinyint: "TINYINT",
    mediumint: "MEDIUMINT",
    float: "FLOAT",
    double: "DOUBLE",
    sqliteInteger: "INTEGER",
    sqliteText: "TEXT",
    sqliteReal: "REAL",
    sqliteBlob: "BLOB",
  };
  return map[fn] || fn.toUpperCase();
}
