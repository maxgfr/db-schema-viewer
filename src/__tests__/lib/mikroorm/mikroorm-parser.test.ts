import { describe, it, expect } from "vitest";
import { parseMikroORMSchema } from "@/lib/mikroorm/mikroorm-parser";

describe("parseMikroORMSchema", () => {
  it("parses a basic @Entity with @Property fields", () => {
    const content = `
      import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

      @Entity()
      export class User {
        @PrimaryKey()
        id!: number;

        @Property()
        name!: string;

        @Property()
        email!: string;
      }
    `;
    const diagram = parseMikroORMSchema(content, "Test");

    expect(diagram.name).toBe("Test");
    expect(diagram.tables).toHaveLength(1);

    const user = diagram.tables[0]!;
    expect(user.name).toBe("User");
    expect(user.fields).toHaveLength(3);

    const nameField = user.fields.find((f) => f.name === "name")!;
    expect(nameField.type).toBe("VARCHAR");
    expect(nameField.primaryKey).toBe(false);

    const emailField = user.fields.find((f) => f.name === "email")!;
    expect(emailField.type).toBe("VARCHAR");
  });

  it("detects @PrimaryKey", () => {
    const content = `
      import { Entity, PrimaryKey } from "@mikro-orm/core";

      @Entity()
      export class Token {
        @PrimaryKey({ columnType: "uuid" })
        id!: string;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    const token = diagram.tables[0]!;
    const idField = token.fields.find((f) => f.name === "id")!;
    expect(idField.primaryKey).toBe(true);
    expect(idField.unique).toBe(true);
    expect(idField.nullable).toBe(false);
    expect(idField.type).toBe("UUID");
  });

  it("detects @ManyToOne FK relationships", () => {
    const content = `
      import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";

      @Entity()
      export class User {
        @PrimaryKey()
        id!: number;

        @Property()
        name!: string;
      }

      @Entity()
      export class Post {
        @PrimaryKey()
        id!: number;

        @Property()
        title!: string;

        @ManyToOne(() => User)
        author!: User;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    expect(diagram.tables).toHaveLength(2);

    const postTable = diagram.tables.find((t) => t.name === "Post")!;
    const authorField = postTable.fields.find((f) => f.name === "author")!;
    expect(authorField).toBeDefined();
    expect(authorField.isForeignKey).toBe(true);
    expect(authorField.references).toEqual({ table: "User", field: "id" });

    expect(diagram.relationships).toHaveLength(1);
    const rel = diagram.relationships[0]!;
    expect(rel.sourceTableId).toBe(postTable.id);
    expect(rel.cardinality).toBe("one-to-many");
  });

  it("maps TypeScript types to SQL types", () => {
    const content = `
      import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

      @Entity()
      export class DataTypes {
        @PrimaryKey()
        id!: number;

        @Property()
        name!: string;

        @Property()
        count!: number;

        @Property()
        active!: boolean;

        @Property()
        createdAt!: Date;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    const table = diagram.tables[0]!;

    const idField = table.fields.find((f) => f.name === "id")!;
    expect(idField.type).toBe("INTEGER");

    const nameField = table.fields.find((f) => f.name === "name")!;
    expect(nameField.type).toBe("VARCHAR");

    const countField = table.fields.find((f) => f.name === "count")!;
    expect(countField.type).toBe("INTEGER");

    const activeField = table.fields.find((f) => f.name === "active")!;
    expect(activeField.type).toBe("BOOLEAN");

    const createdField = table.fields.find((f) => f.name === "createdAt")!;
    expect(createdField.type).toBe("TIMESTAMP");
  });

  it("handles @Entity({ tableName: '...' })", () => {
    const content = `
      import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

      @Entity({ tableName: "blog_posts" })
      export class Post {
        @PrimaryKey()
        id!: number;

        @Property()
        title!: string;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("blog_posts");
  });

  it("skips @OneToMany (no column)", () => {
    const content = `
      import { Entity, PrimaryKey, Property, OneToMany, ManyToOne, Collection } from "@mikro-orm/core";

      @Entity()
      export class User {
        @PrimaryKey()
        id!: number;

        @Property()
        name!: string;

        @OneToMany(() => Post, (post) => post.author)
        posts!: Collection<Post>;
      }

      @Entity()
      export class Post {
        @PrimaryKey()
        id!: number;

        @Property()
        title!: string;

        @ManyToOne(() => User)
        author!: User;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    expect(diagram.tables).toHaveLength(2);

    const userTable = diagram.tables.find((t) => t.name === "User")!;
    // OneToMany should NOT create a column
    expect(userTable.fields.find((f) => f.name === "posts")).toBeUndefined();
    expect(userTable.fields).toHaveLength(2); // id, name

    const postTable = diagram.tables.find((t) => t.name === "Post")!;
    expect(postTable.fields).toHaveLength(3); // id, title, author
    const authorField = postTable.fields.find((f) => f.name === "author")!;
    expect(authorField.isForeignKey).toBe(true);
  });

  it("handles multiple entities", () => {
    const content = `
      import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection } from "@mikro-orm/core";

      @Entity()
      export class Author {
        @PrimaryKey()
        id!: number;

        @Property()
        name!: string;

        @Property({ unique: true })
        email!: string;

        @OneToMany(() => Book, (book) => book.author)
        books!: Collection<Book>;
      }

      @Entity()
      export class Book {
        @PrimaryKey()
        id!: number;

        @Property()
        title!: string;

        @Property({ nullable: true })
        description!: string;

        @ManyToOne(() => Author)
        author!: Author;
      }

      @Entity()
      export class Review {
        @PrimaryKey()
        id!: number;

        @Property()
        content!: string;

        @ManyToOne(() => Book)
        book!: Book;
      }
    `;
    const diagram = parseMikroORMSchema(content, "Library");

    expect(diagram.name).toBe("Library");
    expect(diagram.tables).toHaveLength(3);

    const authorTable = diagram.tables.find((t) => t.name === "Author")!;
    const bookTable = diagram.tables.find((t) => t.name === "Book")!;
    const reviewTable = diagram.tables.find((t) => t.name === "Review")!;

    expect(authorTable).toBeDefined();
    expect(bookTable).toBeDefined();
    expect(reviewTable).toBeDefined();

    // Author should not have 'books' field (OneToMany)
    expect(authorTable.fields.find((f) => f.name === "books")).toBeUndefined();

    // email should be unique
    const emailField = authorTable.fields.find((f) => f.name === "email")!;
    expect(emailField.unique).toBe(true);

    // description should be nullable
    const descField = bookTable.fields.find((f) => f.name === "description")!;
    expect(descField.nullable).toBe(true);

    // Two relationships: Book->Author, Review->Book
    expect(diagram.relationships).toHaveLength(2);

    // Verify FK references are resolved
    const bookAuthor = bookTable.fields.find((f) => f.name === "author")!;
    expect(bookAuthor.isForeignKey).toBe(true);
    expect(bookAuthor.references?.table).toBe("Author");

    const reviewBook = reviewTable.fields.find((f) => f.name === "book")!;
    expect(reviewBook.isForeignKey).toBe(true);
    expect(reviewBook.references?.table).toBe("Book");
  });

  it("handles @OneToOne FK relationship", () => {
    const content = `
      import { Entity, PrimaryKey, Property, OneToOne } from "@mikro-orm/core";

      @Entity()
      export class User {
        @PrimaryKey()
        id!: number;

        @Property()
        name!: string;
      }

      @Entity()
      export class Profile {
        @PrimaryKey()
        id!: number;

        @Property({ nullable: true })
        bio!: string;

        @OneToOne(() => User)
        user!: User;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    expect(diagram.tables).toHaveLength(2);

    const profileTable = diagram.tables.find((t) => t.name === "Profile")!;
    const userField = profileTable.fields.find((f) => f.name === "user")!;
    expect(userField.isForeignKey).toBe(true);

    expect(diagram.relationships).toHaveLength(1);
    expect(diagram.relationships[0]!.cardinality).toBe("one-to-one");
  });

  it("handles @Property with type and columnType options", () => {
    const content = `
      import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

      @Entity()
      export class Settings {
        @PrimaryKey()
        id!: number;

        @Property({ type: "text" })
        content!: string;

        @Property({ columnType: "uuid" })
        externalId!: string;

        @Property({ type: "boolean", default: false })
        enabled!: boolean;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    const table = diagram.tables[0]!;

    const contentField = table.fields.find((f) => f.name === "content")!;
    expect(contentField.type).toBe("TEXT");

    const externalIdField = table.fields.find((f) => f.name === "externalId")!;
    expect(externalIdField.type).toBe("UUID");

    const enabledField = table.fields.find((f) => f.name === "enabled")!;
    expect(enabledField.type).toBe("BOOLEAN");
    expect(enabledField.default).toBe("false");
  });

  it("handles @Enum decorator", () => {
    const content = `
      import { Entity, PrimaryKey, Property, Enum } from "@mikro-orm/core";

      enum UserRole {
        ADMIN = "admin",
        USER = "user",
      }

      @Entity()
      export class User {
        @PrimaryKey()
        id!: number;

        @Enum(() => UserRole)
        role!: UserRole;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    const table = diagram.tables[0]!;
    const roleField = table.fields.find((f) => f.name === "role")!;
    expect(roleField).toBeDefined();
    expect(roleField.type).toBe("VARCHAR");
  });

  it("handles @Unique decorator on a field", () => {
    const content = `
      import { Entity, PrimaryKey, Property, Unique } from "@mikro-orm/core";

      @Entity()
      export class User {
        @PrimaryKey()
        id!: number;

        @Unique()
        @Property()
        email!: string;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    const table = diagram.tables[0]!;
    const emailField = table.fields.find((f) => f.name === "email")!;
    expect(emailField.unique).toBe(true);
  });

  it("skips @ManyToMany (no column)", () => {
    const content = `
      import { Entity, PrimaryKey, Property, ManyToMany, Collection } from "@mikro-orm/core";

      @Entity()
      export class Tag {
        @PrimaryKey()
        id!: number;

        @Property()
        name!: string;
      }

      @Entity()
      export class Post {
        @PrimaryKey()
        id!: number;

        @Property()
        title!: string;

        @ManyToMany(() => Tag)
        tags!: Collection<Tag>;
      }
    `;
    const diagram = parseMikroORMSchema(content);

    const postTable = diagram.tables.find((t) => t.name === "Post")!;
    // ManyToMany should NOT create a column
    expect(postTable.fields.find((f) => f.name === "tags")).toBeUndefined();
    expect(postTable.fields).toHaveLength(2); // id, title

    // No FK relationships for ManyToMany
    expect(diagram.relationships).toHaveLength(0);
  });

  it("handles empty/invalid input", () => {
    const diagram = parseMikroORMSchema("");
    expect(diagram.tables).toHaveLength(0);
    expect(diagram.relationships).toHaveLength(0);
    expect(diagram.name).toBe("MikroORM Schema");
    expect(diagram.databaseType).toBe("postgresql");
  });

  it("generates unique IDs for all entities", () => {
    const content = `
      import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";

      @Entity()
      export class A {
        @PrimaryKey()
        id!: number;
      }

      @Entity()
      export class B {
        @PrimaryKey()
        id!: number;

        @ManyToOne(() => A)
        a!: A;
      }
    `;
    const diagram = parseMikroORMSchema(content);

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
