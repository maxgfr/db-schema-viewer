import { describe, it, expect } from "vitest";
import { detectDatabaseType } from "@/lib/sql/detect-db-type";

describe("detectDatabaseType", () => {
  it("detects PostgreSQL from SERIAL", () => {
    const sql = `CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);`;
    expect(detectDatabaseType(sql)).toBe("postgresql");
  });

  it("detects PostgreSQL from JSONB", () => {
    const sql = `CREATE TABLE data (id INTEGER, metadata JSONB);`;
    expect(detectDatabaseType(sql)).toBe("postgresql");
  });

  it("detects PostgreSQL from UUID", () => {
    const sql = `CREATE TABLE users (id UUID DEFAULT gen_random_uuid(), name TEXT);`;
    expect(detectDatabaseType(sql)).toBe("postgresql");
  });

  it("detects MySQL from AUTO_INCREMENT", () => {
    const sql = `CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255));`;
    expect(detectDatabaseType(sql)).toBe("mysql");
  });

  it("detects MySQL from ENGINE=InnoDB", () => {
    const sql = `CREATE TABLE users (id INT PRIMARY KEY) ENGINE=InnoDB;`;
    expect(detectDatabaseType(sql)).toBe("mysql");
  });

  it("detects SQLite from AUTOINCREMENT", () => {
    const sql = `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);`;
    expect(detectDatabaseType(sql)).toBe("sqlite");
  });

  it("detects MariaDB", () => {
    const sql = `-- MariaDB dump\nCREATE TABLE users (id INT PRIMARY KEY) ENGINE=Aria;`;
    expect(detectDatabaseType(sql)).toBe("mariadb");
  });

  it("detects ClickHouse from MergeTree engine", () => {
    const sql = `CREATE TABLE events (date Date, event_id UInt64) ENGINE = MergeTree() ORDER BY (date);`;
    expect(detectDatabaseType(sql)).toBe("clickhouse");
  });

  it("detects BigQuery from INT64/STRING types", () => {
    const sql = `CREATE TABLE dataset.users (id INT64, name STRING, active BOOL);`;
    expect(detectDatabaseType(sql)).toBe("bigquery");
  });

  it("detects Snowflake from VARIANT type", () => {
    const sql = `CREATE TABLE events (id NUMBER(38,0), data VARIANT, ts TIMESTAMP_NTZ);`;
    expect(detectDatabaseType(sql)).toBe("snowflake");
  });

  it("detects Supabase from auth.users", () => {
    const sql = `CREATE TABLE profiles (id UUID REFERENCES auth.users(id), name TEXT);`;
    expect(detectDatabaseType(sql)).toBe("supabase");
  });

  it("detects CockroachDB from INTERLEAVE IN PARENT", () => {
    const sql = `CREATE TABLE orders (id UUID PRIMARY KEY, user_id UUID) INTERLEAVE IN PARENT users (user_id);`;
    expect(detectDatabaseType(sql)).toBe("cockroachdb");
  });

  it("detects CockroachDB from crdb_internal", () => {
    const sql = `-- CockroachDB schema\nSELECT * FROM crdb_internal.tables;\nCREATE TABLE events (id UUID PRIMARY KEY, name STRING);`;
    expect(detectDatabaseType(sql)).toBe("cockroachdb");
  });

  it("returns generic for plain SQL", () => {
    const sql = `CREATE TABLE foo (id INT, name VARCHAR(50));`;
    expect(detectDatabaseType(sql)).toBe("generic");
  });
});
