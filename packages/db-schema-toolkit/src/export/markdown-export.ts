import type { Diagram } from "../domain";
import { exportDiagramToMermaid } from "./mermaid-export";

export interface MarkdownLabels {
  database: string;
  tables: string;
  generated: string;
  view: string;
  table: string;
  column: string;
  type: string;
  nullable: string;
  pk: string;
  unique: string;
  default: string;
  yes: string;
  no: string;
  indexes: string;
  foreignKeys: string;
  entityRelationshipDiagram: string;
  relationships: string;
}

const DEFAULT_LABELS: MarkdownLabels = {
  database: "Database:",
  tables: "Tables:",
  generated: "Generated:",
  view: "View",
  table: "Table:",
  column: "Column",
  type: "Type",
  nullable: "Nullable",
  pk: "PK",
  unique: "Unique",
  default: "Default",
  yes: "Yes",
  no: "No",
  indexes: "Indexes",
  foreignKeys: "Foreign Keys",
  entityRelationshipDiagram: "Entity Relationship Diagram",
  relationships: "Relationships",
};

export function exportDiagramToMarkdown(diagram: Diagram, labels?: Partial<MarkdownLabels>): string {
  const l = { ...DEFAULT_LABELS, ...labels };
  const lines: string[] = [];

  lines.push(`# ${diagram.name}`);
  lines.push("");
  lines.push(`**${l.database}** ${diagram.databaseType}`);
  lines.push(`**${l.tables}** ${diagram.tables.length}`);
  lines.push(`**${l.generated}** ${new Date().toISOString()}`);
  lines.push("");

  for (const table of diagram.tables) {
    lines.push(`## ${table.isView ? l.view : l.table} ${table.schema ? `${table.schema}.` : ""}${table.name}`);
    lines.push("");

    if (table.comment) {
      lines.push(`> ${table.comment}`);
      lines.push("");
    }

    // Fields table
    lines.push(`| ${l.column} | ${l.type} | ${l.nullable} | ${l.pk} | ${l.unique} | ${l.default} |`);
    lines.push("|--------|------|----------|----|--------|---------|");
    for (const field of table.fields) {
      const pk = field.primaryKey ? l.yes : "";
      const unique = field.unique ? l.yes : "";
      const nullable = field.nullable ? l.yes : l.no;
      const def = field.default ?? "";
      lines.push(`| ${field.name} | ${field.type} | ${nullable} | ${pk} | ${unique} | ${def} |`);
    }
    lines.push("");

    // Indexes
    if (table.indexes.length > 0) {
      lines.push(`### ${l.indexes}`);
      lines.push("");
      for (const idx of table.indexes) {
        lines.push(`- **${idx.name}** (${idx.columns.join(", ")})${idx.unique ? " UNIQUE" : ""}`);
      }
      lines.push("");
    }

    // Foreign keys
    const fks = table.fields.filter((f) => f.references);
    if (fks.length > 0) {
      lines.push(`### ${l.foreignKeys}`);
      lines.push("");
      for (const fk of fks) {
        lines.push(`- \`${fk.name}\` -> \`${fk.references!.table}.${fk.references!.field}\``);
      }
      lines.push("");
    }
  }

  // Mermaid ERD
  if (diagram.tables.length > 0) {
    lines.push(`## ${l.entityRelationshipDiagram}`);
    lines.push("");
    lines.push("```mermaid");
    lines.push(exportDiagramToMermaid(diagram));
    lines.push("```");
    lines.push("");
  }

  // Relationships
  if (diagram.relationships.length > 0) {
    lines.push(`## ${l.relationships}`);
    lines.push("");
    for (const rel of diagram.relationships) {
      const srcTable = diagram.tables.find((t) => t.id === rel.sourceTableId);
      const tgtTable = diagram.tables.find((t) => t.id === rel.targetTableId);
      const srcField = srcTable?.fields.find((f) => f.id === rel.sourceFieldId);
      const tgtField = tgtTable?.fields.find((f) => f.id === rel.targetFieldId);
      if (srcTable && tgtTable && srcField && tgtField) {
        lines.push(`- **${srcTable.name}.${srcField.name}** -> **${tgtTable.name}.${tgtField.name}** (${rel.cardinality})`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
