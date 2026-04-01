import { describe, it, expect } from "vitest";
import {
  inlineHelperFunctions,
  inlineObjectSpreads,
} from "@/lib/parsing/inline-helpers";

describe("inlineHelperFunctions", () => {
  it("inlines a function declaration returning an object", () => {
    const content = `
function sharedCols(d) {
  return {
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
    createdAt: d.timestamp(),
  };
}

export const files = createTable("file", (d) => sharedCols(d));
    `;
    const result = inlineHelperFunctions(content);
    expect(result).toContain("(d) => ({");
    expect(result).toContain("id: d.varchar");
    expect(result).toContain("createdAt: d.timestamp");
    // The original function call should be replaced
    expect(result).not.toMatch(/=>\s*sharedCols\s*\(/);
  });

  it("inlines spread calls inside object literals", () => {
    const content = `
function sharedCols(d) {
  return {
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
  };
}

export const users = createTable("user", (d) => ({
  ...sharedCols(d),
  name: d.varchar({ length: 255 }),
}));
    `;
    const result = inlineHelperFunctions(content);
    expect(result).toContain("id: d.varchar");
    expect(result).toContain("name: d.varchar");
    // The spread call should be replaced with inline columns
    expect(result).not.toContain("...sharedCols");
  });

  it("renames parameter when call site uses a different name", () => {
    const content = `
function sharedCols(d) {
  return {
    id: d.varchar({ length: 255 }),
  };
}

export const files = createTable("file", (t) => sharedCols(t));
    `;
    const result = inlineHelperFunctions(content);
    // The inlined code should use 't' instead of 'd'
    expect(result).toContain("id: t.varchar");
    // The direct call should be replaced
    expect(result).toContain("(t) => ({");
    expect(result).not.toMatch(/=>\s*sharedCols\s*\(/);
  });

  it("handles const arrow function with paren-wrapped return", () => {
    const content = `
const sharedCols = (d) => ({
  id: d.varchar({ length: 255 }).notNull().primaryKey(),
  createdAt: d.timestamp(),
});

export const files = createTable("file", (d) => sharedCols(d));
    `;
    const result = inlineHelperFunctions(content);
    expect(result).toContain("(d) => ({");
    expect(result).toContain("id: d.varchar");
  });

  it("handles const arrow function with function body", () => {
    const content = `
const sharedCols = (d) => {
  return {
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
  };
};

export const files = createTable("file", (d) => sharedCols(d));
    `;
    const result = inlineHelperFunctions(content);
    expect(result).toContain("(d) => ({");
    expect(result).toContain("id: d.varchar");
  });

  it("handles function with type annotations", () => {
    const content = `
function sharedCols(d: ColumnBuilder) {
  return {
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
  };
}

export const files = createTable("file", (d) => sharedCols(d));
    `;
    const result = inlineHelperFunctions(content);
    expect(result).toContain("(d) => ({");
    expect(result).toContain("id: d.varchar");
  });

  it("does not modify content when no helpers are found", () => {
    const content = `
export const users = createTable("user", (d) => ({
  id: d.varchar({ length: 255 }),
}));
    `;
    const result = inlineHelperFunctions(content);
    expect(result).toBe(content);
  });

  it("handles multiple helper functions", () => {
    const content = `
function baseCols(d) {
  return {
    id: d.varchar({ length: 255 }).notNull().primaryKey(),
  };
}

function timestampCols(d) {
  return {
    createdAt: d.timestamp(),
    updatedAt: d.timestamp(),
  };
}

export const users = createTable("user", (d) => ({
  ...baseCols(d),
  ...timestampCols(d),
  name: d.varchar({ length: 255 }),
}));
    `;
    const result = inlineHelperFunctions(content);
    expect(result).toContain("id: d.varchar");
    expect(result).toContain("createdAt: d.timestamp");
    expect(result).toContain("updatedAt: d.timestamp");
    expect(result).toContain("name: d.varchar");
  });
});

describe("inlineObjectSpreads", () => {
  it("inlines constant object spreads", () => {
    const content = `
const baseColumns = {
  id: { type: DataTypes.UUID, primaryKey: true },
  createdAt: DataTypes.DATE,
};

const User = sequelize.define('User', {
  ...baseColumns,
  name: DataTypes.STRING,
});
    `;
    const result = inlineObjectSpreads(content);
    expect(result).toContain("id: { type: DataTypes.UUID, primaryKey: true }");
    expect(result).toContain("name: DataTypes.STRING");
    expect(result).not.toContain("...baseColumns");
  });

  it("does not inline objects with return statements", () => {
    const content = `
const factory = {
  create: function() { return {}; },
};

const User = sequelize.define('User', {
  ...factory,
});
    `;
    const result = inlineObjectSpreads(content);
    // factory should NOT be inlined because it contains 'return'
    expect(result).toContain("...factory");
  });

  it("handles typed constant", () => {
    const content = `
const baseColumns: Record<string, any> = {
  id: { type: DataTypes.UUID },
};

const User = sequelize.define('User', {
  ...baseColumns,
});
    `;
    const result = inlineObjectSpreads(content);
    expect(result).toContain("id: { type: DataTypes.UUID }");
  });
});
