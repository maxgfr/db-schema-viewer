import { describe, it, expect } from "vitest";
import { toCamelCase } from "@/lib/export/case-utils";

describe("toCamelCase", () => {
  it("converts snake_case", () => {
    expect(toCamelCase("user_name")).toBe("userName");
  });

  it("converts kebab-case", () => {
    expect(toCamelCase("user-name")).toBe("userName");
  });

  it("converts space-separated", () => {
    expect(toCamelCase("user name")).toBe("userName");
  });

  it("handles multiple segments", () => {
    expect(toCamelCase("created_at_date")).toBe("createdAtDate");
  });

  it("handles single word", () => {
    expect(toCamelCase("name")).toBe("name");
  });

  it("lowercases first segment", () => {
    expect(toCamelCase("User_Name")).toBe("userName");
  });

  it("handles empty string", () => {
    expect(toCamelCase("")).toBe("");
  });
});
