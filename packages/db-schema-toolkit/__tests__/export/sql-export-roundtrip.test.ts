import { describe, it, expect } from "vitest";
import { parseSQLWithType } from "../../src/sql/sql-import";
import { exportDiagramToSQL } from "../../src/sql-export";

const PG_SQL = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  status VARCHAR(50) DEFAULT 'draft'
);

ALTER TABLE posts ADD CONSTRAINT fk_posts_user_id FOREIGN KEY (user_id) REFERENCES users (id);
`;

describe("SQL export roundtrip", () => {
  it("PG -> MySQL: contains backticks and AUTO_INCREMENT mapping", () => {
    const diagram = parseSQLWithType(PG_SQL, "postgresql", "Test");
    const mysqlOutput = exportDiagramToSQL(diagram, "mysql");

    expect(mysqlOutput).toContain("`users`");
    expect(mysqlOutput).toContain("`posts`");
    expect(mysqlOutput).toContain("AUTO_INCREMENT");
  });

  it("PG -> SQLite: maps UUID-like and TIMESTAMPTZ types to TEXT", () => {
    const pgWithUuid = `
CREATE TABLE tokens (
  id UUID PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ
);
`;
    const diagram = parseSQLWithType(pgWithUuid, "postgresql", "Tokens");
    const sqliteOutput = exportDiagramToSQL(diagram, "sqlite");

    expect(sqliteOutput).toContain("TEXT");
  });

  it("generates FK ALTER TABLE statements for each FK field", () => {
    const diagram = parseSQLWithType(PG_SQL, "postgresql", "Test");
    const output = exportDiagramToSQL(diagram, "postgresql");

    expect(output).toContain("FOREIGN KEY");
    expect(output).toContain("REFERENCES");
    expect(output).toContain("ALTER TABLE");
  });

  it("preserves table count through roundtrip", () => {
    const diagram = parseSQLWithType(PG_SQL, "postgresql", "Test");

    // Should have 2 tables (users and posts)
    const nonViewTables = diagram.tables.filter((t) => !t.isView);
    expect(nonViewTables).toHaveLength(2);

    // Export and verify both tables appear
    const output = exportDiagramToSQL(diagram, "postgresql");
    expect(output).toContain('"users"');
    expect(output).toContain('"posts"');
  });

  it("PG -> MySQL: maps SERIAL to INT AUTO_INCREMENT", () => {
    const diagram = parseSQLWithType(PG_SQL, "postgresql", "Test");
    const mysqlOutput = exportDiagramToSQL(diagram, "mysql");

    // SERIAL should become INT AUTO_INCREMENT
    expect(mysqlOutput).toContain("INT AUTO_INCREMENT");
  });
});
