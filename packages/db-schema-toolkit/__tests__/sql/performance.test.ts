import { describe, it, expect } from "vitest";
import { parseSQLToDiagram } from "../../src/sql";

function generateLargeSchema(tableCount: number): string {
  const lines: string[] = [];
  for (let i = 0; i < tableCount; i++) {
    lines.push(`CREATE TABLE table_${i} (`);
    lines.push(`  id SERIAL PRIMARY KEY,`);
    lines.push(`  name VARCHAR(255) NOT NULL,`);
    lines.push(`  value INTEGER DEFAULT 0,`);
    lines.push(`  created_at TIMESTAMP DEFAULT NOW(),`);
    if (i > 0) {
      lines.push(`  parent_id INTEGER REFERENCES table_${i - 1}(id),`);
    }
    lines.push(`  active BOOLEAN DEFAULT TRUE`);
    lines.push(`);`);
    lines.push(``);
  }
  return lines.join("\n");
}

describe("SQL parsing performance", () => {
  it("parses 100 tables under 2 seconds", () => {
    const sql = generateLargeSchema(100);
    const start = performance.now();
    const diagram = parseSQLToDiagram(sql);
    const duration = performance.now() - start;

    expect(diagram.tables.length).toBeGreaterThanOrEqual(90);
    expect(duration).toBeLessThan(2000);
  });

  it("parses 500 tables under 10 seconds", () => {
    const sql = generateLargeSchema(500);
    const start = performance.now();
    const diagram = parseSQLToDiagram(sql);
    const duration = performance.now() - start;

    expect(diagram.tables.length).toBeGreaterThanOrEqual(400);
    expect(duration).toBeLessThan(10000);
  });

  it("parses 1000 tables without crashing", { timeout: 30000 }, () => {
    const sql = generateLargeSchema(1000);
    const start = performance.now();
    const diagram = parseSQLToDiagram(sql);
    const duration = performance.now() - start;

    expect(diagram.tables.length).toBeGreaterThanOrEqual(800);
    expect(duration).toBeLessThan(30000);
    expect(isFinite(duration)).toBe(true);
  });
});
