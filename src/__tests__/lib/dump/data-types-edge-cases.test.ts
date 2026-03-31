import { describe, it, expect } from "vitest";
import { inferColumnType } from "@/lib/dump/data-types";

describe("inferColumnType edge cases", () => {
  it("infers UUID strings as string", () => {
    const uuids = [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    ];
    expect(inferColumnType(uuids)).toBe("string");
  });

  it("infers JSON strings as string", () => {
    const jsonValues = [
      '{"key": "value"}',
      '{"nested": {"a": 1}}',
      '{"items": [1, 2, 3]}',
    ];
    expect(inferColumnType(jsonValues)).toBe("string");
  });

  it("infers ISO date strings with time as date", () => {
    const isoDates = [
      "2024-01-15T10:30:00Z",
      "2024-06-20T08:00:00+02:00",
      "2024-12-31T23:59:59.999Z",
    ];
    expect(inferColumnType(isoDates)).toBe("date");
  });

  it("infers monetary values as string (not number)", () => {
    const monetary = ["$1,234.56", "$0.99", "$100,000.00", "$50.00"];
    expect(inferColumnType(monetary)).toBe("string");
  });

  it("infers percentage strings as string (not number)", () => {
    const percentages = ["75%", "100%", "0.5%", "33.33%"];
    expect(inferColumnType(percentages)).toBe("string");
  });

  it("returns null for empty array", () => {
    expect(inferColumnType([])).toBe("null");
  });

  it("infers based on majority when mixing number strings and actual numbers", () => {
    // 4 numeric-looking values out of 5 total (80%), should infer "number"
    const mixed = [1, "2", "3", 4, "hello"];
    expect(inferColumnType(mixed)).toBe("number");
  });
});
