import type { Diagram, DBTable, DBField, DBIndex, DBRelationship } from "../domain";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SchemaDiff {
  addedTables: string[];
  removedTables: string[];
  modifiedTables: TableDiff[];
  addedRelationships: RelationshipChange[];
  removedRelationships: RelationshipChange[];
  summary: string;
}

export interface TableDiff {
  tableName: string;
  addedFields: string[];
  removedFields: string[];
  modifiedFields: FieldDiff[];
  addedIndexes: string[];
  removedIndexes: string[];
}

export interface FieldDiff {
  fieldName: string;
  changes: { property: string; oldValue: string; newValue: string }[];
}

export interface RelationshipChange {
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  targetField: string;
  cardinality: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(name: string): string {
  return name.toLowerCase();
}

/** Build a lookup map from table id → table name (lowercased) */
function tableIdToName(tables: DBTable[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tables) {
    map.set(t.id, t.name);
  }
  return map;
}

/** Build a lookup map from field id → field name within a set of tables */
function fieldIdToName(tables: DBTable[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tables) {
    for (const f of t.fields) {
      map.set(f.id, f.name);
    }
  }
  return map;
}

/** Canonical key for an index: sorted column names joined by comma (lowercased) */
function indexKey(index: DBIndex): string {
  return [...index.columns].map(normalize).sort().join(",");
}

/** Canonical key for a relationship using table+field names */
function relationshipKey(
  rel: DBRelationship,
  tableMap: Map<string, string>,
  fieldMap: Map<string, string>,
): string {
  const st = normalize(tableMap.get(rel.sourceTableId) ?? rel.sourceTableId);
  const sf = normalize(fieldMap.get(rel.sourceFieldId) ?? rel.sourceFieldId);
  const tt = normalize(tableMap.get(rel.targetTableId) ?? rel.targetTableId);
  const tf = normalize(fieldMap.get(rel.targetFieldId) ?? rel.targetFieldId);
  return `${st}.${sf}->${tt}.${tf}`;
}

function toRelationshipChange(
  rel: DBRelationship,
  tableMap: Map<string, string>,
  fieldMap: Map<string, string>,
): RelationshipChange {
  return {
    sourceTable: tableMap.get(rel.sourceTableId) ?? rel.sourceTableId,
    sourceField: fieldMap.get(rel.sourceFieldId) ?? rel.sourceFieldId,
    targetTable: tableMap.get(rel.targetTableId) ?? rel.targetTableId,
    targetField: fieldMap.get(rel.targetFieldId) ?? rel.targetFieldId,
    cardinality: rel.cardinality,
  };
}

// ─── Field Diffing ───────────────────────────────────────────────────────────

const FIELD_PROPERTIES: { key: keyof DBField; label: string }[] = [
  { key: "type", label: "type" },
  { key: "nullable", label: "nullable" },
  { key: "primaryKey", label: "primaryKey" },
  { key: "unique", label: "unique" },
  { key: "isForeignKey", label: "isForeignKey" },
  { key: "default", label: "default" },
  { key: "comment", label: "comment" },
];

function diffFields(before: DBField, after: DBField): FieldDiff | null {
  const changes: { property: string; oldValue: string; newValue: string }[] = [];

  for (const { key, label } of FIELD_PROPERTIES) {
    const oldVal = before[key];
    const newVal = after[key];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes.push({
        property: label,
        oldValue: String(oldVal ?? ""),
        newValue: String(newVal ?? ""),
      });
    }
  }

  // Check references changes
  const oldRef = before.references
    ? `${before.references.table}.${before.references.field}`
    : "";
  const newRef = after.references
    ? `${after.references.table}.${after.references.field}`
    : "";
  if (oldRef !== newRef) {
    changes.push({
      property: "references",
      oldValue: oldRef || "(none)",
      newValue: newRef || "(none)",
    });
  }

  if (changes.length === 0) return null;
  return { fieldName: after.name, changes };
}

// ─── Table Diffing ───────────────────────────────────────────────────────────

function diffTables(before: DBTable, after: DBTable): TableDiff | null {
  const beforeFieldMap = new Map<string, DBField>();
  for (const f of before.fields) {
    beforeFieldMap.set(normalize(f.name), f);
  }

  const afterFieldMap = new Map<string, DBField>();
  for (const f of after.fields) {
    afterFieldMap.set(normalize(f.name), f);
  }

  const addedFields: string[] = [];
  const removedFields: string[] = [];
  const modifiedFields: FieldDiff[] = [];

  // Detect removed and modified fields
  for (const [key, beforeField] of beforeFieldMap) {
    const afterField = afterFieldMap.get(key);
    if (!afterField) {
      removedFields.push(beforeField.name);
    } else {
      const diff = diffFields(beforeField, afterField);
      if (diff) modifiedFields.push(diff);
    }
  }

  // Detect added fields
  for (const [key, afterField] of afterFieldMap) {
    if (!beforeFieldMap.has(key)) {
      addedFields.push(afterField.name);
    }
  }

  // Index diffing
  const beforeIndexKeys = new Map<string, DBIndex>();
  for (const idx of before.indexes) {
    beforeIndexKeys.set(indexKey(idx), idx);
  }

  const afterIndexKeys = new Map<string, DBIndex>();
  for (const idx of after.indexes) {
    afterIndexKeys.set(indexKey(idx), idx);
  }

  const addedIndexes: string[] = [];
  const removedIndexes: string[] = [];

  for (const [key, idx] of beforeIndexKeys) {
    if (!afterIndexKeys.has(key)) {
      removedIndexes.push(idx.name);
    }
  }

  for (const [key, idx] of afterIndexKeys) {
    if (!beforeIndexKeys.has(key)) {
      addedIndexes.push(idx.name);
    }
  }

  const hasChanges =
    addedFields.length > 0 ||
    removedFields.length > 0 ||
    modifiedFields.length > 0 ||
    addedIndexes.length > 0 ||
    removedIndexes.length > 0;

  if (!hasChanges) return null;

  return {
    tableName: after.name,
    addedFields,
    removedFields,
    modifiedFields,
    addedIndexes,
    removedIndexes,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function generateSummary(diff: Omit<SchemaDiff, "summary">): string {
  const parts: string[] = [];

  if (diff.addedTables.length > 0) {
    const n = diff.addedTables.length;
    parts.push(`Added ${n} table${n !== 1 ? "s" : ""}`);
  }

  if (diff.removedTables.length > 0) {
    const n = diff.removedTables.length;
    parts.push(`removed ${n} table${n !== 1 ? "s" : ""}`);
  }

  if (diff.modifiedTables.length > 0) {
    const n = diff.modifiedTables.length;
    const fieldChanges = diff.modifiedTables.reduce(
      (sum, t) =>
        sum + t.addedFields.length + t.removedFields.length + t.modifiedFields.length,
      0,
    );
    parts.push(
      `modified ${n} table${n !== 1 ? "s" : ""} (${fieldChanges} field change${fieldChanges !== 1 ? "s" : ""})`,
    );
  }

  if (diff.addedRelationships.length > 0) {
    const n = diff.addedRelationships.length;
    parts.push(`added ${n} relationship${n !== 1 ? "s" : ""}`);
  }

  if (diff.removedRelationships.length > 0) {
    const n = diff.removedRelationships.length;
    parts.push(`removed ${n} relationship${n !== 1 ? "s" : ""}`);
  }

  if (parts.length === 0) return "No changes detected";

  // Capitalize first part
  const first = parts[0]!;
  parts[0] = first.charAt(0).toUpperCase() + first.slice(1);

  return parts.join(", ");
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function diffSchemas(before: Diagram, after: Diagram): SchemaDiff {
  // Build table maps keyed by normalized name
  const beforeTableMap = new Map<string, DBTable>();
  for (const t of before.tables) {
    beforeTableMap.set(normalize(t.name), t);
  }

  const afterTableMap = new Map<string, DBTable>();
  for (const t of after.tables) {
    afterTableMap.set(normalize(t.name), t);
  }

  // Added / removed / modified tables
  const addedTables: string[] = [];
  const removedTables: string[] = [];
  const modifiedTables: TableDiff[] = [];

  for (const [key, beforeTable] of beforeTableMap) {
    const afterTable = afterTableMap.get(key);
    if (!afterTable) {
      removedTables.push(beforeTable.name);
    } else {
      const tableDiff = diffTables(beforeTable, afterTable);
      if (tableDiff) modifiedTables.push(tableDiff);
    }
  }

  for (const [key, afterTable] of afterTableMap) {
    if (!beforeTableMap.has(key)) {
      addedTables.push(afterTable.name);
    }
  }

  // Relationship diffing
  const beforeTableIdMap = tableIdToName(before.tables);
  const beforeFieldIdMap = fieldIdToName(before.tables);
  const afterTableIdMap = tableIdToName(after.tables);
  const afterFieldIdMap = fieldIdToName(after.tables);

  const beforeRelMap = new Map<string, DBRelationship>();
  for (const rel of before.relationships) {
    beforeRelMap.set(relationshipKey(rel, beforeTableIdMap, beforeFieldIdMap), rel);
  }

  const afterRelMap = new Map<string, DBRelationship>();
  for (const rel of after.relationships) {
    afterRelMap.set(relationshipKey(rel, afterTableIdMap, afterFieldIdMap), rel);
  }

  const addedRelationships: RelationshipChange[] = [];
  const removedRelationships: RelationshipChange[] = [];

  for (const [key, rel] of beforeRelMap) {
    if (!afterRelMap.has(key)) {
      removedRelationships.push(toRelationshipChange(rel, beforeTableIdMap, beforeFieldIdMap));
    }
  }

  for (const [key, rel] of afterRelMap) {
    if (!beforeRelMap.has(key)) {
      addedRelationships.push(toRelationshipChange(rel, afterTableIdMap, afterFieldIdMap));
    }
  }

  const diffWithoutSummary = {
    addedTables,
    removedTables,
    modifiedTables,
    addedRelationships,
    removedRelationships,
  };

  return {
    ...diffWithoutSummary,
    summary: generateSummary(diffWithoutSummary),
  };
}
