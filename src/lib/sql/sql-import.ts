import type { DatabaseType, Diagram, DBTable, DBField, DBRelationship, DBIndex } from "@/lib/domain";
import { generateId, getTableColor } from "@/lib/utils";
import { detectDatabaseType } from "./detect-db-type";
import { parseWithNodeSqlParser } from "./dialects/node-sql-parser-dialect";
import { parseWithRegex } from "./dialects/regex-dialect";

export interface ParsedColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  unique: boolean;
  nullable: boolean;
  default?: string;
  comment?: string;
  references?: {
    table: string;
    column: string;
  };
}

export interface ParsedIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ParsedTable {
  name: string;
  schema?: string;
  columns: ParsedColumn[];
  indexes: ParsedIndex[];
  isView: boolean;
  comment?: string;
}

export interface ParsedRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

export interface SQLParseResult {
  tables: ParsedTable[];
  relationships: ParsedRelationship[];
}

function usesRegexParser(dbType: DatabaseType): boolean {
  return dbType === "bigquery" || dbType === "snowflake";
}

function getNodeSqlParserDialect(dbType: DatabaseType): string {
  switch (dbType) {
    case "postgresql":
    case "supabase":
    case "cockroachdb":
      return "PostgreSQL";
    case "mysql":
    case "mariadb":
    case "clickhouse":
      return "MySQL";
    case "sqlite":
      return "SQLite";
    default:
      return "MySQL";
  }
}

export function parseSQLToDiagram(sql: string, name?: string): Diagram {
  const databaseType = detectDatabaseType(sql);
  return parseSQLWithType(sql, databaseType, name);
}

export function parseSQLWithType(
  sql: string,
  databaseType: DatabaseType,
  name?: string
): Diagram {
  let parseResult: SQLParseResult;

  if (usesRegexParser(databaseType)) {
    parseResult = parseWithRegex(sql, databaseType);
  } else {
    const dialect = getNodeSqlParserDialect(databaseType);
    parseResult = parseWithNodeSqlParser(sql, dialect, databaseType);
  }

  return buildDiagram(parseResult, databaseType, name);
}

function buildDiagram(
  parseResult: SQLParseResult,
  databaseType: DatabaseType,
  name?: string
): Diagram {
  const tables: DBTable[] = parseResult.tables.map((pt, index) => {
    const fields: DBField[] = pt.columns.map((col) => ({
      id: generateId(),
      name: col.name,
      type: col.type,
      primaryKey: col.primaryKey,
      unique: col.unique,
      nullable: col.nullable,
      default: col.default,
      comment: col.comment,
      isForeignKey: !!col.references,
      references: col.references
        ? { table: col.references.table, field: col.references.column }
        : undefined,
    }));

    const indexes: DBIndex[] = pt.indexes.map((idx) => ({
      id: generateId(),
      name: idx.name,
      columns: idx.columns,
      unique: idx.unique,
    }));

    return {
      id: generateId(),
      name: pt.name,
      schema: pt.schema,
      fields,
      indexes,
      x: 0,
      y: 0,
      color: getTableColor(index),
      isView: pt.isView,
      comment: pt.comment,
    };
  });

  // Build relationships from parsed foreign keys
  const relationships: DBRelationship[] = [];
  const tableMap = new Map<string, DBTable>();
  for (const table of tables) {
    tableMap.set(table.name.toLowerCase(), table);
  }

  // From inline FK references
  for (const table of tables) {
    for (const field of table.fields) {
      if (field.references) {
        const targetTable = tableMap.get(field.references.table.toLowerCase());
        if (targetTable) {
          const targetField = targetTable.fields.find(
            (f) => f.name.toLowerCase() === field.references!.field.toLowerCase()
          );
          if (targetField) {
            relationships.push({
              id: generateId(),
              sourceTableId: table.id,
              sourceFieldId: field.id,
              targetTableId: targetTable.id,
              targetFieldId: targetField.id,
              cardinality: field.unique ? "one-to-one" : "one-to-many",
            });
          }
        }
      }
    }
  }

  // From ALTER TABLE relationships
  for (const rel of parseResult.relationships) {
    const sourceTable = tableMap.get(rel.sourceTable.toLowerCase());
    const targetTable = tableMap.get(rel.targetTable.toLowerCase());
    if (sourceTable && targetTable) {
      const sourceField = sourceTable.fields.find(
        (f) => f.name.toLowerCase() === rel.sourceColumn.toLowerCase()
      );
      const targetField = targetTable.fields.find(
        (f) => f.name.toLowerCase() === rel.targetColumn.toLowerCase()
      );
      if (sourceField && targetField) {
        // Check for duplicates
        const exists = relationships.some(
          (r) =>
            r.sourceTableId === sourceTable.id &&
            r.sourceFieldId === sourceField.id &&
            r.targetTableId === targetTable.id &&
            r.targetFieldId === targetField.id
        );
        if (!exists) {
          // Mark as FK
          sourceField.isForeignKey = true;
          sourceField.references = {
            table: targetTable.name,
            field: targetField.name,
          };

          relationships.push({
            id: generateId(),
            sourceTableId: sourceTable.id,
            sourceFieldId: sourceField.id,
            targetTableId: targetTable.id,
            targetFieldId: targetField.id,
            cardinality: sourceField.unique ? "one-to-one" : "one-to-many",
          });
        }
      }
    }
  }

  return {
    id: generateId(),
    name: name ?? "Untitled Schema",
    databaseType,
    tables,
    relationships,
    createdAt: new Date().toISOString(),
  };
}
