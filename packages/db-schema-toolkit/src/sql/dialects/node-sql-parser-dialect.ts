import { Parser } from "node-sql-parser";
import type { DatabaseType } from "../../domain";
import type { ParseResult, ParsedTable, ParsedColumn, ParsedIndex, ParsedRelationship } from "../../parsing/types";


function preprocessSQL(sql: string, dbType: DatabaseType): string {
  let processed = sql;

  // Remove comments
  processed = processed.replace(/--[^\n]*/g, "");
  processed = processed.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove SET statements that node-sql-parser can't handle
  processed = processed.replace(/^\s*SET\s+[^;]+;/gim, "");

  // Remove PRAGMA statements (SQLite)
  processed = processed.replace(/^\s*PRAGMA\s+[^;]+;/gim, "");

  // Remove CREATE EXTENSION
  processed = processed.replace(/^\s*CREATE\s+EXTENSION[^;]+;/gim, "");

  // Remove CREATE TYPE (PG enums) - node-sql-parser can't handle these
  processed = processed.replace(/^\s*CREATE\s+TYPE[^;]+;/gim, "");

  // Remove CREATE SEQUENCE
  processed = processed.replace(/^\s*CREATE\s+SEQUENCE[^;]+;/gim, "");

  // Remove COMMENT ON statements
  processed = processed.replace(/^\s*COMMENT\s+ON[^;]+;/gim, "");

  // ClickHouse preprocessing
  if (dbType === "clickhouse") {
    // Convert ClickHouse ENGINE = ... to be more MySQL-compatible
    processed = processed.replace(/\bENGINE\s*=\s*\w+\([^)]*\)/gi, "");
    processed = processed.replace(/\bENGINE\s*=\s*\w+/gi, "");
    processed = processed.replace(/\bORDER\s+BY\s+\([^)]+\)/gi, "");
    processed = processed.replace(/\bORDER\s+BY\s+\w+/gi, "");
    processed = processed.replace(/\bPARTITION\s+BY\s+[^;]+?(?=\)|$)/gim, "");
    processed = processed.replace(/\bSETTINGS\s+[^;]+/gi, "");
    // Convert ClickHouse types to MySQL-compatible types
    processed = processed.replace(/\bUInt(?:8|16|32|64|128|256)\b/g, "INT");
    processed = processed.replace(/\bInt(?:8|16|32|64|128|256)\b/g, "INT");
    processed = processed.replace(/\bFloat(32|64)\b/g, "FLOAT");
    processed = processed.replace(/\bFixedString\(\d+\)/g, "VARCHAR(255)");
    processed = processed.replace(/\bLowCardinality\((\w+)\)/g, "$1");
    processed = processed.replace(/\bNullable\((\w+)\)/g, "$1");
  }

  // Remove Supabase-specific function calls
  if (dbType === "supabase") {
    processed = processed.replace(/^\s*SELECT\s+[^;]+;/gim, "");
    processed = processed.replace(/^\s*GRANT\s+[^;]+;/gim, "");
    processed = processed.replace(/^\s*REVOKE\s+[^;]+;/gim, "");
  }

  // CockroachDB - remove INTERLEAVE
  if (dbType === "cockroachdb") {
    processed = processed.replace(/\bINTERLEAVE\s+IN\s+PARENT\s+\w+\s*\([^)]*\)/gi, "");
  }

  return processed.trim();
}

function extractTableName(tableObj: any): string {
  if (typeof tableObj === "string") return tableObj;
  if (tableObj?.table) return tableObj.table;
  return String(tableObj);
}

function extractSchema(tableObj: any): string | undefined {
  if (tableObj?.schema || tableObj?.db) {
    return tableObj.schema ?? tableObj.db;
  }
  return undefined;
}

function extractColumnName(colDef: any): string {
  // Handle nested column ref: column.column.expr.value or column.column
  const col = colDef?.column;
  if (typeof col === "string") return col;
  if (col?.column?.expr?.value) return col.column.expr.value;
  if (col?.column) return typeof col.column === "string" ? col.column : String(col.column);
  if (col?.expr?.value) return col.expr.value;
  return "unknown";
}

function extractType(colDef: any): string {
  if (!colDef?.definition?.dataType) return "unknown";
  let type = colDef.definition.dataType;
  if (colDef.definition.length) {
    type += `(${colDef.definition.length})`;
  }
  if (colDef.definition.scale !== undefined && colDef.definition.precision !== undefined) {
    type += `(${colDef.definition.precision}, ${colDef.definition.scale})`;
  }
  // suffix is often an array in pg dialect
  if (colDef.definition.suffix && typeof colDef.definition.suffix === "string") {
    type += ` ${colDef.definition.suffix}`;
  }
  return type;
}

function isNullable(colDef: any): boolean {
  if (!colDef?.nullable) return true;
  return colDef.nullable.value !== "not null";
}

function isPrimaryKey(colDef: any): boolean {
  return (
    colDef?.primary_key === true ||
    colDef?.primary_key === "primary key" ||
    (typeof colDef?.definition?.suffix === "string" &&
      colDef.definition.suffix.toLowerCase().includes("primary key")) ||
    false
  );
}

function isUnique(colDef: any): boolean {
  return colDef?.unique === true || colDef?.unique_or_primary === "unique" || false;
}

function getDefault(colDef: any): string | undefined {
  if (!colDef?.default_val) return undefined;
  const val = colDef.default_val;
  if (val.value?.value !== undefined) return String(val.value.value);
  if (val.value?.name) return val.value.name;
  if (typeof val.value === "string") return val.value;
  return undefined;
}

function extractRefColumnName(refCol: any): string | undefined {
  if (typeof refCol === "string") return refCol;
  if (refCol?.column?.expr?.value) return refCol.column.expr.value;
  if (refCol?.column && typeof refCol.column === "string") return refCol.column;
  if (refCol?.expr?.value) return refCol.expr.value;
  return undefined;
}

function extractInlineFK(colDef: any): { table: string; column: string } | undefined {
  if (colDef?.reference_definition) {
    const ref = colDef.reference_definition;
    const table = extractTableName(ref.table?.[0]);
    const column = extractRefColumnName(ref.definition?.[0]) ?? extractRefColumnName(ref.columns?.[0]);
    if (table && column) {
      return { table, column };
    }
  }
  return undefined;
}

export function parseWithNodeSqlParser(
  sql: string,
  dialect: string,
  dbType: DatabaseType
): ParseResult {
  const preprocessed = preprocessSQL(sql, dbType);
  const parser = new Parser();

  const tables: ParsedTable[] = [];
  const relationships: ParsedRelationship[] = [];

  // Split into statements and parse individually for resilience
  const statements = preprocessed
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      const ast = parser.astify(`${stmt};`, {
        database: dialect,
      });

      const astArr = Array.isArray(ast) ? ast : [ast];

      for (const node of astArr) {
        if (!node) continue;

        if (node.type === "create" && node.keyword === "table") {
          const table = parseCreateTable(node);
          if (table) {
            tables.push(table);
            // Extract inline FK relationships
            for (const col of table.columns) {
              if (col.references) {
                relationships.push({
                  sourceTable: table.name,
                  sourceColumn: col.name,
                  targetTable: col.references.table,
                  targetColumn: col.references.column,
                });
              }
            }
          }
        }

        if (node.type === "create" && node.keyword === "view") {
          const viewTable = Array.isArray(node.table) ? node.table[0] : node.table;
          tables.push({
            name: extractTableName(viewTable),
            schema: extractSchema(viewTable),
            columns: [],
            indexes: [],
            isView: true,
          });
        }

        if (node.type === "alter") {
          const alterRels = parseAlterTable(node);
          relationships.push(...alterRels);
        }
      }
    } catch {
      // Statement couldn't be parsed - try regex fallback for this statement
      const fallbackTable = tryRegexFallback(stmt);
      if (fallbackTable) {
        tables.push(fallbackTable);
      }
    }
  }

  return { tables, relationships };
}

function parseCreateTable(node: any): ParsedTable | null {
  const tableName = extractTableName(node.table?.[0]);
  const schema = extractSchema(node.table?.[0]);
  if (!tableName) return null;

  const columns: ParsedColumn[] = [];
  const indexes: ParsedIndex[] = [];
  const primaryKeyColumns: string[] = [];

  const definitions = node.create_definitions ?? [];

  for (const def of definitions) {
    if (def.resource === "column") {
      const col: ParsedColumn = {
        name: extractColumnName(def),
        type: extractType(def),
        primaryKey: isPrimaryKey(def),
        unique: isUnique(def),
        nullable: isNullable(def),
        default: getDefault(def),
      };

      const inlineRef = extractInlineFK(def);
      if (inlineRef) {
        col.references = inlineRef;
      }

      columns.push(col);
    }

    // Constraint: PRIMARY KEY
    if (def.resource === "constraint" && def.constraint_type === "primary key") {
      const pkCols = def.definition?.map((d: any) => extractRefColumnName(d) ?? d) ?? [];
      primaryKeyColumns.push(...pkCols);
    }

    // Constraint: UNIQUE
    if (def.resource === "constraint" && def.constraint_type === "unique") {
      const uqCols = def.definition?.map((d: any) => extractRefColumnName(d) ?? d) ?? [];
      const idxName = def.constraint ?? `uq_${tableName}_${uqCols.join("_")}`;
      indexes.push({
        name: idxName,
        columns: uqCols,
        unique: true,
      });
      // Mark columns
      for (const col of columns) {
        if (uqCols.includes(col.name)) {
          col.unique = true;
        }
      }
    }

    // Constraint: FOREIGN KEY
    if (def.resource === "constraint" && def.constraint_type === "FOREIGN KEY") {
      const fkCols = def.definition?.map((d: any) => extractRefColumnName(d) ?? d) ?? [];
      const refTable = extractTableName(def.reference_definition?.table?.[0]);
      const refCols = def.reference_definition?.definition?.map(
        (d: any) => extractRefColumnName(d) ?? d
      ) ?? [];

      if (fkCols.length > 0 && refTable && refCols.length > 0) {
        for (let i = 0; i < fkCols.length; i++) {
          const col = columns.find((c) => c.name === fkCols[i]);
          if (col) {
            col.references = {
              table: refTable,
              column: refCols[i] ?? refCols[0],
            };
          }
        }
      }
    }
  }

  // Apply primary key from constraint
  for (const col of columns) {
    if (primaryKeyColumns.includes(col.name)) {
      col.primaryKey = true;
      col.nullable = false;
    }
  }

  return {
    name: tableName,
    schema,
    columns,
    indexes,
    isView: false,
  };
}

function parseAlterTable(node: any): ParsedRelationship[] {
  const relationships: ParsedRelationship[] = [];
  const tableName = extractTableName(node.table?.[0]);
  if (!tableName) return relationships;

  const exprs = node.expr ?? [];
  for (const expr of exprs) {
    if (expr.action === "add" && expr.resource === "constraint") {
      // create_definitions can be an object (single) or an array
      const defs = expr.create_definitions
        ? Array.isArray(expr.create_definitions)
          ? expr.create_definitions
          : [expr.create_definitions]
        : [];

      for (const def of defs) {
        if (def.constraint_type === "FOREIGN KEY") {
          const fkCols = def.definition?.map((d: any) => extractRefColumnName(d) ?? d) ?? [];
          const refTable = extractTableName(
            def.reference_definition?.table?.[0]
          );
          const refCols = def.reference_definition?.definition?.map(
            (d: any) => extractRefColumnName(d) ?? d
          ) ?? [];

          for (let i = 0; i < fkCols.length; i++) {
            if (refTable && refCols[i]) {
              relationships.push({
                sourceTable: tableName,
                sourceColumn: fkCols[i],
                targetTable: refTable,
                targetColumn: refCols[i],
              });
            }
          }
        }
      }
    }
  }

  return relationships;
}

function tryRegexFallback(stmt: string): ParsedTable | null {
  const createMatch = stmt.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["'`]?(\w+)["'`]?\.)?["'`]?(\w+)["'`]?\s*\(([\s\S]+)\)/i
  );
  if (!createMatch) return null;

  const schema = createMatch[1];
  const tableName = createMatch[2]!;
  const body = createMatch[3]!;

  const columns: ParsedColumn[] = [];
  const lines = body.split(",").map((l) => l.trim());

  for (const line of lines) {
    // Skip constraints
    if (/^\s*(PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|CONSTRAINT|INDEX|KEY)\b/i.test(line)) {
      continue;
    }

    const colMatch = line.match(
      /^["'`]?(\w+)["'`]?\s+(\w+(?:\([^)]*\))?(?:\s+\w+)*)/i
    );
    if (colMatch) {
      const colName = colMatch[1]!;
      const colType = colMatch[2]!;

      columns.push({
        name: colName,
        type: colType.split(/\s+(NOT|NULL|DEFAULT|PRIMARY|UNIQUE|REFERENCES|CHECK)/i)[0]!.trim(),
        primaryKey: /PRIMARY\s+KEY/i.test(line),
        unique: /\bUNIQUE\b/i.test(line),
        nullable: !/NOT\s+NULL/i.test(line),
      });
    }
  }

  return {
    name: tableName,
    schema,
    columns,
    indexes: [],
    isView: false,
  };
}
