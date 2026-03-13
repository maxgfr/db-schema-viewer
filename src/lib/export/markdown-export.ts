import type { Diagram } from "@/lib/domain";
import { exportDiagramToMermaid } from "./mermaid-export";

export function exportDiagramToMarkdown(diagram: Diagram): string {
  const lines: string[] = [];

  lines.push(`# ${diagram.name}`);
  lines.push("");
  lines.push(`**Database:** ${diagram.databaseType}`);
  lines.push(`**Tables:** ${diagram.tables.length}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");

  for (const table of diagram.tables) {
    lines.push(`## ${table.isView ? "View" : "Table"}: ${table.schema ? `${table.schema}.` : ""}${table.name}`);
    lines.push("");

    if (table.comment) {
      lines.push(`> ${table.comment}`);
      lines.push("");
    }

    // Fields table
    lines.push("| Column | Type | Nullable | PK | Unique | Default |");
    lines.push("|--------|------|----------|----|--------|---------|");
    for (const field of table.fields) {
      const pk = field.primaryKey ? "Yes" : "";
      const unique = field.unique ? "Yes" : "";
      const nullable = field.nullable ? "Yes" : "No";
      const def = field.default ?? "";
      lines.push(`| ${field.name} | ${field.type} | ${nullable} | ${pk} | ${unique} | ${def} |`);
    }
    lines.push("");

    // Indexes
    if (table.indexes.length > 0) {
      lines.push("### Indexes");
      lines.push("");
      for (const idx of table.indexes) {
        lines.push(`- **${idx.name}** (${idx.columns.join(", ")})${idx.unique ? " UNIQUE" : ""}`);
      }
      lines.push("");
    }

    // Foreign keys
    const fks = table.fields.filter((f) => f.references);
    if (fks.length > 0) {
      lines.push("### Foreign Keys");
      lines.push("");
      for (const fk of fks) {
        lines.push(`- \`${fk.name}\` -> \`${fk.references!.table}.${fk.references!.field}\``);
      }
      lines.push("");
    }
  }

  // Mermaid ERD
  if (diagram.tables.length > 0) {
    lines.push("## Entity Relationship Diagram");
    lines.push("");
    lines.push("```mermaid");
    lines.push(exportDiagramToMermaid(diagram));
    lines.push("```");
    lines.push("");
  }

  // Relationships
  if (diagram.relationships.length > 0) {
    lines.push("## Relationships");
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
