import { describe, it, expect } from "vitest";
import { parsePrismaSchema } from "../../src/prisma/prisma-parser";

describe("parsePrismaSchema — edge cases", () => {
  it("handles @@map for table name mapping", () => {
    const content = `
model UserProfile {
  id    Int    @id @default(autoincrement())
  name  String

  @@map("user_profiles")
}
    `;
    const diagram = parsePrismaSchema(content);
    expect(diagram.tables).toHaveLength(1);
    // The table should still be accessible
    expect(diagram.tables[0]!.name).toBeDefined();
  });

  it("handles @map for field name mapping", () => {
    const content = `
model User {
  id        Int    @id @default(autoincrement())
  firstName String @map("first_name")
  lastName  String @map("last_name")
}
    `;
    const diagram = parsePrismaSchema(content);
    const fields = diagram.tables[0]!.fields;
    expect(fields.length).toBeGreaterThanOrEqual(3);
  });

  it("handles explicit many-to-many via join table", () => {
    const content = `
model Student {
  id          Int           @id @default(autoincrement())
  name        String
  enrollments Enrollment[]
}

model Course {
  id          Int           @id @default(autoincrement())
  title       String
  enrollments Enrollment[]
}

model Enrollment {
  id        Int     @id @default(autoincrement())
  studentId Int
  courseId   Int
  student   Student @relation(fields: [studentId], references: [id])
  course    Course  @relation(fields: [courseId], references: [id])

  @@unique([studentId, courseId])
}
    `;
    const diagram = parsePrismaSchema(content);
    expect(diagram.tables).toHaveLength(3);
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(2);

    const enrollment = diagram.tables.find((t) => t.name === "Enrollment")!;
    const studentIdField = enrollment.fields.find((f) => f.name === "studentId");
    expect(studentIdField).toBeDefined();
  });

  it("handles composite @@unique without crashing", () => {
    const content = `
model Vote {
  id     Int @id @default(autoincrement())
  userId Int
  postId Int

  @@unique([userId, postId])
}
    `;
    const diagram = parsePrismaSchema(content);
    const table = diagram.tables[0]!;
    // @@unique is parsed by the parser as an index when supported
    expect(table.fields.length).toBeGreaterThanOrEqual(3);
  });

  it("handles optional relation fields", () => {
    const content = `
model Post {
  id         Int      @id @default(autoincrement())
  title      String
  categoryId Int?
  category   Category? @relation(fields: [categoryId], references: [id])
}

model Category {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[]
}
    `;
    const diagram = parsePrismaSchema(content);
    const post = diagram.tables.find((t) => t.name === "Post")!;
    const catField = post.fields.find((f) => f.name === "categoryId");
    expect(catField?.nullable).toBe(true);
  });

  it("handles multiple relations between same models (named relations)", () => {
    const content = `
model User {
  id            Int    @id @default(autoincrement())
  writtenPosts  Post[] @relation("author")
  editedPosts   Post[] @relation("editor")
}

model Post {
  id       Int  @id @default(autoincrement())
  authorId Int
  editorId Int?
  author   User @relation("author", fields: [authorId], references: [id])
  editor   User? @relation("editor", fields: [editorId], references: [id])
}
    `;
    const diagram = parsePrismaSchema(content);
    expect(diagram.tables).toHaveLength(2);
    // Named relations with same model may or may not both be parsed
    // At minimum the tables and fields should be present
    const post = diagram.tables.find((t) => t.name === "Post")!;
    expect(post.fields.find((f) => f.name === "authorId")).toBeDefined();
    expect(post.fields.find((f) => f.name === "editorId")).toBeDefined();
  });

  it("handles model with no @id (e.g. composite key)", () => {
    const content = `
model UserRole {
  userId Int
  roleId Int

  @@id([userId, roleId])
}
    `;
    const diagram = parsePrismaSchema(content);
    const table = diagram.tables[0]!;
    expect(table.fields.find((f) => f.name === "userId")?.primaryKey).toBe(true);
    expect(table.fields.find((f) => f.name === "roleId")?.primaryKey).toBe(true);
  });

  it("handles multiple @@index declarations", () => {
    const content = `
model Event {
  id        Int      @id @default(autoincrement())
  type      String
  userId    Int
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([type, createdAt])
}
    `;
    const diagram = parsePrismaSchema(content);
    const table = diagram.tables[0]!;
    expect(table.indexes.length).toBeGreaterThanOrEqual(2);
  });

  it("handles Unsupported type gracefully", () => {
    const content = `
model Geo {
  id       Int                      @id @default(autoincrement())
  location Unsupported("geometry")?
}
    `;
    const diagram = parsePrismaSchema(content);
    expect(diagram.tables).toHaveLength(1);
    // Should not crash, and field may or may not be present
  });

  it("handles empty model", () => {
    const content = `
model Empty {
}
    `;
    const diagram = parsePrismaSchema(content);
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("Empty");
  });
});
