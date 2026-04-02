import type { Diagram } from "../domain";
import type {
  ParsedColumn,
  ParsedRelationship,
  ParsedTable,
} from "../parsing/types";
import { buildDiagram } from "../parsing/build-diagram";
import { extractBraceBlock } from "../parsing/extract-brace-block";

/**
 * Parse a Kysely TypeScript schema (interface-based database definition) into a Diagram.
 *
 * Kysely defines the DB shape using TypeScript interfaces/types:
 *
 * ```ts
 * interface Database {
 *   users: UsersTable;
 *   posts: PostsTable;
 * }
 *
 * interface UsersTable {
 *   id: Generated<number>;
 *   name: string;
 *   email: string;
 *   created_at: Generated<Date>;
 * }
 * ```
 *
 * The parser extracts the main Database interface/type, resolves each table
 * interface, maps TS types to SQL types, and infers FK relationships from
 * column naming conventions (`author_id` → `authors.id`).
 */
export function parseKyselySchema(content: string, name?: string): Diagram {
  const cleaned = stripComments(content);

  // 1. Find the Database interface/type and extract table name → type name mappings
  const tableMapping = extractDatabaseMapping(cleaned);

  // 2. Parse each table interface/type
  const parsedTables: ParsedTable[] = [];
  const relationships: ParsedRelationship[] = [];

  const tableNames = new Set(tableMapping.map((m) => m.tableName));

  for (const { tableName, typeName } of tableMapping) {
    const columns = extractTableColumns(cleaned, typeName);
    if (columns.length === 0) continue;

    // Infer FK relationships from column naming convention
    for (const col of columns) {
      const fk = inferForeignKey(col.name, tableNames);
      if (fk) {
        col.references = fk;
        relationships.push({
          sourceTable: tableName,
          sourceColumn: col.name,
          targetTable: fk.table,
          targetColumn: fk.column,
        });
      }
    }

    parsedTables.push({
      name: tableName,
      columns,
      indexes: [],
      isView: false,
    });
  }

  return buildDiagram(
    parsedTables,
    relationships,
    "generic",
    name ?? "Kysely Schema",
  );
}

// ── Comment stripping ──────────────────────────────────────────────

function stripComments(content: string): string {
  // Remove single-line comments
  let result = content.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

// ── Database mapping extraction ────────────────────────────────────

interface TableMapping {
  tableName: string;
  typeName: string;
}

/**
 * Find the main `interface Database { ... }` or `type Database = { ... }`
 * and extract the table name → type name mappings from its properties.
 */
function extractDatabaseMapping(content: string): TableMapping[] {
  const mappings: TableMapping[] = [];

  // Match `interface Database {` (with optional export)
  const interfaceRegex =
    /(?:export\s+)?interface\s+Database\s*\{/g;
  // Match `type Database = {` (with optional export)
  const typeRegex =
    /(?:export\s+)?type\s+Database\s*=\s*\{/g;

  let bodyStartIdx: number | null = null;

  const interfaceMatch = interfaceRegex.exec(content);
  if (interfaceMatch) {
    bodyStartIdx = content.indexOf(
      "{",
      interfaceMatch.index + interfaceMatch[0].length - 1,
    );
  }

  if (bodyStartIdx === null) {
    const typeMatch = typeRegex.exec(content);
    if (typeMatch) {
      bodyStartIdx = content.indexOf(
        "{",
        typeMatch.index + typeMatch[0].length - 1,
      );
    }
  }

  if (bodyStartIdx === null) return mappings;

  const body = extractBraceBlock(content, bodyStartIdx);
  if (!body) return mappings;

  // Parse properties: `tableName: TypeName;` or `tableName: TypeName`
  const propRegex = /(\w+)\s*:\s*(\w+)\s*[;\n,]/g;
  let propMatch;
  while ((propMatch = propRegex.exec(body)) !== null) {
    mappings.push({
      tableName: propMatch[1]!,
      typeName: propMatch[2]!,
    });
  }

  return mappings;
}

// ── Table column extraction ────────────────────────────────────────

/**
 * Find an interface or type with the given name and extract its columns.
 *
 * Handles:
 *   - `interface FooTable { ... }`
 *   - `type FooTable = { ... }`
 */
function extractTableColumns(
  content: string,
  typeName: string,
): ParsedColumn[] {
  // Try interface first
  const interfaceRegex = new RegExp(
    `(?:export\\s+)?interface\\s+${escapeRegex(typeName)}\\s*\\{`,
  );
  const typeAliasRegex = new RegExp(
    `(?:export\\s+)?type\\s+${escapeRegex(typeName)}\\s*=\\s*\\{`,
  );

  let bodyStartIdx: number | null = null;

  const interfaceMatch = interfaceRegex.exec(content);
  if (interfaceMatch) {
    bodyStartIdx = content.indexOf(
      "{",
      interfaceMatch.index + interfaceMatch[0].length - 1,
    );
  }

  if (bodyStartIdx === null) {
    const typeMatch = typeAliasRegex.exec(content);
    if (typeMatch) {
      bodyStartIdx = content.indexOf(
        "{",
        typeMatch.index + typeMatch[0].length - 1,
      );
    }
  }

  if (bodyStartIdx === null) return [];

  const body = extractBraceBlock(content, bodyStartIdx);
  if (!body) return [];

  return parseColumns(body);
}

/**
 * Parse column definitions from a table interface body.
 *
 * Each line looks like:
 *   fieldName: TypeExpression;
 *   fieldName?: TypeExpression;
 */
function parseColumns(body: string): ParsedColumn[] {
  const columns: ParsedColumn[] = [];
  const lines = body.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("*")) continue;

    // Match: fieldName?: TypeExpression; or fieldName: TypeExpression;
    const colMatch = line.match(/^(\w+)(\?)?:\s*(.+?)\s*;?\s*$/);
    if (!colMatch) continue;

    const fieldName = colMatch[1]!;
    const isOptional = colMatch[2] === "?";
    const rawType = colMatch[3]!;

    const { sqlType, isGenerated, isNullable } = resolveType(rawType);

    const nullable = isNullable || isOptional;
    const isPrimaryKey = isGenerated && fieldName === "id";

    columns.push({
      name: fieldName,
      type: sqlType,
      primaryKey: isPrimaryKey,
      unique: isPrimaryKey,
      nullable: nullable && !isPrimaryKey,
      default: isGenerated ? "auto" : undefined,
    });
  }

  return columns;
}

// ── Type resolution ────────────────────────────────────────────────

interface ResolvedType {
  sqlType: string;
  isGenerated: boolean;
  isNullable: boolean;
}

/**
 * Resolve a Kysely TypeScript type expression to a SQL type.
 *
 * Handles:
 *   - Primitive types: `string`, `number`, `boolean`, `Date`, `bigint`
 *   - `Generated<T>`: extract T, mark as generated
 *   - `ColumnType<S, I, U>`: use S (the select type)
 *   - Nullable union: `string | null`, `null | string`
 *   - Array types: `string[]`, `Array<string>`
 *   - JSON/object types: `Record<...>`, `object`, inline `{ ... }`
 */
function resolveType(rawType: string): ResolvedType {
  let type = rawType.trim();
  let isGenerated = false;
  let isNullable = false;

  // Check for Generated<T>
  const generatedMatch = type.match(/^Generated\s*<(.+)>$/);
  if (generatedMatch) {
    isGenerated = true;
    type = generatedMatch[1]!.trim();
  }

  // Check for ColumnType<S, I, U> — use S (the select type)
  const columnTypeMatch = type.match(/^ColumnType\s*<(.+)>$/);
  if (columnTypeMatch) {
    const typeParams = splitTypeParams(columnTypeMatch[1]!);
    if (typeParams.length > 0) {
      type = typeParams[0]!.trim();
    }
  }

  // Check for nullable union: `T | null` or `null | T`
  // Split on `|` at top level (not inside angle brackets)
  const unionParts = splitUnion(type);
  if (unionParts.length > 1) {
    const nonNullParts = unionParts.filter((p) => p.trim() !== "null");
    if (nonNullParts.length < unionParts.length) {
      isNullable = true;
      type = nonNullParts.join(" | ").trim();
    }
  }

  // Map the base type to SQL
  const sqlType = mapTsTypeToSql(type);

  return { sqlType, isGenerated, isNullable };
}

/**
 * Split type parameters at the top level (respecting nested angle brackets).
 * e.g., `"string, string | null, string"` → `["string", "string | null", "string"]`
 */
function splitTypeParams(params: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < params.length; i++) {
    const ch = params[i]!;
    if (ch === "<" || ch === "(") depth++;
    else if (ch === ">" || ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(params.substring(start, i));
      start = i + 1;
    }
  }

  if (start < params.length) {
    parts.push(params.substring(start));
  }

  return parts;
}

/**
 * Split a union type at the top level (not inside `<>`).
 * e.g., `"string | null"` → `["string", "null"]`
 */
function splitUnion(type: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < type.length; i++) {
    const ch = type[i]!;
    if (ch === "<" || ch === "(") depth++;
    else if (ch === ">" || ch === ")") depth--;
    else if (ch === "|" && depth === 0) {
      parts.push(type.substring(start, i).trim());
      start = i + 1;
    }
  }

  if (start < type.length) {
    parts.push(type.substring(start).trim());
  }

  return parts;
}

/** Map a TypeScript base type to a SQL type string. */
function mapTsTypeToSql(tsType: string): string {
  const normalized = tsType.trim();

  // Direct mappings
  const map: Record<string, string> = {
    string: "VARCHAR",
    number: "INTEGER",
    boolean: "BOOLEAN",
    Date: "TIMESTAMP",
    bigint: "BIGINT",
    Buffer: "BYTEA",
    Uint8Array: "BYTEA",
  };

  const directMatch = map[normalized];
  if (directMatch) return directMatch;

  // Array types: string[] → VARCHAR[], Array<string> → VARCHAR[]
  const arrayBracketMatch = normalized.match(/^(.+)\[\]$/);
  if (arrayBracketMatch) {
    return `${mapTsTypeToSql(arrayBracketMatch[1]!)}[]`;
  }

  const arrayGenericMatch = normalized.match(/^Array\s*<(.+)>$/);
  if (arrayGenericMatch) {
    return `${mapTsTypeToSql(arrayGenericMatch[1]!)}[]`;
  }

  // JSON-like types
  if (
    normalized === "object" ||
    normalized.startsWith("Record<") ||
    normalized.startsWith("{")
  ) {
    return "JSONB";
  }

  if (normalized === "unknown" || normalized === "any") {
    return "JSONB";
  }

  // Fall back to the type name uppercased
  return normalized.toUpperCase();
}

// ── FK inference ───────────────────────────────────────────────────

/**
 * Infer a foreign key relationship from a column name.
 *
 * Convention: `author_id` → references `authors.id`
 * - Strip the `_id` suffix
 * - Naive pluralization: add "s" (handles most cases)
 * - Check if the target table exists in the schema
 */
function inferForeignKey(
  columnName: string,
  tableNames: Set<string>,
): { table: string; column: string } | undefined {
  if (!columnName.endsWith("_id")) return undefined;

  // Don't treat bare "id" as a FK
  const prefix = columnName.slice(0, -3);
  if (!prefix) return undefined;

  // Try common pluralization strategies
  const candidates = naivePluralize(prefix);

  for (const candidate of candidates) {
    // Case-insensitive lookup against known table names
    for (const tableName of tableNames) {
      if (tableName.toLowerCase() === candidate.toLowerCase()) {
        return { table: tableName, column: "id" };
      }
    }
  }

  return undefined;
}

/**
 * Produce candidate plural forms for a singular noun.
 * Covers common English pluralization rules.
 */
function naivePluralize(word: string): string[] {
  const candidates: string[] = [];

  // Already plural (e.g., `users_id` for table `users`)
  candidates.push(word);

  // Basic: add "s"
  candidates.push(word + "s");

  // Words ending in s, x, z, sh, ch → add "es"
  if (/(?:s|x|z|sh|ch)$/i.test(word)) {
    candidates.push(word + "es");
  }

  // Words ending in "y" → "ies"
  if (/[^aeiou]y$/i.test(word)) {
    candidates.push(word.slice(0, -1) + "ies");
  }

  return candidates;
}

// ── Utilities ──────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
