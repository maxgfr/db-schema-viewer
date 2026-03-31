import type { Diagram } from "@/lib/domain";
import { t } from "@/lib/i18n/context";
import { exportDiagramToMermaid } from "./mermaid-export";

export function exportDiagramToMarkdown(diagram: Diagram): string {
  const lines: string[] = [];

  lines.push(`# ${diagram.name}`);
  lines.push("");
  lines.push(`**${t("exportFile.database")}** ${diagram.databaseType}`);
  lines.push(`**${t("exportFile.tables")}** ${diagram.tables.length}`);
  lines.push(`**${t("exportFile.generated")}** ${new Date().toISOString()}`);
  lines.push("");

  for (const table of diagram.tables) {
    lines.push(`## ${table.isView ? t("exportFile.view") : t("exportFile.table")} ${table.schema ? `${table.schema}.` : ""}${table.name}`);
    lines.push("");

    if (table.comment) {
      lines.push(`> ${table.comment}`);
      lines.push("");
    }

    // Fields table
    lines.push(`| ${t("exportFile.column")} | ${t("exportFile.type")} | ${t("exportFile.nullable")} | ${t("exportFile.pk")} | ${t("exportFile.unique")} | ${t("exportFile.default")} |`);
    lines.push("|--------|------|----------|----|--------|---------|");
    for (const field of table.fields) {
      const pk = field.primaryKey ? t("exportFile.yes") : "";
      const unique = field.unique ? t("exportFile.yes") : "";
      const nullable = field.nullable ? t("exportFile.yes") : t("exportFile.no");
      const def = field.default ?? "";
      lines.push(`| ${field.name} | ${field.type} | ${nullable} | ${pk} | ${unique} | ${def} |`);
    }
    lines.push("");

    // Indexes
    if (table.indexes.length > 0) {
      lines.push(`### ${t("exportFile.indexes")}`);
      lines.push("");
      for (const idx of table.indexes) {
        lines.push(`- **${idx.name}** (${idx.columns.join(", ")})${idx.unique ? " UNIQUE" : ""}`);
      }
      lines.push("");
    }

    // Foreign keys
    const fks = table.fields.filter((f) => f.references);
    if (fks.length > 0) {
      lines.push(`### ${t("exportFile.foreignKeys")}`);
      lines.push("");
      for (const fk of fks) {
        lines.push(`- \`${fk.name}\` -> \`${fk.references!.table}.${fk.references!.field}\``);
      }
      lines.push("");
    }
  }

  // Mermaid ERD
  if (diagram.tables.length > 0) {
    lines.push(`## ${t("exportFile.entityRelationshipDiagram")}`);
    lines.push("");
    lines.push("```mermaid");
    lines.push(exportDiagramToMermaid(diagram));
    lines.push("```");
    lines.push("");
  }

  // Relationships
  if (diagram.relationships.length > 0) {
    lines.push(`## ${t("exportFile.relationships")}`);
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
