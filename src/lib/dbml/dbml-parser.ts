import type { Diagram, Cardinality } from "@/lib/domain";
import { generateId, getTableColor } from "@/lib/utils";

interface DBMLColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  unique: boolean;
  nullable: boolean;
  increment: boolean;
  default?: string;
  note?: string;
  ref?: {
    type: ">" | "<" | "-" | "<>";
    table: string;
    column: string;
  };
}

interface DBMLTable {
  name: string;
  alias?: string;
  schema?: string;
  columns: DBMLColumn[];
}

interface DBMLRef {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: ">" | "<" | "-" | "<>";
}

/**
 * Parse a DBML (Database Markup Language) schema into a Diagram.
 * Uses regex-based parsing.
 */
export function parseDBMLSchema(content: string, name?: string): Diagram {
  // Strip single-line and block comments
  const cleaned = stripComments(content);

  const tables = extractTables(cleaned);
  const standaloneRefs = extractStandaloneRefs(cleaned);

  return buildDBMLDiagram(tables, standaloneRefs, name);
}

function stripComments(content: string): string {
  // Remove block comments
  let result = content.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove single-line comments
  result = result.replace(/\/\/.*$/gm, "");
  return result;
}

function extractBraceBlock(content: string, startIdx: number): string | null {
  let depth = 0;
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) return content.substring(startIdx + 1, i);
    }
  }
  return null;
}

function extractTables(content: string): DBMLTable[] {
  const tables: DBMLTable[] = [];

  // Match: Table schema.name as alias { ... }
  // Or: Table name as alias { ... }
  // Or: Table name { ... }
  const tableRegex = /Table\s+((?:(\w+)\.)?(\w+))(?:\s+as\s+(\w+))?\s*\{/gi;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const schema = match[2] || undefined;
    const tableName = match[3]!;
    const alias = match[4] || undefined;

    const startIdx = content.indexOf("{", match.index + match[0].length - 1);
    if (startIdx === -1) continue;

    const body = extractBraceBlock(content, startIdx);
    if (!body) continue;

    const columns = parseDBMLColumns(body);

    tables.push({
      name: tableName,
      alias,
      schema,
      columns,
    });
  }

  return tables;
}

function parseDBMLColumns(body: string): DBMLColumn[] {
  const columns: DBMLColumn[] = [];

  // Skip indexes block within the table body
  const lines = body.split("\n");

  let inIndexesBlock = false;
  let braceDepth = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Track indexes { ... } blocks to skip them
    if (/^indexes\s*\{/i.test(line)) {
      inIndexesBlock = true;
      braceDepth = 1;
      continue;
    }

    if (inIndexesBlock) {
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        else if (ch === "}") braceDepth--;
      }
      if (braceDepth <= 0) {
        inIndexesBlock = false;
      }
      continue;
    }

    // Skip Note blocks
    if (/^Note\s*[:{]/i.test(line)) continue;

    // Parse column: name type [attributes]
    const colMatch = line.match(
      /^(\w+)\s+([\w().,\s]+?)(?:\s*\[([^\]]*)\])?\s*$/
    );
    if (!colMatch) continue;

    const colName = colMatch[1]!;
    const colType = colMatch[2]!.trim();
    const attrsStr = colMatch[3] || "";

    const attrs = parseAttributes(attrsStr);

    const column: DBMLColumn = {
      name: colName,
      type: colType.toUpperCase(),
      primaryKey: attrs.pk,
      unique: attrs.unique,
      nullable: attrs.nullable,
      increment: attrs.increment,
      default: attrs.default,
      note: attrs.note,
      ref: attrs.ref,
    };

    columns.push(column);
  }

  return columns;
}

interface ParsedAttributes {
  pk: boolean;
  increment: boolean;
  unique: boolean;
  nullable: boolean;
  notNull: boolean;
  default?: string;
  note?: string;
  ref?: {
    type: ">" | "<" | "-" | "<>";
    table: string;
    column: string;
  };
}

function parseAttributes(attrsStr: string): ParsedAttributes {
  const result: ParsedAttributes = {
    pk: false,
    increment: false,
    unique: false,
    nullable: false,
    notNull: false,
  };

  if (!attrsStr.trim()) {
    // Default: nullable when no attributes
    result.nullable = true;
    return result;
  }

  // Check for pk / primary key
  if (/\bpk\b/i.test(attrsStr) || /\bprimary\s+key\b/i.test(attrsStr)) {
    result.pk = true;
  }

  // Check for increment
  if (/\bincrement\b/i.test(attrsStr)) {
    result.increment = true;
  }

  // Check for unique
  if (/\bunique\b/i.test(attrsStr)) {
    result.unique = true;
  }

  // Check for not null
  if (/\bnot\s+null\b/i.test(attrsStr)) {
    result.notNull = true;
  }

  // Check for null
  if (/(?<!\bnot\s)\bnull\b/i.test(attrsStr) && !/\bnot\s+null\b/i.test(attrsStr)) {
    result.nullable = true;
  }

  // Default: if neither null nor not null specified, nullable unless pk
  if (!result.notNull && !result.nullable) {
    result.nullable = !result.pk;
  }

  if (result.notNull) {
    result.nullable = false;
  }

  // Extract default value
  const defaultMatch = attrsStr.match(/\bdefault\s*:\s*(`[^`]*`|'[^']*'|"[^"]*"|\S+)/i);
  if (defaultMatch) {
    let val = defaultMatch[1]!;
    // Remove surrounding quotes/backticks
    if ((val.startsWith("`") && val.endsWith("`")) ||
        (val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    result.default = val;
  }

  // Extract note
  const noteMatch = attrsStr.match(/\bnote\s*:\s*'([^']*)'/i);
  if (noteMatch) {
    result.note = noteMatch[1];
  }

  // Extract inline ref: ref: > table.column
  const refMatch = attrsStr.match(/\bref\s*:\s*([><\-]|<>)\s*(\w+)\.(\w+)/i);
  if (refMatch) {
    result.ref = {
      type: refMatch[1] as ">" | "<" | "-" | "<>",
      table: refMatch[2]!,
      column: refMatch[3]!,
    };
  }

  return result;
}

function extractStandaloneRefs(content: string): DBMLRef[] {
  const refs: DBMLRef[] = [];

  // Match: Ref: table1.col > table2.col
  // Or: Ref name: table1.col > table2.col
  // Or: Ref name { table1.col > table2.col }
  const refLineRegex =
    /Ref(?:\s+\w+)?\s*:\s*(\w+)\.(\w+)\s*([><\-]|<>)\s*(\w+)\.(\w+)/gi;

  let match;
  while ((match = refLineRegex.exec(content)) !== null) {
    const table1 = match[1]!;
    const col1 = match[2]!;
    const refType = match[3] as ">" | "<" | "-" | "<>";
    const table2 = match[4]!;
    const col2 = match[5]!;

    if (refType === ">") {
      // many-to-one: table1.col references table2.col
      refs.push({
        sourceTable: table1,
        sourceColumn: col1,
        targetTable: table2,
        targetColumn: col2,
        type: ">",
      });
    } else if (refType === "<") {
      // one-to-many: table2.col references table1.col
      refs.push({
        sourceTable: table2,
        sourceColumn: col2,
        targetTable: table1,
        targetColumn: col1,
        type: "<",
      });
    } else if (refType === "-") {
      // one-to-one
      refs.push({
        sourceTable: table1,
        sourceColumn: col1,
        targetTable: table2,
        targetColumn: col2,
        type: "-",
      });
    } else if (refType === "<>") {
      // many-to-many
      refs.push({
        sourceTable: table1,
        sourceColumn: col1,
        targetTable: table2,
        targetColumn: col2,
        type: "<>",
      });
    }
  }

  // Also match Ref blocks: Ref name { table1.col > table2.col }
  const refBlockRegex = /Ref(?:\s+\w+)?\s*\{([^}]*)\}/gi;
  let blockMatch;
  while ((blockMatch = refBlockRegex.exec(content)) !== null) {
    const body = blockMatch[1]!;
    const innerRefRegex =
      /(\w+)\.(\w+)\s*([><\-]|<>)\s*(\w+)\.(\w+)/g;
    let innerMatch;
    while ((innerMatch = innerRefRegex.exec(body)) !== null) {
      const table1 = innerMatch[1]!;
      const col1 = innerMatch[2]!;
      const refType = innerMatch[3] as ">" | "<" | "-" | "<>";
      const table2 = innerMatch[4]!;
      const col2 = innerMatch[5]!;

      if (refType === ">") {
        refs.push({
          sourceTable: table1,
          sourceColumn: col1,
          targetTable: table2,
          targetColumn: col2,
          type: ">",
        });
      } else if (refType === "<") {
        refs.push({
          sourceTable: table2,
          sourceColumn: col2,
          targetTable: table1,
          targetColumn: col1,
          type: "<",
        });
      } else if (refType === "-") {
        refs.push({
          sourceTable: table1,
          sourceColumn: col1,
          targetTable: table2,
          targetColumn: col2,
          type: "-",
        });
      } else if (refType === "<>") {
        refs.push({
          sourceTable: table1,
          sourceColumn: col1,
          targetTable: table2,
          targetColumn: col2,
          type: "<>",
        });
      }
    }
  }

  return refs;
}

function refTypeToCardinality(type: ">" | "<" | "-" | "<>"): Cardinality {
  switch (type) {
    case ">":
      return "one-to-many";
    case "<":
      return "one-to-many";
    case "-":
      return "one-to-one";
    case "<>":
      return "many-to-many";
  }
}

function buildDBMLDiagram(
  dbmlTables: DBMLTable[],
  standaloneRefs: DBMLRef[],
  name?: string
): Diagram {
  const tables = dbmlTables.map((dt, index) => ({
    id: generateId(),
    name: dt.name,
    schema: dt.schema,
    fields: dt.columns.map((col) => ({
      id: generateId(),
      name: col.name,
      type: col.type,
      primaryKey: col.primaryKey,
      unique: col.unique,
      nullable: col.nullable,
      default: col.default,
      comment: col.note,
      isForeignKey: !!col.ref,
      references: col.ref
        ? { table: col.ref.table, field: col.ref.column }
        : undefined,
    })),
    indexes: [] as { id: string; name: string; columns: string[]; unique: boolean }[],
    x: 0,
    y: 0,
    color: getTableColor(index),
    isView: false,
  }));

  // Build lookup maps
  // Support resolving table names and aliases
  const tableByName = new Map<string, (typeof tables)[number]>();
  for (let i = 0; i < dbmlTables.length; i++) {
    const dt = dbmlTables[i]!;
    const t = tables[i]!;
    tableByName.set(dt.name.toLowerCase(), t);
    if (dt.alias) {
      tableByName.set(dt.alias.toLowerCase(), t);
    }
  }

  const relationships: {
    id: string;
    sourceTableId: string;
    sourceFieldId: string;
    targetTableId: string;
    targetFieldId: string;
    cardinality: Cardinality;
  }[] = [];

  // Collect all refs: inline + standalone
  const allRefs: DBMLRef[] = [...standaloneRefs];

  // Extract inline refs from columns
  for (const dt of dbmlTables) {
    for (const col of dt.columns) {
      if (col.ref) {
        if (col.ref.type === ">") {
          allRefs.push({
            sourceTable: dt.name,
            sourceColumn: col.name,
            targetTable: col.ref.table,
            targetColumn: col.ref.column,
            type: col.ref.type,
          });
        } else if (col.ref.type === "<") {
          allRefs.push({
            sourceTable: col.ref.table,
            sourceColumn: col.ref.column,
            targetTable: dt.name,
            targetColumn: col.name,
            type: col.ref.type,
          });
        } else if (col.ref.type === "-") {
          allRefs.push({
            sourceTable: dt.name,
            sourceColumn: col.name,
            targetTable: col.ref.table,
            targetColumn: col.ref.column,
            type: col.ref.type,
          });
        } else if (col.ref.type === "<>") {
          allRefs.push({
            sourceTable: dt.name,
            sourceColumn: col.name,
            targetTable: col.ref.table,
            targetColumn: col.ref.column,
            type: col.ref.type,
          });
        }
      }
    }
  }

  // Deduplicate refs
  const seenRefs = new Set<string>();
  for (const ref of allRefs) {
    const key = `${ref.sourceTable.toLowerCase()}.${ref.sourceColumn.toLowerCase()}-${ref.targetTable.toLowerCase()}.${ref.targetColumn.toLowerCase()}`;
    if (seenRefs.has(key)) continue;
    seenRefs.add(key);

    const sourceTable = tableByName.get(ref.sourceTable.toLowerCase());
    const targetTable = tableByName.get(ref.targetTable.toLowerCase());
    if (!sourceTable || !targetTable) continue;

    const sourceField = sourceTable.fields.find(
      (f) => f.name.toLowerCase() === ref.sourceColumn.toLowerCase()
    );
    const targetField = targetTable.fields.find(
      (f) => f.name.toLowerCase() === ref.targetColumn.toLowerCase()
    );
    if (!sourceField || !targetField) continue;

    // Mark as FK
    sourceField.isForeignKey = true;
    if (!sourceField.references) {
      sourceField.references = {
        table: targetTable.name,
        field: targetField.name,
      };
    }

    relationships.push({
      id: generateId(),
      sourceTableId: sourceTable.id,
      sourceFieldId: sourceField.id,
      targetTableId: targetTable.id,
      targetFieldId: targetField.id,
      cardinality: refTypeToCardinality(ref.type),
    });
  }

  return {
    id: generateId(),
    name: name ?? "DBML Schema",
    databaseType: "generic",
    tables,
    relationships,
    createdAt: new Date().toISOString(),
  };
}
