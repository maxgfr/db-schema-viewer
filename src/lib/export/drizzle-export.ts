import type { Diagram, DBTable, DBField } from "@/lib/domain";
import { toCamelCase } from "./case-utils";

type DrizzleDialect = "pg" | "mysql" | "sqlite";

interface ColumnBuilderInfo {
  builder: string;
  args: string;
  chains: string[];
}

/**
 * Determine the Drizzle dialect from a databaseType.
 */
function getDialect(dbType: string): DrizzleDialect {
  switch (dbType) {
    case "mysql":
    case "mariadb":
      return "mysql";
    case "sqlite":
      return "sqlite";
    default:
      return "pg";
  }
}

/**
 * Get the import module path for the dialect.
 */
function getDialectModule(dialect: DrizzleDialect): string {
  switch (dialect) {
    case "pg":
      return "drizzle-orm/pg-core";
    case "mysql":
      return "drizzle-orm/mysql-core";
    case "sqlite":
      return "drizzle-orm/sqlite-core";
  }
}

/**
 * Get the table function name for the dialect.
 */
function getTableFunction(dialect: DrizzleDialect): string {
  switch (dialect) {
    case "pg":
      return "pgTable";
    case "mysql":
      return "mysqlTable";
    case "sqlite":
      return "sqliteTable";
  }
}

/**
 * Extract length from a type string like VARCHAR(255).
 */
function extractLength(typeStr: string): number | undefined {
  const match = typeStr.match(/\((\d+)\)/);
  return match?.[1] ? parseInt(match[1], 10) : undefined;
}

/**
 * Map a SQL type to a Drizzle column builder for a given dialect.
 */
function mapSqlTypeToDrizzle(sqlType: string, dialect: DrizzleDialect): { builder: string; lengthArg?: number } {
  const upper = sqlType.toUpperCase().replace(/\(.*\)/, "").trim();
  const length = extractLength(sqlType);

  if (dialect === "pg") {
    switch (upper) {
      case "SERIAL":
      case "SMALLSERIAL":
        return { builder: "serial" };
      case "BIGSERIAL":
        return { builder: "bigserial" };
      case "INT":
      case "INTEGER":
      case "SMALLINT":
      case "TINYINT":
      case "MEDIUMINT":
        return { builder: "integer" };
      case "BIGINT":
        return { builder: "bigint" };
      case "VARCHAR":
      case "CHARACTER VARYING":
      case "NVARCHAR":
        return { builder: "varchar", lengthArg: length };
      case "CHAR":
        return { builder: "char", lengthArg: length };
      case "TEXT":
      case "NTEXT":
      case "CLOB":
        return { builder: "text" };
      case "BOOLEAN":
      case "BOOL":
        return { builder: "boolean" };
      case "TIMESTAMP":
      case "TIMESTAMPTZ":
      case "TIMESTAMP WITH TIME ZONE":
      case "TIMESTAMP WITHOUT TIME ZONE":
        return { builder: "timestamp" };
      case "DATE":
        return { builder: "date" };
      case "DATETIME":
        return { builder: "timestamp" };
      case "FLOAT":
      case "REAL":
      case "DOUBLE":
      case "DOUBLE PRECISION":
        return { builder: "real" };
      case "DECIMAL":
      case "NUMERIC":
        return { builder: "decimal" };
      case "JSON":
        return { builder: "json" };
      case "JSONB":
        return { builder: "jsonb" };
      case "UUID":
        return { builder: "uuid" };
      case "BYTEA":
      case "BLOB":
      case "BINARY":
      case "VARBINARY":
        return { builder: "text" }; // Drizzle PG doesn't have a bytea builder out of the box; use text as fallback
      default:
        return { builder: "text" };
    }
  } else if (dialect === "mysql") {
    switch (upper) {
      case "SERIAL":
        return { builder: "serial" };
      case "INT":
      case "INTEGER":
      case "SMALLINT":
      case "TINYINT":
      case "MEDIUMINT":
        return { builder: "int" };
      case "BIGINT":
      case "BIGSERIAL":
        return { builder: "bigint" };
      case "VARCHAR":
      case "CHARACTER VARYING":
      case "NVARCHAR":
        return { builder: "varchar", lengthArg: length };
      case "CHAR":
        return { builder: "char", lengthArg: length };
      case "TEXT":
      case "NTEXT":
      case "CLOB":
        return { builder: "text" };
      case "BOOLEAN":
      case "BOOL":
        return { builder: "boolean" };
      case "TIMESTAMP":
      case "TIMESTAMPTZ":
      case "TIMESTAMP WITH TIME ZONE":
      case "TIMESTAMP WITHOUT TIME ZONE":
        return { builder: "timestamp" };
      case "DATE":
        return { builder: "date" };
      case "DATETIME":
        return { builder: "datetime" };
      case "FLOAT":
      case "REAL":
      case "DOUBLE":
      case "DOUBLE PRECISION":
        return { builder: "real" };
      case "DECIMAL":
      case "NUMERIC":
        return { builder: "decimal" };
      case "JSON":
      case "JSONB":
        return { builder: "json" };
      case "UUID":
        return { builder: "varchar", lengthArg: 36 };
      case "BYTEA":
      case "BLOB":
      case "BINARY":
      case "VARBINARY":
        return { builder: "text" };
      default:
        return { builder: "text" };
    }
  } else {
    // sqlite
    switch (upper) {
      case "INT":
      case "INTEGER":
      case "SMALLINT":
      case "TINYINT":
      case "MEDIUMINT":
      case "SERIAL":
      case "SMALLSERIAL":
      case "BIGSERIAL":
      case "BIGINT":
        return { builder: "integer" };
      case "VARCHAR":
      case "CHARACTER VARYING":
      case "NVARCHAR":
      case "CHAR":
      case "TEXT":
      case "NTEXT":
      case "CLOB":
      case "UUID":
        return { builder: "text" };
      case "BOOLEAN":
      case "BOOL":
        return { builder: "integer" }; // SQLite has no boolean type
      case "TIMESTAMP":
      case "TIMESTAMPTZ":
      case "TIMESTAMP WITH TIME ZONE":
      case "TIMESTAMP WITHOUT TIME ZONE":
      case "DATETIME":
      case "DATE":
        return { builder: "text" }; // SQLite stores dates as text
      case "FLOAT":
      case "REAL":
      case "DOUBLE":
      case "DOUBLE PRECISION":
      case "DECIMAL":
      case "NUMERIC":
        return { builder: "real" };
      case "JSON":
      case "JSONB":
        return { builder: "text" };
      case "BYTEA":
      case "BLOB":
      case "BINARY":
      case "VARBINARY":
        return { builder: "blob" };
      default:
        return { builder: "text" };
    }
  }
}

/**
 * Check if a SQL type represents an auto-incrementing column.
 */
function isAutoIncrement(sqlType: string): boolean {
  const upper = sqlType.toUpperCase();
  return upper === "SERIAL" || upper === "BIGSERIAL" || upper === "SMALLSERIAL" || upper.includes("AUTO_INCREMENT");
}

/**
 * Build a column builder call for a single field.
 */
function buildColumnBuilder(
  field: DBField,
  table: DBTable,
  dialect: DrizzleDialect,
  allTables: DBTable[],
  fkMap: Map<string, { targetTableName: string; targetFieldName: string }>,
): ColumnBuilderInfo {
  const { builder, lengthArg } = mapSqlTypeToDrizzle(field.type, dialect);

  // Build the argument string
  let args: string;
  if (lengthArg !== undefined) {
    args = `"${field.name}", { length: ${lengthArg} }`;
  } else {
    args = `"${field.name}"`;
  }

  const chains: string[] = [];

  if (field.primaryKey) {
    chains.push(".primaryKey()");
  }

  if (!field.nullable && !field.primaryKey && !isAutoIncrement(field.type)) {
    chains.push(".notNull()");
  }

  if (field.unique && !field.primaryKey) {
    chains.push(".unique()");
  }

  // Handle defaults
  if (field.default !== undefined && field.default !== "") {
    const defVal = String(field.default);
    if (defVal.toLowerCase() === "now()" || defVal.toLowerCase() === "current_timestamp") {
      chains.push(".defaultNow()");
    } else if (defVal === "true" || defVal === "false") {
      chains.push(`.default(${defVal})`);
    } else if (!isNaN(Number(defVal))) {
      chains.push(`.default(${defVal})`);
    } else if (defVal.toLowerCase() === "uuid()" || defVal.toLowerCase() === "gen_random_uuid()") {
      chains.push(`.default(sql\`gen_random_uuid()\`)`);
    } else {
      chains.push(`.default("${defVal}")`);
    }
  } else if (isAutoIncrement(field.type) && !field.primaryKey) {
    // Serial types already imply auto increment, no extra default needed
  }

  // Handle FK references
  const fkKey = `${table.id}:${field.id}`;
  const fkInfo = fkMap.get(fkKey);
  if (fkInfo) {
    const targetVarName = toCamelCase(fkInfo.targetTableName);
    const targetFieldCamel = toCamelCase(fkInfo.targetFieldName);
    chains.push(`.references(() => ${targetVarName}.${targetFieldCamel})`);
  }

  return { builder, args, chains };
}

export function exportDiagramToDrizzle(diagram: Diagram): string {
  const dialect = getDialect(diagram.databaseType);
  const dialectModule = getDialectModule(dialect);
  const tableFunction = getTableFunction(dialect);

  // Build FK map: "sourceTableId:sourceFieldId" -> { targetTableName, targetFieldName }
  const fkMap = new Map<string, { targetTableName: string; targetFieldName: string }>();
  for (const rel of diagram.relationships) {
    const targetTable = diagram.tables.find((t) => t.id === rel.targetTableId);
    const targetField = targetTable?.fields.find((f) => f.id === rel.targetFieldId);
    if (targetTable && targetField) {
      fkMap.set(`${rel.sourceTableId}:${rel.sourceFieldId}`, {
        targetTableName: targetTable.name,
        targetFieldName: targetField.name,
      });
    }
  }

  // Also check fields with references property (for cases where relationships array might be empty)
  for (const table of diagram.tables) {
    for (const field of table.fields) {
      if (field.isForeignKey && field.references) {
        const key = `${table.id}:${field.id}`;
        if (!fkMap.has(key)) {
          fkMap.set(key, {
            targetTableName: field.references.table,
            targetFieldName: field.references.field,
          });
        }
      }
    }
  }

  // Collect all column builders used across all tables
  const usedBuilders = new Set<string>();
  usedBuilders.add(tableFunction);

  for (const table of diagram.tables) {
    for (const field of table.fields) {
      const { builder } = mapSqlTypeToDrizzle(field.type, dialect);
      usedBuilders.add(builder);
    }
  }

  // Build import statement
  const builderNames = Array.from(usedBuilders).sort();
  const lines: string[] = [];
  lines.push(`import { ${builderNames.join(", ")} } from "${dialectModule}";`);
  lines.push("");

  // Generate each table
  for (let i = 0; i < diagram.tables.length; i++) {
    const table = diagram.tables[i]!;
    const varName = toCamelCase(table.name);

    lines.push(`export const ${varName} = ${tableFunction}("${table.name}", {`);

    for (const field of table.fields) {
      const colInfo = buildColumnBuilder(field, table, dialect, diagram.tables, fkMap);
      const camelFieldName = toCamelCase(field.name);
      const chainStr = colInfo.chains.join("");
      lines.push(`  ${camelFieldName}: ${colInfo.builder}(${colInfo.args})${chainStr},`);
    }

    lines.push("});");

    if (i < diagram.tables.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}
