import type { Diagram } from "../domain";

export interface SchemaMetrics {
  tableCount: number;
  viewCount: number;
  fieldCount: number;
  relationshipCount: number;
  avgFieldsPerTable: number;
  orphanTables: string[]; // tables with no relationships
  selfReferences: string[]; // tables that reference themselves
  relationalDensity: number; // relationships / tables ratio
  maxDepth: number; // longest FK chain
}

export interface AntiPattern {
  id: string;
  severity: "critical" | "warning" | "info";
  category:
    | "missing-pk"
    | "nullable-fk"
    | "orphan-table"
    | "naming"
    | "type-inconsistency"
    | "missing-index"
    | "wide-table"
    | "generic";
  table?: string;
  field?: string;
  description: string;
  suggestion: string;
}

export interface QualityScore {
  overall: number; // 0-100
  naming: number;
  normalization: number;
  relationships: number;
  indexing: number;
  breakdown: { category: string; score: number; maxScore: number }[];
}

export interface SchemaAnalysis {
  metrics: SchemaMetrics;
  antiPatterns: AntiPattern[];
  qualityScore: QualityScore;
}

export function analyzeSchema(diagram: Diagram): SchemaAnalysis {
  const metrics = computeMetrics(diagram);
  const antiPatterns = detectAntiPatterns(diagram);
  const qualityScore = computeQualityScore(diagram, antiPatterns);
  return { metrics, antiPatterns, qualityScore };
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function computeMetrics(diagram: Diagram): SchemaMetrics {
  const tables = diagram.tables;
  const relationships = diagram.relationships;

  const nonViewTables = tables.filter((t) => !t.isView);
  const tableCount = nonViewTables.length;
  const viewCount = tables.filter((t) => t.isView).length;
  const fieldCount = tables.reduce((sum, t) => sum + t.fields.length, 0);
  const relationshipCount = relationships.length;

  const avgFieldsPerTable =
    tableCount > 0 ? fieldCount / tableCount : 0;

  // Orphan tables: tables that appear in zero relationships
  const connectedTableIds = new Set<string>();
  for (const rel of relationships) {
    connectedTableIds.add(rel.sourceTableId);
    connectedTableIds.add(rel.targetTableId);
  }
  const orphanTables = nonViewTables
    .filter((t) => !connectedTableIds.has(t.id))
    .map((t) => t.name);

  // Self references
  const selfReferenceSet = new Set<string>();
  for (const rel of relationships) {
    if (rel.sourceTableId === rel.targetTableId) {
      const table = tables.find((t) => t.id === rel.sourceTableId);
      if (table) selfReferenceSet.add(table.name);
    }
  }
  const selfReferences = [...selfReferenceSet];

  // Relational density
  const totalTables = tables.length;
  const relationalDensity =
    totalTables > 0 ? relationships.length / totalTables : 0;

  // Max depth via BFS following FK chains
  const maxDepth = computeMaxFKDepth(diagram);

  return {
    tableCount,
    viewCount,
    fieldCount,
    relationshipCount,
    avgFieldsPerTable,
    orphanTables,
    selfReferences,
    relationalDensity,
    maxDepth,
  };
}

function computeMaxFKDepth(diagram: Diagram): number {
  // Build adjacency list: sourceTableId -> targetTableId[]
  const adjacency = new Map<string, string[]>();
  for (const rel of diagram.relationships) {
    if (rel.sourceTableId === rel.targetTableId) continue;
    const existing = adjacency.get(rel.sourceTableId);
    if (existing) {
      existing.push(rel.targetTableId);
    } else {
      adjacency.set(rel.sourceTableId, [rel.targetTableId]);
    }
  }

  let maxDepth = 0;

  for (const table of diagram.tables) {
    // BFS from this table
    const visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [
      { id: table.id, depth: 0 },
    ];
    visited.add(table.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > maxDepth) {
        maxDepth = current.depth;
      }

      const neighbors = adjacency.get(current.id) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, depth: current.depth + 1 });
        }
      }
    }
  }

  return maxDepth;
}

// ─── Anti-Patterns ────────────────────────────────────────────────────────────

const RESERVED_WORDS = new Set([
  "user",
  "order",
  "table",
  "index",
  "group",
  "select",
]);

function isCamelCase(name: string): boolean {
  return /[a-z][A-Z]/.test(name);
}

function isSnakeCase(name: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name);
}

function looksPlural(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith("s") && !lower.endsWith("ss") && !lower.endsWith("us");
}

function looksSingular(name: string): boolean {
  return !looksPlural(name);
}

let antiPatternIdCounter = 0;
function nextAntiPatternId(): string {
  antiPatternIdCounter += 1;
  return `ap-${antiPatternIdCounter}`;
}

export function detectAntiPatterns(diagram: Diagram): AntiPattern[] {
  antiPatternIdCounter = 0;
  const patterns: AntiPattern[] = [];

  const nonViewTables = diagram.tables.filter((t) => !t.isView);

  // 1. Missing PK
  for (const table of nonViewTables) {
    const hasPK = table.fields.some((f) => f.primaryKey);
    if (!hasPK) {
      patterns.push({
        id: nextAntiPatternId(),
        severity: "critical",
        category: "missing-pk",
        table: table.name,
        description: `Table "${table.name}" has no primary key.`,
        suggestion:
          "Add a primary key column to ensure each row is uniquely identifiable.",
      });
    }
  }

  // 2. Nullable FK
  for (const table of diagram.tables) {
    for (const field of table.fields) {
      if (field.isForeignKey && field.nullable) {
        patterns.push({
          id: nextAntiPatternId(),
          severity: "warning",
          category: "nullable-fk",
          table: table.name,
          field: field.name,
          description: `Foreign key "${field.name}" in table "${table.name}" is nullable.`,
          suggestion:
            "Consider making the foreign key NOT NULL to enforce referential integrity.",
        });
      }
    }
  }

  // 3. Orphan table
  const connectedTableIds = new Set<string>();
  for (const rel of diagram.relationships) {
    connectedTableIds.add(rel.sourceTableId);
    connectedTableIds.add(rel.targetTableId);
  }
  for (const table of nonViewTables) {
    if (!connectedTableIds.has(table.id)) {
      patterns.push({
        id: nextAntiPatternId(),
        severity: "info",
        category: "orphan-table",
        table: table.name,
        description: `Table "${table.name}" has no relationships to other tables.`,
        suggestion:
          "Verify this table is intentionally standalone or add appropriate foreign keys.",
      });
    }
  }

  // 4. Naming - snake_case inconsistency (within same table)
  for (const table of diagram.tables) {
    const camelFields = table.fields.filter((f) => isCamelCase(f.name));
    const snakeFields = table.fields.filter((f) => isSnakeCase(f.name));
    if (camelFields.length > 0 && snakeFields.length > 0) {
      patterns.push({
        id: nextAntiPatternId(),
        severity: "warning",
        category: "naming",
        table: table.name,
        description: `Table "${table.name}" mixes camelCase and snake_case field names.`,
        suggestion:
          "Use a consistent naming convention across all fields in a table.",
      });
    }
  }

  // 5. Naming - reserved words
  for (const table of diagram.tables) {
    if (RESERVED_WORDS.has(table.name.toLowerCase())) {
      patterns.push({
        id: nextAntiPatternId(),
        severity: "info",
        category: "naming",
        table: table.name,
        description: `Table name "${table.name}" is a SQL reserved word.`,
        suggestion:
          "Consider renaming to avoid potential conflicts with SQL keywords.",
      });
    }
    for (const field of table.fields) {
      if (RESERVED_WORDS.has(field.name.toLowerCase())) {
        patterns.push({
          id: nextAntiPatternId(),
          severity: "info",
          category: "naming",
          table: table.name,
          field: field.name,
          description: `Field "${field.name}" in table "${table.name}" is a SQL reserved word.`,
          suggestion:
            "Consider renaming to avoid potential conflicts with SQL keywords.",
        });
      }
    }
  }

  // 6. Type inconsistency - same column name, different types across tables
  const fieldTypeMap = new Map<string, { type: string; table: string }[]>();
  for (const table of diagram.tables) {
    for (const field of table.fields) {
      const key = field.name.toLowerCase();
      const entries = fieldTypeMap.get(key);
      const entry = { type: field.type.toLowerCase(), table: table.name };
      if (entries) {
        entries.push(entry);
      } else {
        fieldTypeMap.set(key, [entry]);
      }
    }
  }
  for (const [fieldName, entries] of fieldTypeMap) {
    if (entries.length < 2) continue;
    const types = new Set(entries.map((e) => e.type));
    if (types.size > 1) {
      const tableNames = entries.map((e) => e.table).join(", ");
      patterns.push({
        id: nextAntiPatternId(),
        severity: "warning",
        category: "type-inconsistency",
        field: fieldName,
        description: `Field "${fieldName}" has inconsistent types across tables: ${tableNames}.`,
        suggestion:
          "Use the same data type for columns with the same name across tables.",
      });
    }
  }

  // 7. Wide table (> 30 fields)
  for (const table of diagram.tables) {
    if (table.fields.length > 30) {
      patterns.push({
        id: nextAntiPatternId(),
        severity: "info",
        category: "wide-table",
        table: table.name,
        description: `Table "${table.name}" has ${table.fields.length} fields, which is unusually wide.`,
        suggestion:
          "Consider normalizing by splitting into related tables to improve maintainability.",
      });
    }
  }

  // 8. Missing index on FK
  for (const table of diagram.tables) {
    if (table.indexes.length === 0) continue;
    const indexedColumns = new Set<string>();
    for (const idx of table.indexes) {
      for (const col of idx.columns) {
        indexedColumns.add(col.toLowerCase());
      }
    }
    for (const field of table.fields) {
      if (field.isForeignKey && !indexedColumns.has(field.name.toLowerCase())) {
        patterns.push({
          id: nextAntiPatternId(),
          severity: "info",
          category: "missing-index",
          table: table.name,
          field: field.name,
          description: `Foreign key "${field.name}" in table "${table.name}" has no index.`,
          suggestion:
            "Add an index on foreign key columns to improve join performance.",
        });
      }
    }
  }

  // 9. Normalization hints (basic 1NF/2NF/3NF detection)
  // 1NF: detect potential multi-value columns (json, array, text with comma patterns in name)
  const multiValuePatterns = /^(tags|categories|items|values|list|roles|permissions|emails|phones|addresses|features|options|labels|keywords|skills|languages|interests|hobbies)$/i;
  const multiValueTypePatterns = /\b(json|jsonb|array|text\[\]|varchar\[\]|_text|_varchar)\b/i;
  for (const table of diagram.tables) {
    for (const field of table.fields) {
      if (multiValuePatterns.test(field.name) || multiValueTypePatterns.test(field.type)) {
        patterns.push({
          id: nextAntiPatternId(),
          severity: "info",
          category: "generic",
          table: table.name,
          field: field.name,
          description: `Field "${field.name}" (${field.type}) in "${table.name}" may violate 1NF by storing multiple values in a single column.`,
          suggestion:
            "Consider normalizing into a separate table with a foreign key relationship.",
        });
      }
    }
  }

  // 2NF: detect tables with composite PK where non-key fields may depend on only part of the key
  for (const table of nonViewTables) {
    const pkFields = table.fields.filter((f) => f.primaryKey);
    const nonPkFields = table.fields.filter((f) => !f.primaryKey);
    if (pkFields.length >= 2 && nonPkFields.length > 0) {
      patterns.push({
        id: nextAntiPatternId(),
        severity: "info",
        category: "generic",
        table: table.name,
        description: `Table "${table.name}" has a composite primary key (${pkFields.map((f) => f.name).join(", ")}) with ${nonPkFields.length} non-key fields — potential 2NF violation if non-key fields depend on only part of the key.`,
        suggestion:
          "Verify that all non-key columns depend on the entire composite key, not just part of it.",
      });
    }
  }

  // 3NF: detect potential transitive dependencies (non-key field referencing another non-key field's table)
  for (const table of nonViewTables) {
    const fkFields = table.fields.filter((f) => f.isForeignKey && !f.primaryKey);
    if (fkFields.length >= 2) {
      // If a table has 2+ FKs to different tables plus its own non-FK/non-PK data columns,
      // it might be a join table or have transitive deps
      const dataFields = table.fields.filter((f) => !f.primaryKey && !f.isForeignKey);
      if (dataFields.length >= 3) {
        patterns.push({
          id: nextAntiPatternId(),
          severity: "info",
          category: "generic",
          table: table.name,
          description: `Table "${table.name}" has ${fkFields.length} foreign keys and ${dataFields.length} data columns — review for potential 3NF transitive dependency violations.`,
          suggestion:
            "Check if any non-key field depends on another non-key field rather than the primary key.",
        });
      }
    }
  }

  // 10. Naming - plural table names inconsistency
  if (nonViewTables.length >= 2) {
    const pluralTables = nonViewTables.filter((t) => looksPlural(t.name));
    const singularTables = nonViewTables.filter((t) => looksSingular(t.name));
    if (pluralTables.length > 0 && singularTables.length > 0) {
      patterns.push({
        id: nextAntiPatternId(),
        severity: "info",
        category: "naming",
        description: `Table naming is inconsistent: some are plural (${pluralTables
          .map((t) => `"${t.name}"`)
          .join(", ")}), some are singular (${singularTables
          .map((t) => `"${t.name}"`)
          .join(", ")}).`,
        suggestion:
          "Choose either plural or singular table names and apply consistently.",
      });
    }
  }

  return patterns;
}

// ─── Quality Score ────────────────────────────────────────────────────────────

export function computeQualityScore(
  diagram: Diagram,
  antiPatterns: AntiPattern[]
): QualityScore {
  const MAX_NAMING = 25;
  const MAX_NORMALIZATION = 25;
  const MAX_RELATIONSHIPS = 25;
  const MAX_INDEXING = 25;

  // Naming: start at 25, deduct 3 per naming anti-pattern
  const namingAntiPatterns = antiPatterns.filter(
    (ap) => ap.category === "naming"
  );
  const naming = Math.max(0, MAX_NAMING - namingAntiPatterns.length * 3);

  // Normalization: start at 25, deduct 5 per wide-table, deduct 3 if orphan > 30%
  const wideTableCount = antiPatterns.filter(
    (ap) => ap.category === "wide-table"
  ).length;
  const nonViewTables = diagram.tables.filter((t) => !t.isView);
  const orphanCount = antiPatterns.filter(
    (ap) => ap.category === "orphan-table"
  ).length;
  const orphanRatio =
    nonViewTables.length > 0 ? orphanCount / nonViewTables.length : 0;
  let normalization = MAX_NORMALIZATION - wideTableCount * 5;
  if (orphanRatio > 0.3) {
    normalization -= 3;
  }
  normalization = Math.max(0, normalization);

  // Relationships: start at 25, deduct 5 per missing-pk, deduct 2 per nullable-fk
  const missingPKCount = antiPatterns.filter(
    (ap) => ap.category === "missing-pk"
  ).length;
  const nullableFKCount = antiPatterns.filter(
    (ap) => ap.category === "nullable-fk"
  ).length;
  const relationships = Math.max(
    0,
    MAX_RELATIONSHIPS - missingPKCount * 5 - nullableFKCount * 2
  );

  // Indexing: start at 25, deduct 2 per missing-index-on-FK
  const missingIndexCount = antiPatterns.filter(
    (ap) => ap.category === "missing-index"
  ).length;
  const indexing = Math.max(0, MAX_INDEXING - missingIndexCount * 2);

  const overall = naming + normalization + relationships + indexing;

  return {
    overall,
    naming,
    normalization,
    relationships,
    indexing,
    breakdown: [
      { category: "naming", score: naming, maxScore: MAX_NAMING },
      {
        category: "normalization",
        score: normalization,
        maxScore: MAX_NORMALIZATION,
      },
      {
        category: "relationships",
        score: relationships,
        maxScore: MAX_RELATIONSHIPS,
      },
      { category: "indexing", score: indexing, maxScore: MAX_INDEXING },
    ],
  };
}
