import type { Diagram, DatabaseType } from "@/lib/domain";
import { generateId, getTableColor } from "@/lib/utils";
import type { ParsedColumn, ParsedRelationship } from "@/lib/sql/sql-import";

interface DrizzleTable {
  variableName: string;
  tableName: string;
  dialect: "pg" | "mysql" | "sqlite" | "unknown";
  columns: ParsedColumn[];
}

/**
 * Parse Drizzle ORM schema.ts content into a Diagram.
 * Beta feature — uses regex-based parsing since we can't run TypeScript in the browser.
 */
export function parseDrizzleSchema(content: string, name?: string): Diagram {
  const tables: DrizzleTable[] = [];
  const relationships: ParsedRelationship[] = [];

  // Detect dialect from imports
  const dialect = detectDrizzleDialect(content);
  const databaseType = drizzleDialectToDBType(dialect);

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

  // Convert to Diagram
  return buildDrizzleDiagram(tables, relationships, databaseType, name);
}

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

interface CallbackRef {
  sourceTableName: string;
  sourceColumn: string;
  targetVar: string;
  targetColumn: string;
}

function extractDrizzleTables(
  content: string,
  tables: DrizzleTable[],
  enumMap: Map<string, string>
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
      // Callback syntax: (d) => ({ id: d.varchar(...), ... })
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

function extractBraceBlock(content: string, startIdx: number): string | null {
  let depth = 0;
  let foundOpen = false;

  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") {
      depth++;
      foundOpen = true;
    } else if (ch === "}") {
      depth--;
      if (foundOpen && depth === 0) {
        return content.substring(startIdx + 1, i);
      }
    }
  }
  return null;
}

function parseDrizzleColumns(body: string): ParsedColumn[] {
  const columns: ParsedColumn[] = [];

  // Match: columnName: type('col_name') or columnName: type('col_name', { ... })
  // Followed by optional chained modifiers: .primaryKey(), .notNull(), .unique(), .default(...)
  const colRegex =
    /(\w+)\s*:\s*(\w+)\s*\(([^)]*)\)((?:\s*\.\s*\w+\s*\([^)]*\))*)/g;

  let match;
  while ((match = colRegex.exec(body)) !== null) {
    const fieldName = match[1]!;
    const typeFn = match[2]!;
    const modifiers = match[4] || "";

    // Skip if it looks like a constraint, not a column
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
    // MySQL
    mysqlEnum: "ENUM",
    tinyint: "TINYINT",
    mediumint: "MEDIUMINT",
    float: "FLOAT",
    double: "DOUBLE",
    // SQLite
    sqliteInteger: "INTEGER",
    sqliteText: "TEXT",
    sqliteReal: "REAL",
    sqliteBlob: "BLOB",
  };
  return map[fn] || fn.toUpperCase();
}

function extractPgEnums(content: string): Map<string, string> {
  const enums = new Map<string, string>();
  const enumRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*pgEnum\s*\(\s*["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    enums.set(match[1]!, match[2]!);
  }
  return enums;
}

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
  enumMap: Map<string, string>
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

    // Match: fieldName: ...
    const nameMatch = /^(\w+)\s*:/.exec(trimmed);
    if (!nameMatch) continue;

    const fieldName = nameMatch[1]!;

    // Try callback syntax: fieldName: d.typeFn(...)
    const callbackTypeRegex = new RegExp(
      `:\\s*${paramName}\\s*\\.\\s*(\\w+)\\s*\\(`
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
      // Resolve enum variable to enum type name
      const enumName = enumMap.get(typeFn);
      if (enumName) {
        typeFn = enumName;
      }
    }

    // Skip non-column constraint functions
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

function extractInlineReferences(
  content: string,
  tables: DrizzleTable[],
  relationships: ParsedRelationship[]
): void {
  // Match: .references(() => tableName.columnName)
  // We need context: which table/column this belongs to
  for (const table of tables) {
    // Find the table definition region
    const tableDefRegex = new RegExp(
      `(?:export\\s+)?const\\s+${table.variableName}\\s*=`,
    );
    const tableMatch = tableDefRegex.exec(content);
    if (!tableMatch) continue;

    const startIdx = content.indexOf("{", tableMatch.index);
    if (startIdx === -1) continue;
    const body = extractBraceBlock(content, startIdx);
    if (!body) continue;

    // Look for references in each column
    const refRegex =
      /(\w+)\s*:\s*\w+\s*\([^)]*\)(?:\s*\.\s*\w+\s*\([^)]*\))*\s*\.references\s*\(\s*\(\)\s*=>\s*(\w+)\.(\w+)\s*\)/g;

    let refMatch;
    while ((refMatch = refRegex.exec(body)) !== null) {
      const sourceColumn = refMatch[1]!;
      const targetVar = refMatch[2]!;
      const targetColumn = refMatch[3]!;

      // Resolve variable name to table name
      const targetTable = tables.find((t) => t.variableName === targetVar);
      const targetTableName = targetTable ? targetTable.tableName : targetVar;

      relationships.push({
        sourceTable: table.tableName,
        sourceColumn,
        targetTable: targetTableName,
        targetColumn,
      });

      // Mark as FK
      const col = table.columns.find((c) => c.name === sourceColumn);
      if (col) {
        col.references = { table: targetTableName, column: targetColumn };
      }
    }
  }
}

function extractExplicitRelations(
  content: string,
  tables: DrizzleTable[],
  relationships: ParsedRelationship[]
): void {
  // Match: relations(tableName, ({ one, many }) => ({ ... }))
  // Inside: fieldName: one(targetTable, { fields: [table.col], references: [target.col] })
  const relBlockRegex =
    /relations\s*\(\s*(\w+)\s*,\s*\(\s*\{[^}]*\}\s*\)\s*=>\s*\(\s*\{([\s\S]*?)\}\s*\)\s*,?\s*\)/g;

  let blockMatch;
  while ((blockMatch = relBlockRegex.exec(content)) !== null) {
    const body = blockMatch[2]!;

    // Match individual relation entries
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

      // Check for duplicates
      const exists = relationships.some(
        (r) =>
          r.sourceTable === fieldsTableName &&
          r.sourceColumn === fieldsCol &&
          r.targetTable === refsTableName &&
          r.targetColumn === refsCol
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

function buildDrizzleDiagram(
  drizzleTables: DrizzleTable[],
  relationships: ParsedRelationship[],
  databaseType: DatabaseType,
  name?: string
): Diagram {
  const tables = drizzleTables.map((dt, index) => ({
    id: generateId(),
    name: dt.tableName,
    schema: undefined,
    fields: dt.columns.map((col) => ({
      id: generateId(),
      name: col.name,
      type: col.type,
      primaryKey: col.primaryKey,
      unique: col.unique,
      nullable: col.nullable,
      default: col.default,
      comment: col.comment,
      isForeignKey: !!col.references,
      references: col.references
        ? { table: col.references.table, field: col.references.column }
        : undefined,
    })),
    indexes: [] as { id: string; name: string; columns: string[]; unique: boolean }[],
    x: 0,
    y: 0,
    color: getTableColor(index),
    isView: false,
  }));

  // Build relationship objects
  const tableMap = new Map(tables.map((t) => [t.name.toLowerCase(), t]));
  const diagramRels = [];

  for (const rel of relationships) {
    const source = tableMap.get(rel.sourceTable.toLowerCase());
    const target = tableMap.get(rel.targetTable.toLowerCase());
    if (source && target) {
      const sourceField = source.fields.find(
        (f) => f.name.toLowerCase() === rel.sourceColumn.toLowerCase()
      );
      const targetField = target.fields.find(
        (f) => f.name.toLowerCase() === rel.targetColumn.toLowerCase()
      );
      if (sourceField && targetField) {
        diagramRels.push({
          id: generateId(),
          sourceTableId: source.id,
          sourceFieldId: sourceField.id,
          targetTableId: target.id,
          targetFieldId: targetField.id,
          cardinality: (sourceField.unique ? "one-to-one" : "one-to-many") as
            | "one-to-one"
            | "one-to-many"
            | "many-to-many",
        });
      }
    }
  }

  return {
    id: generateId(),
    name: name ?? "Drizzle Schema",
    databaseType,
    tables,
    relationships: diagramRels,
    createdAt: new Date().toISOString(),
  };
}
