import { describe, it, expect } from "vitest";
import { inferColumnType, inferColumnTypes } from "../../src/dump/data-types";

describe("inferColumnType", () => {
  it("infers number type", () => {
    expect(inferColumnType([1, 2, 3, 4.5])).toBe("number");
  });

  it("infers string type", () => {
    expect(inferColumnType(["hello", "world", "test"])).toBe("string");
  });

  it("infers boolean type", () => {
    expect(inferColumnType([true, false, true, true])).toBe("boolean");
  });

  it("infers date type", () => {
    expect(
      inferColumnType(["2024-01-01", "2024-02-15", "2024-03-30"])
    ).toBe("date");
  });

  it("returns null for all nulls", () => {
    expect(inferColumnType([null, null, null])).toBe("null");
  });

  it("handles mixed types (majority wins)", () => {
    // 4 out of 5 are numbers (80%), so it should infer "number"
    expect(inferColumnType([1, 2, 3, 4, "hello"])).toBe("number");
  });
});

describe("inferColumnTypes", () => {
  it("infers types for all columns", () => {
    const types = inferColumnTypes(
      ["id", "name", "active"],
      [
        { id: 1, name: "Alice", active: true },
        { id: 2, name: "Bob", active: false },
      ]
    );
    expect(types.id).toBe("number");
    expect(types.name).toBe("string");
    expect(types.active).toBe("boolean");
  });
});
