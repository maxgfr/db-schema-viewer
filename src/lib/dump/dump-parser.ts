export interface ParsedRow {
  [column: string]: string | number | boolean | null;
}

export interface ParsedDumpTable {
  name: string;
  columns: string[];
  rows: ParsedRow[];
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function parseSQLDump(sql: string): ParsedDumpTable[] {
  if (sql.length > MAX_SIZE) {
    throw new Error(`File too large. Maximum size is 5MB, got ${(sql.length / 1024 / 1024).toFixed(1)}MB.`);
  }

  const tables = new Map<string, ParsedDumpTable>();

  const insertRegex =
    /INSERT\s+INTO\s+(?:["'`]?\w+["'`]?\.)?["'`]?(\w+)["'`]?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]+?);\s*/gi;

  let match;
  while ((match = insertRegex.exec(sql)) !== null) {
    const tableName = match[1]!;
    const columnsStr = match[2];
    const valuesStr = match[3]!;

    const columns = columnsStr
      ? columnsStr.split(",").map((c) => c.trim().replace(/["'`]/g, ""))
      : [];

    const rows = parseValues(valuesStr, columns);

    if (!tables.has(tableName)) {
      tables.set(tableName, { name: tableName, columns, rows: [] });
    }

    const table = tables.get(tableName)!;
    if (table.columns.length === 0 && columns.length > 0) {
      table.columns = columns;
    }
    table.rows.push(...rows);
  }

  return Array.from(tables.values());
}

function parseValues(valuesStr: string, columns: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];

  // Match each (...) group
  const rowRegex = /\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(valuesStr)) !== null) {
    const valStr = rowMatch[1]!;
    const values = splitValues(valStr);
    const row: ParsedRow = {};

    for (let i = 0; i < values.length; i++) {
      const colName = columns[i] ?? `col_${i}`;
      row[colName] = parseValue(values[i]!.trim());
    }

    rows.push(row);
  }

  return rows;
}

function splitValues(str: string): string[] {
  const values: string[] = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let depth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;

    if (inString) {
      if (char === stringChar && str[i - 1] !== "\\") {
        inString = false;
      }
      current += char;
    } else {
      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === "(") {
        depth++;
        current += char;
      } else if (char === ")") {
        depth--;
        current += char;
      } else if (char === "," && depth === 0) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  if (current) values.push(current);

  return values;
}

function parseValue(val: string): string | number | boolean | null {
  if (val.toUpperCase() === "NULL") return null;
  if (val.toUpperCase() === "TRUE") return true;
  if (val.toUpperCase() === "FALSE") return false;

  // Quoted string
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  // Number
  const num = Number(val);
  if (!isNaN(num) && val.trim() !== "") return num;

  return val;
}
