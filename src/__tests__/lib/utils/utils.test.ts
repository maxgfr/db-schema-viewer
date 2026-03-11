import { describe, it, expect } from "vitest";
import { generateId, getTableColor, TABLE_COLORS } from "@/lib/utils";

describe("generateId", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("generates string IDs", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("IDs contain a timestamp prefix", () => {
    const id = generateId();
    const parts = id.split("-");
    expect(Number(parts[0])).toBeGreaterThan(0);
  });
});

describe("getTableColor", () => {
  it("returns a color for index 0", () => {
    expect(getTableColor(0)).toBe(TABLE_COLORS[0]);
  });

  it("wraps around for large indexes", () => {
    expect(getTableColor(TABLE_COLORS.length)).toBe(TABLE_COLORS[0]);
  });

  it("returns different colors for consecutive indexes", () => {
    expect(getTableColor(0)).not.toBe(getTableColor(1));
  });
});
