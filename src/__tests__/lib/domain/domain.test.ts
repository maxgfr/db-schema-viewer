import { describe, it, expect } from "vitest";
import { DatabaseType, DBField, DBTable, Diagram, Cardinality } from "@/lib/domain";

describe("Domain models", () => {
  describe("DatabaseType", () => {
    it("accepts valid database types", () => {
      expect(DatabaseType.parse("postgresql")).toBe("postgresql");
      expect(DatabaseType.parse("mysql")).toBe("mysql");
      expect(DatabaseType.parse("sqlite")).toBe("sqlite");
      expect(DatabaseType.parse("bigquery")).toBe("bigquery");
    });

    it("rejects invalid types", () => {
      expect(() => DatabaseType.parse("invalid")).toThrow();
    });
  });

  describe("Cardinality", () => {
    it("accepts valid cardinalities", () => {
      expect(Cardinality.parse("one-to-one")).toBe("one-to-one");
      expect(Cardinality.parse("one-to-many")).toBe("one-to-many");
      expect(Cardinality.parse("many-to-many")).toBe("many-to-many");
    });
  });

  describe("DBField", () => {
    it("parses a minimal field", () => {
      const field = DBField.parse({
        id: "f1",
        name: "email",
        type: "VARCHAR(255)",
      });
      expect(field.name).toBe("email");
      expect(field.primaryKey).toBe(false);
      expect(field.nullable).toBe(true);
    });

    it("parses a primary key field", () => {
      const field = DBField.parse({
        id: "f1",
        name: "id",
        type: "SERIAL",
        primaryKey: true,
        nullable: false,
      });
      expect(field.primaryKey).toBe(true);
      expect(field.nullable).toBe(false);
    });
  });

  describe("DBTable", () => {
    it("parses a table with fields", () => {
      const table = DBTable.parse({
        id: "t1",
        name: "users",
        fields: [
          { id: "f1", name: "id", type: "SERIAL", primaryKey: true },
          { id: "f2", name: "email", type: "VARCHAR(255)" },
        ],
      });
      expect(table.name).toBe("users");
      expect(table.fields).toHaveLength(2);
      expect(table.indexes).toHaveLength(0);
    });
  });

  describe("Diagram", () => {
    it("parses a complete diagram", () => {
      const diagram = Diagram.parse({
        id: "d1",
        name: "Test Schema",
        databaseType: "postgresql",
        tables: [
          {
            id: "t1",
            name: "users",
            fields: [{ id: "f1", name: "id", type: "SERIAL" }],
          },
        ],
        relationships: [],
        createdAt: new Date().toISOString(),
      });
      expect(diagram.tables).toHaveLength(1);
      expect(diagram.databaseType).toBe("postgresql");
    });
  });
});
