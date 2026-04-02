import { describe, it, expect } from "vitest";
import { parseSQLWithType } from "../../src/sql/sql-import";

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

describe("CockroachDB dialect", () => {
  it("parses CockroachDB tables (uses PostgreSQL parser)", () => {
    const sql = `
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending'
      );
    `;
    const diagram = parseSQLWithType(sql, "cockroachdb");
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.tables[0]!.name).toBe("users");
    expect(diagram.tables[1]!.name).toBe("orders");
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(1);
    expect(diagram.databaseType).toBe("cockroachdb");
  });

  it("parses CockroachDB with multiple FKs", () => {
    const sql = `
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL
      );

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        email VARCHAR(255) NOT NULL
      );

      CREATE TABLE documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        title VARCHAR(255) NOT NULL
      );
    `;
    const diagram = parseSQLWithType(sql, "cockroachdb");
    expect(diagram.tables).toHaveLength(3);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(3);
  });
});

describe("MariaDB dialect", () => {
  it("parses MariaDB tables (uses MySQL parser)", () => {
    const sql = `
      -- MariaDB dump
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=Aria DEFAULT CHARSET=utf8mb4;

      CREATE TABLE posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content LONGTEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=Aria DEFAULT CHARSET=utf8mb4;
    `;
    const diagram = parseSQLWithType(sql, "mariadb");
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(1);
    expect(diagram.databaseType).toBe("mariadb");
  });
});

describe("Supabase dialect", () => {
  it("parses Supabase tables (uses PostgreSQL parser)", () => {
    const sql = `
      CREATE TABLE profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id),
        username VARCHAR(50) NOT NULL UNIQUE,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID NOT NULL REFERENCES profiles(id),
        title VARCHAR(255) NOT NULL,
        content TEXT,
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    const diagram = parseSQLWithType(sql, "supabase");
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.tables[0]!.name).toBe("profiles");
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(1);
    expect(diagram.databaseType).toBe("supabase");
  });
});
