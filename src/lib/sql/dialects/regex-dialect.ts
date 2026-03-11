import type { DatabaseType } from "@/lib/domain";
import type { SQLParseResult, ParsedTable, ParsedColumn, ParsedRelationship } from "../sql-import";

export function parseWithRegex(sql: string, dbType: DatabaseType): SQLParseResult {
  const tables: ParsedTable[] = [];
  const relationships: ParsedRelationship[] = [];

  // Match CREATE TABLE statements
  const createTableRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:EXTERNAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:["'`]?\w+["'`]?\.)+)?["'`]?(\w+)["'`]?\s*\(([\s\S]*?)\)(?:\s*(?:ENGINE|PARTITION|CLUSTER|OPTIONS|WITH|AS)[\s\S]*?)?;/gi;

  let match;
  while ((match = createTableRegex.exec(sql)) !== null) {
    const qualPrefix = match[1];
    const tableName = match[2]!;
    const body = match[3]!;
    // Extract first schema part from qualifier prefix (e.g. "mydb." or "warehouse.public.")
    const schema = qualPrefix ? qualPrefix.replace(/["'`]/g, "").split(".").filter(Boolean)[0] : undefined;

    const columns = parseColumns(body, dbType);
    const tableRels = parseInlineFK(body, tableName);
    relationships.push(...tableRels);

    tables.push({
      name: tableName,
      schema,
      columns,
      indexes: [],
      isView: false,
    });
  }

  // Match CREATE VIEW
  const createViewRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:["'`]?\w+["'`]?\.)+)?["'`]?(\w+)["'`]?/gi;

  while ((match = createViewRegex.exec(sql)) !== null) {
    const viewPrefix = match[1];
    const viewSchema = viewPrefix ? viewPrefix.replace(/["'`]/g, "").split(".").filter(Boolean)[0] : undefined;
    tables.push({
      name: match[2]!,
      schema: viewSchema,
      columns: [],
      indexes: [],
      isView: true,
    });
  }

  // ALTER TABLE FK
  const alterFKRegex =
    /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:["'`]?\w+["'`]?\.)?["'`]?(\w+)["'`]?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(["'`]?(\w+)["'`]?\)\s*REFERENCES\s+(?:["'`]?\w+["'`]?\.)?["'`]?(\w+)["'`]?\s*\(["'`]?(\w+)["'`]?\)/gi;

  while ((match = alterFKRegex.exec(sql)) !== null) {
    relationships.push({
      sourceTable: match[1]!,
      sourceColumn: match[2]!,
      targetTable: match[3]!,
      targetColumn: match[4]!,
    });
  }

  return { tables, relationships };
}

function parseColumns(body: string, dbType: DatabaseType): ParsedColumn[] {
  const columns: ParsedColumn[] = [];

  // Split on commas that aren't inside parentheses
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of body) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    // Skip constraints
    if (/^\s*(PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|CONSTRAINT|INDEX|KEY)\b/i.test(part)) {
      continue;
    }

    let colMatch;
    if (dbType === "bigquery") {
      colMatch = part.match(/^["'`]?(\w+)["'`]?\s+([\w<>, ]+(?:\([^)]*\))?)/i);
    } else {
      colMatch = part.match(/^["'`]?(\w+)["'`]?\s+(\w+(?:\([^)]*\))?)/i);
    }

    if (colMatch) {
      columns.push({
        name: colMatch[1]!,
        type: colMatch[2]!.trim(),
        primaryKey: /PRIMARY\s+KEY/i.test(part),
        unique: /\bUNIQUE\b/i.test(part),
        nullable: !/NOT\s+NULL/i.test(part),
      });
    }
  }

  return columns;
}

function parseInlineFK(body: string, tableName: string): ParsedRelationship[] {
  const relationships: ParsedRelationship[] = [];
  const fkRegex =
    /FOREIGN\s+KEY\s*\(["'`]?(\w+)["'`]?\)\s*REFERENCES\s+(?:["'`]?\w+["'`]?\.)?["'`]?(\w+)["'`]?\s*\(["'`]?(\w+)["'`]?\)/gi;

  let match;
  while ((match = fkRegex.exec(body)) !== null) {
    relationships.push({
      sourceTable: tableName,
      sourceColumn: match[1]!,
      targetTable: match[2]!,
      targetColumn: match[3]!,
    });
  }

  return relationships;
}
