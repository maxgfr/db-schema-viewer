import type {
  DatabaseType,
  Diagram,
  DBTable,
  DBField,
  DBIndex,
  DBRelationship,
} from "../domain";
import { generateId, getTableColor } from "../utils";
import type { ParsedTable, ParsedRelationship } from "./types";

/**
 * Convert parser-agnostic intermediate tables + relationships into a Diagram.
 *
 * This is the single, shared "second half" that every parser delegates to
 * after it has produced its own ParsedTable[] and ParsedRelationship[].
 *
 * Relationships are built from two sources (deduplicated):
 *   1. Inline FK references already stored on columns (col.references)
 *   2. The explicit `relationships` array (e.g. ALTER TABLE, relations(), Ref:)
 */
export function buildDiagram(
  parsedTables: ParsedTable[],
  parsedRelationships: ParsedRelationship[],
  databaseType: DatabaseType,
  name?: string,
): Diagram {
  const tables: DBTable[] = parsedTables.map((pt, index) => {
    const fields: DBField[] = pt.columns.map((col) => ({
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
    }));

    const indexes: DBIndex[] = pt.indexes.map((idx) => ({
      id: generateId(),
      name: idx.name,
      columns: idx.columns,
      unique: idx.unique,
    }));

    return {
      id: generateId(),
      name: pt.name,
      schema: pt.schema,
      fields,
      indexes,
      x: 0,
      y: 0,
      color: getTableColor(index),
      isView: pt.isView,
      comment: pt.comment,
    };
  });

  const relationships = resolveRelationships(tables, parsedRelationships);

  return {
    id: generateId(),
    name: name ?? "Untitled Schema",
    databaseType,
    tables,
    relationships,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build DBRelationship[] from two sources (deduplicated):
 *   1. Explicit: the ParsedRelationship[] array (processed first — may carry cardinality).
 *   2. Inline: fields that already have `references` set.
 */
function resolveRelationships(
  tables: DBTable[],
  parsedRelationships: ParsedRelationship[],
): DBRelationship[] {
  const tableMap = new Map<string, DBTable>();
  for (const t of tables) {
    tableMap.set(t.name.toLowerCase(), t);
  }

  const relationships: DBRelationship[] = [];
  const seen = new Set<string>();

  const addRel = (
    source: DBTable,
    sourceField: DBField,
    target: DBTable,
    targetField: DBField,
    cardinality?: ParsedRelationship["cardinality"],
  ) => {
    const key = `${source.id}|${sourceField.id}|${target.id}|${targetField.id}`;
    if (seen.has(key)) return;
    seen.add(key);

    relationships.push({
      id: generateId(),
      sourceTableId: source.id,
      sourceFieldId: sourceField.id,
      targetTableId: target.id,
      targetFieldId: targetField.id,
      cardinality:
        cardinality ?? (sourceField.unique ? "one-to-one" : "one-to-many"),
    });
  };

  // 1. Explicit relationships first (may carry parser-specific cardinality)
  for (const rel of parsedRelationships) {
    const sourceTable = tableMap.get(rel.sourceTable.toLowerCase());
    const targetTable = tableMap.get(rel.targetTable.toLowerCase());
    if (!sourceTable || !targetTable) continue;

    const sourceField = sourceTable.fields.find(
      (f) => f.name.toLowerCase() === rel.sourceColumn.toLowerCase(),
    );
    const targetField = targetTable.fields.find(
      (f) => f.name.toLowerCase() === rel.targetColumn.toLowerCase(),
    );
    if (!sourceField || !targetField) continue;

    // Mark field as FK when coming from DB-level constraints (not ORM-only relations)
    if (!sourceField.isForeignKey && !rel.isOrmOnly) {
      sourceField.isForeignKey = true;
      sourceField.references = {
        table: targetTable.name,
        field: targetField.name,
      };
    }

    addRel(sourceTable, sourceField, targetTable, targetField, rel.cardinality);
  }

  // 2. From inline FK references on fields (fills in anything not already covered)
  for (const table of tables) {
    for (const field of table.fields) {
      if (!field.references) continue;

      const targetTable = tableMap.get(field.references.table.toLowerCase());
      if (!targetTable) continue;

      const targetField = targetTable.fields.find(
        (f) => f.name.toLowerCase() === field.references!.field.toLowerCase(),
      );
      if (!targetField) continue;

      addRel(table, field, targetTable, targetField);
    }
  }

  return relationships;
}
