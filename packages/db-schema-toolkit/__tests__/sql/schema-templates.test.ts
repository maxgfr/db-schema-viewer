import { describe, it, expect } from "vitest";
import { SCHEMA_TEMPLATES } from "../../src/sql/schema-templates";
import { parseSQLToDiagram } from "../../src/sql";

describe("schema-templates", () => {
  it("has at least 4 templates", () => {
    expect(SCHEMA_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it("every template has required fields", () => {
    for (const tpl of SCHEMA_TEMPLATES) {
      expect(tpl.name).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(tpl.sql).toBeTruthy();
    }
  });

  for (const tpl of SCHEMA_TEMPLATES) {
    it(`"${tpl.name}" template parses into a valid diagram`, () => {
      const diagram = parseSQLToDiagram(tpl.sql, tpl.name);
      expect(diagram.tables.length).toBeGreaterThan(0);
      expect(diagram.name).toBe(tpl.name);
    });

    it(`"${tpl.name}" template produces relationships`, () => {
      const diagram = parseSQLToDiagram(tpl.sql, tpl.name);
      expect(diagram.relationships.length).toBeGreaterThan(0);
    });
  }
});
