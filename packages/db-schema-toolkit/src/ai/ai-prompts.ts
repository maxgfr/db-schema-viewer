import type { Diagram } from "../domain";
import { DATABASE_TYPE_LABELS } from "../domain";

export function schemaToPromptContext(diagram: Diagram): string {
  const lines: string[] = [];
  lines.push(`Database: ${DATABASE_TYPE_LABELS[diagram.databaseType]} (${diagram.databaseType})`);
  lines.push(`Tables: ${diagram.tables.length}`);
  lines.push(`Relationships: ${diagram.relationships.length}`);
  lines.push("");

  for (const table of diagram.tables) {
    const prefix = table.isView ? "VIEW" : "TABLE";
    lines.push(`${prefix}: ${table.schema ? `${table.schema}.` : ""}${table.name}`);

    for (const field of table.fields) {
      const flags: string[] = [];
      if (field.primaryKey) flags.push("PK");
      if (field.isForeignKey) flags.push("FK");
      if (field.unique) flags.push("UNIQUE");
      if (!field.nullable) flags.push("NOT NULL");
      if (field.default) flags.push(`DEFAULT ${field.default}`);

      const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
      const refStr = field.references
        ? ` -> ${field.references.table}.${field.references.field}`
        : "";

      lines.push(`  - ${field.name}: ${field.type}${flagStr}${refStr}`);
    }

    if (table.indexes.length > 0) {
      lines.push("  Indexes:");
      for (const idx of table.indexes) {
        lines.push(`    - ${idx.name}: (${idx.columns.join(", ")})${idx.unique ? " UNIQUE" : ""}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}
