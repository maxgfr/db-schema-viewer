import type { DatabaseType, Diagram } from "../domain";
import type { ParseResult } from "../parsing/types";
import { buildDiagram } from "../parsing/build-diagram";
import { detectDatabaseType } from "./detect-db-type";
import { parseWithNodeSqlParser } from "./dialects/node-sql-parser-dialect";
import { parseWithRegex } from "./dialects/regex-dialect";

// Re-export shared types so existing consumers keep working
export type {
  ParsedColumn,
  ParsedIndex,
  ParsedTable,
  ParsedRelationship,
} from "../parsing/types";
export type { ParseResult as SQLParseResult } from "../parsing/types";

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
  name?: string,
): Diagram {
  let parseResult: ParseResult;

  if (usesRegexParser(databaseType)) {
    parseResult = parseWithRegex(sql, databaseType);
  } else {
    const dialect = getNodeSqlParserDialect(databaseType);
    parseResult = parseWithNodeSqlParser(sql, dialect, databaseType);
  }

  return buildDiagram(
    parseResult.tables,
    parseResult.relationships,
    databaseType,
    name,
  );
}
