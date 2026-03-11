import { describe, it, expect } from "vitest";
import { parseSQLWithType } from "@/lib/sql/sql-import";

describe("BigQuery dialect (regex)", () => {
  it("parses BigQuery CREATE TABLE", () => {
    const sql = `
      CREATE TABLE dataset.users (
        id INT64 NOT NULL,
        name STRING,
        email STRING NOT NULL,
        active BOOL,
        created_at TIMESTAMP
      );
    `;
    const diagram = parseSQLWithType(sql, "bigquery");
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("users");
    expect(diagram.tables[0]!.fields.length).toBeGreaterThanOrEqual(4);
  });

  it("handles BigQuery nested types", () => {
    const sql = `
      CREATE TABLE events (
        event_id INT64,
        event_name STRING,
        event_data STRING
      );
    `;
    const diagram = parseSQLWithType(sql, "bigquery");
    expect(diagram.tables).toHaveLength(1);
  });
});

describe("Snowflake dialect (regex)", () => {
  it("parses Snowflake CREATE TABLE", () => {
    const sql = `
      CREATE TABLE warehouse.public.events (
        id NUMBER(38,0) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload VARIANT,
        created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
      );
    `;
    const diagram = parseSQLWithType(sql, "snowflake");
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("events");
  });

  it("handles Snowflake with schema prefix", () => {
    const sql = `
      CREATE TABLE mydb.users (
        id NUMBER(38,0),
        name VARCHAR(255)
      );
    `;
    const diagram = parseSQLWithType(sql, "snowflake");
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.schema).toBe("mydb");
  });
});

describe("ClickHouse dialect (preprocessed MySQL)", () => {
  it("parses ClickHouse CREATE TABLE", () => {
    const sql = `
      CREATE TABLE events (
        date Date,
        event_id UInt64,
        user_id UInt32,
        event_type String,
        value Float64
      ) ENGINE = MergeTree()
      ORDER BY (date, event_id);
    `;
    const diagram = parseSQLWithType(sql, "clickhouse");
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("events");
    expect(diagram.tables[0]!.fields.length).toBeGreaterThanOrEqual(4);
  });
});

describe("MySQL dialect", () => {
  it("parses MySQL with FOREIGN KEY constraints", () => {
    const sql = `
      CREATE TABLE customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;

      CREATE TABLE orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        total DECIMAL(10,2),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      ) ENGINE=InnoDB;
    `;
    const diagram = parseSQLWithType(sql, "mysql");
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(1);
  });
});

describe("SQLite dialect", () => {
  it("parses SQLite with inline references", () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );

      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL
      );
    `;
    const diagram = parseSQLWithType(sql, "sqlite");
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(1);
  });
});
