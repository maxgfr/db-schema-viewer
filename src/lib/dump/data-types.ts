export type InferredType = "number" | "string" | "date" | "boolean" | "null";

export function inferColumnType(values: (string | number | boolean | null)[]): InferredType {
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  if (nonNull.length === 0) return "null";

  let numbers = 0;
  let booleans = 0;
  let dates = 0;

  for (const val of nonNull) {
    if (typeof val === "boolean") {
      booleans++;
      continue;
    }
    if (typeof val === "number") {
      numbers++;
      continue;
    }
    const str = String(val);
    if (/^\d{4}-\d{2}-\d{2}/.test(str) && !isNaN(Date.parse(str))) {
      dates++;
    } else if (!isNaN(Number(str)) && str.trim() !== "") {
      numbers++;
    }
  }

  if (booleans >= nonNull.length * 0.8) return "boolean";
  if (numbers >= nonNull.length * 0.8) return "number";
  if (dates >= nonNull.length * 0.8) return "date";
  return "string";
}

export function inferColumnTypes(
  columns: string[],
  rows: Record<string, string | number | boolean | null>[]
): Record<string, InferredType> {
  const result: Record<string, InferredType> = {};
  for (const col of columns) {
    const values = rows.map((r) => r[col] ?? null);
    result[col] = inferColumnType(values);
  }
  return result;
}
