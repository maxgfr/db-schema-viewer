import { describe, it, expect } from "vitest";
import { parseSQLToDiagram } from "@/lib/sql/sql-import";
import { SAMPLE_SCHEMAS } from "@/lib/sql/sample-schemas";

describe("Sample schemas", () => {
  for (const sample of SAMPLE_SCHEMAS) {
    it(`parses "${sample.name}" sample without errors`, () => {
      const diagram = parseSQLToDiagram(sample.sql, sample.name);
      expect(diagram.tables.length).toBeGreaterThan(0);
      expect(diagram.name).toBe(sample.name);

      // Every table should have at least one field
      for (const table of diagram.tables) {
        if (!table.isView) {
          expect(table.fields.length).toBeGreaterThan(0);
        }
      }
    });
  }

  it("E-commerce sample has relationships", () => {
    const ecommerce = SAMPLE_SCHEMAS.find((s) => s.name === "E-commerce")!;
    const diagram = parseSQLToDiagram(ecommerce.sql, ecommerce.name);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(3);
  });

  it("Blog sample has relationships", () => {
    const blog = SAMPLE_SCHEMAS.find((s) => s.name === "Blog Platform")!;
    const diagram = parseSQLToDiagram(blog.sql, blog.name);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(3);
  });

  it("MySQL E-shop detects mysql type", () => {
    const mysql = SAMPLE_SCHEMAS.find((s) => s.name === "MySQL E-shop")!;
    const diagram = parseSQLToDiagram(mysql.sql, mysql.name);
    expect(diagram.databaseType).toBe("mysql");
  });

  it("SQLite Tasks detects sqlite type", () => {
    const sqlite = SAMPLE_SCHEMAS.find((s) => s.name === "SQLite Tasks")!;
    const diagram = parseSQLToDiagram(sqlite.sql, sqlite.name);
    expect(diagram.databaseType).toBe("sqlite");
  });
});
