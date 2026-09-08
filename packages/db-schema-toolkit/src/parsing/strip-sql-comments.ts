/** Remove SQL comments without changing quoted strings or identifiers. */
export function stripSQLComments(sql: string): string {
  const parts: string[] = [];
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    if (char === "'" || char === '"' || char === "`" || char === "[") {
      const end = char === "[" ? "]" : char;
      i++;
      while (i < sql.length) {
        if (sql[i] === "\\" && char !== "[") { i += 2; continue; }
        if (sql[i] === end) {
          if (sql[i + 1] === end) { i += 2; continue; }
          i++; break;
        }
        i++;
      }
    } else if (char === "$" && /^(?:\$\$|\$[A-Za-z_][\w]*\$)/.test(sql.slice(i))) {
      const delimiter = sql.slice(i).match(/^(?:\$\$|\$[A-Za-z_][\w]*\$)/)![0];
      const end = sql.indexOf(delimiter, i + delimiter.length);
      i = end === -1 ? sql.length : end + delimiter.length;
    } else if (sql.startsWith("--", i) || sql.startsWith("/*", i)) {
      parts.push(sql.slice(start, i));
      const commentStart = i;
      if (sql.startsWith("--", i)) {
        const end = sql.indexOf("\n", i + 2);
        i = end === -1 ? sql.length : end;
      } else {
        let depth = 1;
        i += 2;
        while (i < sql.length && depth) {
          if (sql.startsWith("/*", i)) { depth++; i += 2; }
          else if (sql.startsWith("*/", i)) { depth--; i += 2; }
          else i++;
        }
      }
      parts.push(sql.slice(commentStart, i).replace(/[^\r\n]/g, " "));
      start = i;
    } else i++;
  }
  parts.push(sql.slice(start));
  return parts.join("");
}
