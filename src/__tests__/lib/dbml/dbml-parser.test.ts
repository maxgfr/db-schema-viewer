import { describe, it, expect } from "vitest";
import { parseDBMLSchema } from "@/lib/dbml/dbml-parser";

describe("parseDBMLSchema", () => {
  it("parses a single table", () => {
    const dbml = `
      Table users {
        id integer [pk, increment]
        username varchar(50)
        email varchar(255)
      }
    `;
    const diagram = parseDBMLSchema(dbml, "Test");

    expect(diagram.name).toBe("Test");
    expect(diagram.tables).toHaveLength(1);

    const users = diagram.tables[0]!;
    expect(users.name).toBe("users");
    expect(users.fields).toHaveLength(3);

    const idField = users.fields.find((f) => f.name === "id");
    expect(idField).toBeDefined();
    expect(idField!.primaryKey).toBe(true);
    expect(idField!.type).toBe("INTEGER");
  });

  it("parses a table with all attribute types", () => {
    const dbml = `
      Table products {
        id integer [pk, increment]
        name varchar(255) [not null, unique]
        description text [null]
        price decimal [not null, default: 0]
        sku varchar(50) [unique, not null, note: 'Stock Keeping Unit']
      }
    `;
    const diagram = parseDBMLSchema(dbml);

    const products = diagram.tables[0]!;
    expect(products.fields).toHaveLength(5);

    const idField = products.fields.find((f) => f.name === "id")!;
    expect(idField.primaryKey).toBe(true);
    expect(idField.nullable).toBe(false);

    const nameField = products.fields.find((f) => f.name === "name")!;
    expect(nameField.unique).toBe(true);
    expect(nameField.nullable).toBe(false);

    const descField = products.fields.find((f) => f.name === "description")!;
    expect(descField.nullable).toBe(true);

    const priceField = products.fields.find((f) => f.name === "price")!;
    expect(priceField.default).toBe("0");
    expect(priceField.nullable).toBe(false);

    const skuField = products.fields.find((f) => f.name === "sku")!;
    expect(skuField.unique).toBe(true);
    expect(skuField.comment).toBe("Stock Keeping Unit");
  });

  it("parses inline ref", () => {
    const dbml = `
      Table users {
        id integer [pk]
      }

      Table posts {
        id integer [pk]
        author_id integer [ref: > users.id]
      }
    `;
    const diagram = parseDBMLSchema(dbml);

    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships).toHaveLength(1);

    const rel = diagram.relationships[0]!;
    const postsTable = diagram.tables.find((t) => t.name === "posts")!;
    const usersTable = diagram.tables.find((t) => t.name === "users")!;

    expect(rel.sourceTableId).toBe(postsTable.id);
    expect(rel.targetTableId).toBe(usersTable.id);
    expect(rel.cardinality).toBe("one-to-many");

    const authorField = postsTable.fields.find((f) => f.name === "author_id")!;
    expect(authorField.isForeignKey).toBe(true);
    expect(authorField.references).toEqual({ table: "users", field: "id" });
  });

  it("parses standalone Ref", () => {
    const dbml = `
      Table users {
        id integer [pk]
        email varchar(255)
      }

      Table orders {
        id integer [pk]
        user_id integer
      }

      Ref: orders.user_id > users.id
    `;
    const diagram = parseDBMLSchema(dbml);

    expect(diagram.relationships).toHaveLength(1);

    const rel = diagram.relationships[0]!;
    const ordersTable = diagram.tables.find((t) => t.name === "orders")!;
    const usersTable = diagram.tables.find((t) => t.name === "users")!;

    expect(rel.sourceTableId).toBe(ordersTable.id);
    expect(rel.targetTableId).toBe(usersTable.id);
    expect(rel.cardinality).toBe("one-to-many");
  });

  it("parses enum (tables still extracted correctly alongside enums)", () => {
    const dbml = `
      Table posts {
        id integer [pk]
        status post_status
      }

      Enum post_status {
        draft
        published
        archived
      }
    `;
    const diagram = parseDBMLSchema(dbml);

    // Enums are not tables - only the posts table should be extracted
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("posts");

    const statusField = diagram.tables[0]!.fields.find((f) => f.name === "status")!;
    expect(statusField).toBeDefined();
    expect(statusField.type).toBe("POST_STATUS");
  });

  it("parses schema prefix", () => {
    const dbml = `
      Table public.users {
        id integer [pk]
        name varchar(100)
      }
    `;
    const diagram = parseDBMLSchema(dbml);

    expect(diagram.tables).toHaveLength(1);
    const users = diagram.tables[0]!;
    expect(users.name).toBe("users");
    expect(users.schema).toBe("public");
  });

  it("parses multiple tables with relationships", () => {
    const dbml = `
      Table users {
        id integer [pk, increment]
        username varchar(50) [not null, unique]
        email varchar(255) [not null, unique]
        created_at timestamp [default: \`now()\`]
      }

      Table posts {
        id integer [pk, increment]
        title varchar(255) [not null]
        body text
        author_id integer [ref: > users.id]
        status post_status
        created_at timestamp [default: \`now()\`]
      }

      Enum post_status {
        draft
        published
        archived
      }

      Ref: posts.author_id > users.id
    `;
    const diagram = parseDBMLSchema(dbml, "Blog");

    expect(diagram.name).toBe("Blog");
    expect(diagram.tables).toHaveLength(2);

    // There should be 1 relationship (inline + standalone get deduplicated)
    expect(diagram.relationships).toHaveLength(1);

    const rel = diagram.relationships[0]!;
    const postsTable = diagram.tables.find((t) => t.name === "posts")!;
    const usersTable = diagram.tables.find((t) => t.name === "users")!;

    expect(rel.sourceTableId).toBe(postsTable.id);
    expect(rel.targetTableId).toBe(usersTable.id);
  });

  it("handles empty/invalid input", () => {
    const diagram = parseDBMLSchema("");
    expect(diagram.tables).toHaveLength(0);
    expect(diagram.relationships).toHaveLength(0);
    expect(diagram.name).toBe("DBML Schema");
    expect(diagram.databaseType).toBe("generic");
  });

  it("handles invalid DBML gracefully", () => {
    const dbml = `
      This is not valid DBML at all
      Just some random text { with braces }
    `;
    const diagram = parseDBMLSchema(dbml);
    expect(diagram.tables).toHaveLength(0);
    expect(diagram.relationships).toHaveLength(0);
  });

  it("parses table with alias", () => {
    const dbml = `
      Table users as U {
        id integer [pk]
        name varchar(100)
      }
    `;
    const diagram = parseDBMLSchema(dbml);
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("users");
  });

  it("parses one-to-one ref", () => {
    const dbml = `
      Table users {
        id integer [pk]
      }

      Table profiles {
        id integer [pk]
        user_id integer [ref: - users.id]
      }
    `;
    const diagram = parseDBMLSchema(dbml);

    expect(diagram.relationships).toHaveLength(1);
    expect(diagram.relationships[0]!.cardinality).toBe("one-to-one");
  });

  it("generates unique IDs for all entities", () => {
    const dbml = `
      Table a {
        id integer [pk]
      }
      Table b {
        id integer [pk]
        a_id integer [ref: > a.id]
      }
    `;
    const diagram = parseDBMLSchema(dbml);

    const allIds = [
      diagram.id,
      ...diagram.tables.map((t) => t.id),
      ...diagram.tables.flatMap((t) => t.fields.map((f) => f.id)),
      ...diagram.relationships.map((r) => r.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
