import { describe, it, expect } from "vitest";
import { exportDiagramToPrisma } from "@/lib/export/prisma-export";
import type { Diagram } from "@/lib/domain";

describe("exportDiagramToPrisma", () => {
  it("generates a basic table with a primary key", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToPrisma(diagram);
    expect(result).toContain("model User {");
    expect(result).toContain("id Int @id");
    expect(result).toContain('@@map("users")');
  });

  it("maps various SQL types to Prisma types", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "AllTypes",
          fields: [
            { id: "f1", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f2", name: "name", type: "VARCHAR(255)", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
            { id: "f3", name: "bio", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f4", name: "active", type: "BOOLEAN", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
            { id: "f5", name: "created_at", type: "TIMESTAMP", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f6", name: "score", type: "FLOAT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f7", name: "metadata", type: "JSONB", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f8", name: "big_num", type: "BIGINT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f9", name: "data", type: "BYTEA", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToPrisma(diagram);
    expect(result).toContain("id Int @id");
    expect(result).toContain("name String");
    expect(result).toContain("bio String?");
    expect(result).toContain("active Boolean");
    expect(result).toContain("createdAt DateTime?");
    expect(result).toContain("score Float?");
    expect(result).toContain("metadata Json?");
    expect(result).toContain("bigNum BigInt?");
    expect(result).toContain("data Bytes?");
  });

  it("generates @relation directives for FK relationships", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f2", name: "email", type: "VARCHAR(255)", primaryKey: false, unique: true, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
        {
          id: "t2",
          name: "posts",
          fields: [
            { id: "f3", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f4", name: "author_id", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: true },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [
        {
          id: "r1",
          sourceTableId: "t2",
          sourceFieldId: "f4",
          targetTableId: "t1",
          targetFieldId: "f1",
          cardinality: "one-to-many",
        },
      ],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToPrisma(diagram);
    // The Post model should have a relation field
    expect(result).toContain("@relation(fields: [authorId], references: [id])");
    // The User model should have a reverse relation
    expect(result).toContain("posts Post[]");
  });

  it("marks nullable fields with ?", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "items",
          fields: [
            { id: "f1", name: "id", type: "INTEGER", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f2", name: "description", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f3", name: "title", type: "VARCHAR(255)", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToPrisma(diagram);
    expect(result).toContain("description String?");
    // title is NOT nullable, should not have ?
    expect(result).toMatch(/title String[^?]/);
  });

  it("generates @default(autoincrement()) for SERIAL types", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToPrisma(diagram);
    expect(result).toContain("@id");
    expect(result).toContain("@default(autoincrement())");
  });

  it("generates a full schema with multiple tables and relationships", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Blog",
      databaseType: "postgresql",
      tables: [
        {
          id: "t1",
          name: "users",
          fields: [
            { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f2", name: "email", type: "VARCHAR(255)", primaryKey: false, unique: true, nullable: false, isForeignKey: false },
            { id: "f3", name: "name", type: "VARCHAR(100)", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f4", name: "created_at", type: "TIMESTAMP", primaryKey: false, unique: false, nullable: true, default: "now()", isForeignKey: false },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
        {
          id: "t2",
          name: "posts",
          fields: [
            { id: "f5", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f6", name: "title", type: "VARCHAR(255)", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
            { id: "f7", name: "content", type: "TEXT", primaryKey: false, unique: false, nullable: true, isForeignKey: false },
            { id: "f8", name: "author_id", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: true },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
        {
          id: "t3",
          name: "comments",
          fields: [
            { id: "f9", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
            { id: "f10", name: "body", type: "TEXT", primaryKey: false, unique: false, nullable: false, isForeignKey: false },
            { id: "f11", name: "post_id", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: true },
            { id: "f12", name: "user_id", type: "INTEGER", primaryKey: false, unique: false, nullable: false, isForeignKey: true },
          ],
          indexes: [],
          x: 0,
          y: 0,
          isView: false,
        },
      ],
      relationships: [
        {
          id: "r1",
          sourceTableId: "t2",
          sourceFieldId: "f8",
          targetTableId: "t1",
          targetFieldId: "f1",
          cardinality: "one-to-many",
        },
        {
          id: "r2",
          sourceTableId: "t3",
          sourceFieldId: "f11",
          targetTableId: "t2",
          targetFieldId: "f5",
          cardinality: "one-to-many",
        },
        {
          id: "r3",
          sourceTableId: "t3",
          sourceFieldId: "f12",
          targetTableId: "t1",
          targetFieldId: "f1",
          cardinality: "one-to-many",
        },
      ],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToPrisma(diagram);

    // Check header
    expect(result).toContain('provider = "prisma-client-js"');
    expect(result).toContain('provider = "postgresql"');
    expect(result).toContain('url      = env("DATABASE_URL")');

    // Check all models exist
    expect(result).toContain("model User {");
    expect(result).toContain("model Post {");
    expect(result).toContain("model Comment {");

    // Check User has reverse relation fields
    expect(result).toContain("posts Post[]");
    expect(result).toContain("comments Comment[]");

    // Check Post has FK relation to User
    expect(result).toContain("author User @relation(fields: [authorId], references: [id])");

    // Check Comment has FK relations
    expect(result).toContain("@relation(fields: [postId], references: [id])");
    expect(result).toContain("@relation(fields: [userId], references: [id])");

    // Check default(now()) for created_at
    expect(result).toContain("@default(now())");

    // Check autoincrement
    expect(result).toContain("@default(autoincrement())");

    // Check @@map for snake_case tables
    expect(result).toContain('@@map("users")');
    expect(result).toContain('@@map("posts")');
    expect(result).toContain('@@map("comments")');
  });

  it("maps MySQL database type to mysql provider", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "mysql",
      tables: [],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToPrisma(diagram);
    expect(result).toContain('provider = "mysql"');
  });

  it("maps SQLite database type to sqlite provider", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Test",
      databaseType: "sqlite",
      tables: [],
      relationships: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const result = exportDiagramToPrisma(diagram);
    expect(result).toContain('provider = "sqlite"');
  });
});
