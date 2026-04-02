import type { Diagram } from "../domain";

/**
 * Export a Diagram to DBML (Database Markup Language) format.
 * Compatible with dbdiagram.io and other DBML tools.
 */
export function exportDiagramToDBML(diagram: Diagram): string {
  const lines: string[] = [];

  for (const table of diagram.tables) {
    const keyword = table.isView ? "// View:" : "Table";
    const schemaPrefix = table.schema ? `${table.schema}.` : "";
    lines.push(`${keyword} ${schemaPrefix}${table.name} {`);

    for (const field of table.fields) {
      const type = field.type || "varchar";
      const attrs = buildAttributes(field);
      const attrStr = attrs.length > 0 ? ` [${attrs.join(", ")}]` : "";
      lines.push(`  ${field.name} ${type}${attrStr}`);
    }

    if (table.indexes.length > 0) {
      lines.push("");
      lines.push("  indexes {");
      for (const idx of table.indexes) {
        const cols =
          idx.columns.length === 1
            ? idx.columns[0]!
            : `(${idx.columns.join(", ")})`;
        const idxAttrs: string[] = [];
        if (idx.unique) idxAttrs.push("unique");
        if (idx.name) idxAttrs.push(`name: '${idx.name}'`);
        const idxAttrStr = idxAttrs.length > 0 ? ` [${idxAttrs.join(", ")}]` : "";
        lines.push(`    ${cols}${idxAttrStr}`);
      }
      lines.push("  }");
    }

    if (table.comment) {
      lines.push("");
      lines.push(`  Note: '${table.comment.replace(/'/g, "\\'")}'`);
    }

    lines.push("}");
    lines.push("");
  }

  // Relationships as standalone Ref lines
  for (const rel of diagram.relationships) {
    const srcTable = diagram.tables.find((t) => t.id === rel.sourceTableId);
    const tgtTable = diagram.tables.find((t) => t.id === rel.targetTableId);
    if (!srcTable || !tgtTable) continue;

    const srcField = srcTable.fields.find((f) => f.id === rel.sourceFieldId);
    const tgtField = tgtTable.fields.find((f) => f.id === rel.targetFieldId);
    if (!srcField || !tgtField) continue;

    // In DBML: source (FK side) > target (PK side) for many-to-one / one-to-many
    let symbol: string;
    switch (rel.cardinality) {
      case "one-to-one":
        symbol = "-";
        break;
      case "one-to-many":
        symbol = ">";
        break;
      case "many-to-many":
        symbol = "<>";
        break;
      default:
        symbol = ">";
    }

    lines.push(
      `Ref: ${srcTable.name}.${srcField.name} ${symbol} ${tgtTable.name}.${tgtField.name}`,
    );
  }

  return lines.join("\n");
}

function buildAttributes(field: {
  primaryKey: boolean;
  unique: boolean;
  nullable: boolean;
  default?: string;
  comment?: string;
}): string[] {
  const attrs: string[] = [];

  if (field.primaryKey) attrs.push("pk");
  if (field.unique && !field.primaryKey) attrs.push("unique");
  if (!field.nullable && !field.primaryKey) attrs.push("not null");
  if (field.default) attrs.push(`default: '${field.default}'`);
  if (field.comment) attrs.push(`note: '${field.comment.replace(/'/g, "\\'")}'`);

  return attrs;
}
