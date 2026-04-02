import { describe, it, expect } from "vitest";
import { extractBraceBlock } from "../../src/parsing/extract-brace-block";

describe("extractBraceBlock", () => {
  it("extracts content between matching braces", () => {
    const content = "{ hello }";
    expect(extractBraceBlock(content, 0)).toBe(" hello ");
  });

  it("handles nested braces", () => {
    const content = "{ a { b } c }";
    expect(extractBraceBlock(content, 0)).toBe(" a { b } c ");
  });

  it("handles deeply nested braces", () => {
    const content = "{ a { b { c } d } e }";
    expect(extractBraceBlock(content, 0)).toBe(" a { b { c } d } e ");
  });

  it("starts from given index", () => {
    const content = "prefix { inner } suffix";
    expect(extractBraceBlock(content, 7)).toBe(" inner ");
  });

  it("returns null for unbalanced braces", () => {
    const content = "{ a { b }";
    expect(extractBraceBlock(content, 0)).toBeNull();
  });

  it("returns null when no opening brace at index", () => {
    const content = "no braces here";
    expect(extractBraceBlock(content, 0)).toBeNull();
  });

  it("returns empty string for empty braces", () => {
    const content = "{}";
    expect(extractBraceBlock(content, 0)).toBe("");
  });

  it("handles real-world Drizzle table body", () => {
    const content = `createTable("user", (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    name: d.varchar({ length: 255 }),
}))`;
    const startIdx = content.indexOf("{", content.indexOf("({"));
    const body = extractBraceBlock(content, startIdx);
    expect(body).toContain("id: d.varchar");
    expect(body).toContain("name: d.varchar");
  });
});
