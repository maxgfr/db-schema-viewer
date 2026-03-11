import type { Diagram } from "@/lib/domain";

export function exportDiagramToMermaid(diagram: Diagram): string {
  const lines: string[] = [];

  lines.push("erDiagram");

  for (const table of diagram.tables) {
    const safeName = table.name.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`    ${safeName} {`);
    for (const field of table.fields) {
      const type = field.type.replace(/\s+/g, "_").replace(/[()]/g, "");
      const safeFName = field.name.replace(/[^a-zA-Z0-9_]/g, "_");
      const annotations: string[] = [];
      if (field.primaryKey) annotations.push("PK");
      if (field.isForeignKey) annotations.push("FK");
      if (field.unique && !field.primaryKey) annotations.push("UK");
      const annotStr = annotations.length > 0 ? ` "${annotations.join(",")}"` : "";
      lines.push(`        ${type} ${safeFName}${annotStr}`);
    }
    lines.push("    }");
  }

  for (const rel of diagram.relationships) {
    const srcTable = diagram.tables.find((t) => t.id === rel.sourceTableId);
    const tgtTable = diagram.tables.find((t) => t.id === rel.targetTableId);
    if (!srcTable || !tgtTable) continue;

    const srcName = srcTable.name.replace(/[^a-zA-Z0-9_]/g, "_");
    const tgtName = tgtTable.name.replace(/[^a-zA-Z0-9_]/g, "_");

    let relSymbol: string;
    switch (rel.cardinality) {
      case "one-to-one":
        relSymbol = "||--||";
        break;
      case "one-to-many":
        relSymbol = "||--o{";
        break;
      case "many-to-many":
        relSymbol = "}o--o{";
        break;
      default:
        relSymbol = "||--o{";
    }

    const srcField = srcTable.fields.find((f) => f.id === rel.sourceFieldId);
    const tgtField = tgtTable.fields.find((f) => f.id === rel.targetFieldId);
    const label = srcField && tgtField
      ? `${srcField.name} to ${tgtField.name}`
      : "relates";

    lines.push(`    ${srcName} ${relSymbol} ${tgtName} : "${label}"`);
  }

  return lines.join("\n");
}
