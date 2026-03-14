import type { Diagram, Cardinality } from "@/lib/domain";
import type { ParsedColumn, ParsedRelationship } from "@/lib/parsing/types";
import { buildDiagram } from "@/lib/parsing/build-diagram";
import { extractBraceBlock } from "@/lib/parsing/extract-brace-block";

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
  const cleaned = stripComments(content);

  const tables = extractTables(cleaned);
  const standaloneRefs = extractStandaloneRefs(cleaned);

  // Build alias → real name lookup
  const aliasMap = new Map<string, string>();
  for (const t of tables) {
    if (t.alias) aliasMap.set(t.alias.toLowerCase(), t.name);
  }

  const resolveTable = (ref: string): string =>
    aliasMap.get(ref.toLowerCase()) || ref;

  // Convert to shared types
  const parsedTables = tables.map((dt) => ({
    name: dt.name,
    schema: dt.schema,
    columns: dbmlColumnsToShared(dt.columns),
    indexes: [] as { name: string; columns: string[]; unique: boolean }[],
    isView: false,
  }));

  // Merge all refs: inline + standalone, normalize direction, deduplicate
  const allRefs = collectAllRefs(tables, standaloneRefs);
  const relationships = deduplicateRefs(allRefs, resolveTable);

  return buildDiagram(parsedTables, relationships, "generic", name ?? "DBML Schema");
}

// ── Comment stripping ──────────────────────────────────────────────

function stripComments(content: string): string {
  let result = content.replace(/\/\*[\s\S]*?\*\//g, "");
  result = result.replace(/\/\/.*$/gm, "");
  return result;
}

// ── Table extraction ───────────────────────────────────────────────

function extractTables(content: string): DBMLTable[] {
  const tables: DBMLTable[] = [];

  const tableRegex =
    /Table\s+((?:(\w+)\.)?(\w+))(?:\s+as\s+(\w+))?\s*\{/gi;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const schema = match[2] || undefined;
    const tableName = match[3]!;
    const alias = match[4] || undefined;

    const startIdx = content.indexOf("{", match.index + match[0].length - 1);
    if (startIdx === -1) continue;

    const body = extractBraceBlock(content, startIdx);
    if (!body) continue;

    tables.push({
      name: tableName,
      alias,
      schema,
      columns: parseDBMLColumns(body),
    });
  }

  return tables;
}

// ── Column parsing ─────────────────────────────────────────────────

function parseDBMLColumns(body: string): DBMLColumn[] {
  const columns: DBMLColumn[] = [];
  const lines = body.split("\n");

  let inIndexesBlock = false;
  let braceDepth = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

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
      if (braceDepth <= 0) inIndexesBlock = false;
      continue;
    }

    if (/^Note\s*[:{]/i.test(line)) continue;

    const colMatch = line.match(
      /^(\w+)\s+([\w().,\s]+?)(?:\s*\[([^\]]*)\])?\s*$/,
    );
    if (!colMatch) continue;

    const attrs = parseAttributes(colMatch[3] || "");

    columns.push({
      name: colMatch[1]!,
      type: colMatch[2]!.trim().toUpperCase(),
      primaryKey: attrs.pk,
      unique: attrs.unique,
      nullable: attrs.nullable,
      increment: attrs.increment,
      default: attrs.default,
      note: attrs.note,
      ref: attrs.ref,
    });
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
  ref?: { type: ">" | "<" | "-" | "<>"; table: string; column: string };
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
    result.nullable = true;
    return result;
  }

  if (/\bpk\b/i.test(attrsStr) || /\bprimary\s+key\b/i.test(attrsStr))
    result.pk = true;
  if (/\bincrement\b/i.test(attrsStr)) result.increment = true;
  if (/\bunique\b/i.test(attrsStr)) result.unique = true;
  if (/\bnot\s+null\b/i.test(attrsStr)) result.notNull = true;
  if (
    /(?<!\bnot\s)\bnull\b/i.test(attrsStr) &&
    !/\bnot\s+null\b/i.test(attrsStr)
  )
    result.nullable = true;

  if (!result.notNull && !result.nullable) result.nullable = !result.pk;
  if (result.notNull) result.nullable = false;

  const defaultMatch = attrsStr.match(
    /\bdefault\s*:\s*(`[^`]*`|'[^']*'|"[^"]*"|\S+)/i,
  );
  if (defaultMatch) {
    let val = defaultMatch[1]!;
    if (
      (val.startsWith("`") && val.endsWith("`")) ||
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    result.default = val;
  }

  const noteMatch = attrsStr.match(/\bnote\s*:\s*'([^']*)'/i);
  if (noteMatch) result.note = noteMatch[1];

  const refMatch = attrsStr.match(
    /\bref\s*:\s*([><\-]|<>)\s*(\w+)\.(\w+)/i,
  );
  if (refMatch) {
    result.ref = {
      type: refMatch[1] as ">" | "<" | "-" | "<>",
      table: refMatch[2]!,
      column: refMatch[3]!,
    };
  }

  return result;
}

// ── Standalone Ref extraction ──────────────────────────────────────

function extractStandaloneRefs(content: string): DBMLRef[] {
  const refs: DBMLRef[] = [];

  // Ref: / Ref name:
  const refLineRegex =
    /Ref(?:\s+\w+)?\s*:\s*(\w+)\.(\w+)\s*([><\-]|<>)\s*(\w+)\.(\w+)/gi;

  let match;
  while ((match = refLineRegex.exec(content)) !== null) {
    refs.push(
      normalizeRef(
        match[1]!,
        match[2]!,
        match[3] as DBMLRef["type"],
        match[4]!,
        match[5]!,
      ),
    );
  }

  // Ref blocks: Ref name { ... }
  const refBlockRegex = /Ref(?:\s+\w+)?\s*\{([^}]*)\}/gi;
  let blockMatch;
  while ((blockMatch = refBlockRegex.exec(content)) !== null) {
    const body = blockMatch[1]!;
    const innerRefRegex =
      /(\w+)\.(\w+)\s*([><\-]|<>)\s*(\w+)\.(\w+)/g;
    let innerMatch;
    while ((innerMatch = innerRefRegex.exec(body)) !== null) {
      refs.push(
        normalizeRef(
          innerMatch[1]!,
          innerMatch[2]!,
          innerMatch[3] as DBMLRef["type"],
          innerMatch[4]!,
          innerMatch[5]!,
        ),
      );
    }
  }

  return refs;
}

/** Normalize a ref so source is always the FK side. */
function normalizeRef(
  table1: string,
  col1: string,
  type: DBMLRef["type"],
  table2: string,
  col2: string,
): DBMLRef {
  if (type === "<") {
    // Reverse: table2 is the FK side
    return {
      sourceTable: table2,
      sourceColumn: col2,
      targetTable: table1,
      targetColumn: col1,
      type: "<",
    };
  }
  return {
    sourceTable: table1,
    sourceColumn: col1,
    targetTable: table2,
    targetColumn: col2,
    type,
  };
}

// ── Ref merging / deduplication ────────────────────────────────────

function dbmlColumnsToShared(columns: DBMLColumn[]): ParsedColumn[] {
  return columns.map((col) => ({
    name: col.name,
    type: col.type,
    primaryKey: col.primaryKey,
    unique: col.unique,
    nullable: col.nullable,
    default: col.default,
    comment: col.note,
    // Inline refs are handled via collectAllRefs, not on ParsedColumn
    references: col.ref
      ? { table: col.ref.table, column: col.ref.column }
      : undefined,
  }));
}

function collectAllRefs(tables: DBMLTable[], standaloneRefs: DBMLRef[]): DBMLRef[] {
  const allRefs: DBMLRef[] = [...standaloneRefs];

  for (const dt of tables) {
    for (const col of dt.columns) {
      if (!col.ref) continue;

      allRefs.push(
        normalizeRef(
          dt.name,
          col.name,
          col.ref.type,
          col.ref.table,
          col.ref.column,
        ),
      );
    }
  }

  return allRefs;
}

function refTypeToCardinality(type: DBMLRef["type"]): Cardinality {
  switch (type) {
    case ">":
    case "<":
      return "one-to-many";
    case "-":
      return "one-to-one";
    case "<>":
      return "many-to-many";
  }
}

function deduplicateRefs(
  allRefs: DBMLRef[],
  resolveTable: (name: string) => string,
): ParsedRelationship[] {
  const relationships: ParsedRelationship[] = [];
  const seen = new Set<string>();

  for (const ref of allRefs) {
    const src = resolveTable(ref.sourceTable);
    const tgt = resolveTable(ref.targetTable);
    const key = `${src.toLowerCase()}.${ref.sourceColumn.toLowerCase()}-${tgt.toLowerCase()}.${ref.targetColumn.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    relationships.push({
      sourceTable: src,
      sourceColumn: ref.sourceColumn,
      targetTable: tgt,
      targetColumn: ref.targetColumn,
      cardinality: refTypeToCardinality(ref.type),
    });
  }

  return relationships;
}
