import type { Diagram, DBTable, DBField, DatabaseType } from "@/lib/domain";

const TYPE_MAP: Record<string, Partial<Record<DatabaseType, string>>> = {
  serial: { mysql: "INT AUTO_INCREMENT", sqlite: "INTEGER", bigquery: "INT64" },
  bigserial: { mysql: "BIGINT AUTO_INCREMENT", sqlite: "INTEGER", bigquery: "INT64" },
  boolean: { mysql: "TINYINT(1)", bigquery: "BOOL" },
  jsonb: { mysql: "JSON", sqlite: "TEXT", bigquery: "STRING" },
  json: { sqlite: "TEXT", bigquery: "STRING" },
  uuid: { mysql: "CHAR(36)", sqlite: "TEXT", bigquery: "STRING" },
  timestamptz: { mysql: "TIMESTAMP", sqlite: "TEXT", bigquery: "TIMESTAMP" },
  text: { bigquery: "STRING" },
  varchar: { bigquery: "STRING" },
  integer: { bigquery: "INT64" },
  bigint: { bigquery: "INT64" },
  smallint: { bigquery: "INT64" },
  real: { bigquery: "FLOAT64" },
  "double precision": { bigquery: "FLOAT64" },
  numeric: { bigquery: "NUMERIC" },
  bytea: { mysql: "BLOB", sqlite: "BLOB", bigquery: "BYTES" },
};

function mapType(type: string, targetDb: DatabaseType): string {
  const lower = type.toLowerCase().replace(/\(.*\)/, "").trim();
  const mapped = TYPE_MAP[lower];
  if (mapped?.[targetDb]) {
    return mapped[targetDb]!;
  }
  return type;
}

function quoteIdentifier(name: string, dbType: DatabaseType): string {
  switch (dbType) {
    case "mysql":
    case "mariadb":
    case "clickhouse":
      return `\`${name.replace(/`/g, "``")}\``;
    case "postgresql":
    case "supabase":
    case "cockroachdb":
      return `"${name.replace(/"/g, '""')}"`;
    case "sqlite":
      return `"${name.replace(/"/g, '""')}"`;
    case "bigquery":
    case "snowflake":
      return name;
    default:
      return `"${name.replace(/"/g, '""')}"`;
  }
}

function generateCreateTable(table: DBTable, targetDb: DatabaseType): string {
  const qName = table.schema
    ? `${quoteIdentifier(table.schema, targetDb)}.${quoteIdentifier(table.name, targetDb)}`
    : quoteIdentifier(table.name, targetDb);

  const lines: string[] = [];
  lines.push(`CREATE TABLE ${qName} (`);

  const fieldDefs: string[] = [];
  const pks: string[] = [];

  for (const field of table.fields) {
    const parts: string[] = [];
    parts.push(`  ${quoteIdentifier(field.name, targetDb)}`);
    parts.push(mapType(field.type, targetDb));

    if (field.primaryKey) pks.push(field.name);
    if (!field.nullable) parts.push("NOT NULL");
    if (field.unique && !field.primaryKey) parts.push("UNIQUE");
    if (field.default) parts.push(`DEFAULT ${field.default}`);

    fieldDefs.push(parts.join(" "));
  }

  if (pks.length > 0) {
    fieldDefs.push(
      `  PRIMARY KEY (${pks.map((pk) => quoteIdentifier(pk, targetDb)).join(", ")})`
    );
  }

  lines.push(fieldDefs.join(",\n"));
  lines.push(");");

  return lines.join("\n");
}

function generateFK(
  table: DBTable,
  field: DBField,
  targetDb: DatabaseType
): string | null {
  if (!field.references) return null;
  const srcTable = quoteIdentifier(table.name, targetDb);
  const srcCol = quoteIdentifier(field.name, targetDb);
  const refTable = quoteIdentifier(field.references.table, targetDb);
  const refCol = quoteIdentifier(field.references.field, targetDb);

  // BigQuery doesn't support ON DELETE/UPDATE actions
  const cascade = targetDb === "bigquery" ? "" : " ON DELETE CASCADE ON UPDATE CASCADE";

  return `ALTER TABLE ${srcTable} ADD CONSTRAINT fk_${table.name}_${field.name} FOREIGN KEY (${srcCol}) REFERENCES ${refTable} (${refCol})${cascade};`;
}

function generateIndexes(table: DBTable, targetDb: DatabaseType): string[] {
  const statements: string[] = [];
  for (const idx of table.indexes) {
    const tableName = quoteIdentifier(table.name, targetDb);
    const cols = idx.columns.map((c) => quoteIdentifier(c, targetDb)).join(", ");
    const unique = idx.unique ? "UNIQUE " : "";
    const idxName = idx.name || `idx_${table.name}_${idx.columns.join("_")}`;
    statements.push(`CREATE ${unique}INDEX ${quoteIdentifier(idxName, targetDb)} ON ${tableName} (${cols});`);
  }
  return statements;
}

function generateComments(table: DBTable, targetDb: DatabaseType): string[] {
  // COMMENT ON is only supported by PostgreSQL-family and Snowflake
  if (!["postgresql", "supabase", "cockroachdb", "snowflake"].includes(targetDb)) return [];

  const statements: string[] = [];
  const tableName = quoteIdentifier(table.name, targetDb);

  if (table.comment) {
    statements.push(`COMMENT ON TABLE ${tableName} IS '${table.comment.replace(/'/g, "''")}';`);
  }

  for (const field of table.fields) {
    if (field.comment) {
      statements.push(`COMMENT ON COLUMN ${tableName}.${quoteIdentifier(field.name, targetDb)} IS '${field.comment.replace(/'/g, "''")}';`);
    }
  }

  return statements;
}

function collectEnumTypes(diagram: Diagram): Map<string, string[]> {
  const enums = new Map<string, string[]>();
  for (const table of diagram.tables) {
    for (const field of table.fields) {
      // Detect ENUM(TypeName) pattern from Prisma/Drizzle parsers
      const enumMatch = field.type.match(/^ENUM\((\w+)\)$/i);
      if (enumMatch) {
        const enumName = enumMatch[1]!;
        if (!enums.has(enumName)) {
          enums.set(enumName, []);
        }
      }
    }
  }
  return enums;
}

function generateEnumTypes(enums: Map<string, string[]>, targetDb: DatabaseType): string[] {
  if (enums.size === 0) return [];
  // Only PostgreSQL-family supports CREATE TYPE ... AS ENUM
  if (!["postgresql", "supabase", "cockroachdb"].includes(targetDb)) return [];

  const statements: string[] = [];
  for (const [enumName] of enums) {
    // We don't have the actual enum values from the diagram, so generate a placeholder
    statements.push(`CREATE TYPE ${quoteIdentifier(enumName, targetDb)} AS ENUM ();`);
  }
  return statements;
}

function generateViews(diagram: Diagram, targetDb: DatabaseType): string[] {
  const statements: string[] = [];
  for (const table of diagram.tables) {
    if (!table.isView) continue;
    const qName = table.schema
      ? `${quoteIdentifier(table.schema, targetDb)}.${quoteIdentifier(table.name, targetDb)}`
      : quoteIdentifier(table.name, targetDb);
    const cols = table.fields.map((f) => quoteIdentifier(f.name, targetDb)).join(", ");
    statements.push(`-- View: ${table.name} (columns: ${table.fields.map((f) => f.name).join(", ")})`);
    statements.push(`CREATE OR REPLACE VIEW ${qName} AS`);
    statements.push(`  SELECT ${cols || "*"}`);
    statements.push(`  FROM /* source table */;`);
  }
  return statements;
}

export function exportDiagramToSQL(diagram: Diagram, targetDb?: DatabaseType): string {
  const db = targetDb ?? diagram.databaseType;
  const parts: string[] = [];

  parts.push(`-- Generated by db-schema-viewer`);
  parts.push(`-- Database: ${db}`);
  parts.push(`-- Date: ${new Date().toISOString()}`);
  parts.push("");

  // Enum types (PostgreSQL-family)
  const enums = collectEnumTypes(diagram);
  const enumStatements = generateEnumTypes(enums, db);
  if (enumStatements.length > 0) {
    parts.push("-- Enum types");
    parts.push(...enumStatements);
    parts.push("");
  }

  // Create tables
  for (const table of diagram.tables) {
    if (table.isView) continue;
    parts.push(generateCreateTable(table, db));
    parts.push("");
  }

  // Foreign keys
  const fkStatements: string[] = [];
  for (const table of diagram.tables) {
    for (const field of table.fields) {
      const fk = generateFK(table, field, db);
      if (fk) fkStatements.push(fk);
    }
  }
  if (fkStatements.length > 0) {
    parts.push(...fkStatements);
    parts.push("");
  }

  // Indexes
  const indexStatements: string[] = [];
  for (const table of diagram.tables) {
    if (table.isView) continue;
    indexStatements.push(...generateIndexes(table, db));
  }
  if (indexStatements.length > 0) {
    parts.push("-- Indexes");
    parts.push(...indexStatements);
    parts.push("");
  }

  // Comments (PostgreSQL-family only)
  const commentStatements: string[] = [];
  for (const table of diagram.tables) {
    commentStatements.push(...generateComments(table, db));
  }
  if (commentStatements.length > 0) {
    parts.push("-- Comments");
    parts.push(...commentStatements);
    parts.push("");
  }

  // Views
  const viewStatements = generateViews(diagram, db);
  if (viewStatements.length > 0) {
    parts.push("-- Views");
    parts.push(...viewStatements);
    parts.push("");
  }

  return parts.join("\n");
}
