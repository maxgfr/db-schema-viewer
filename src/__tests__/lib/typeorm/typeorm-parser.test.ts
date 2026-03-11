import { describe, it, expect } from "vitest";
import { parseTypeORMSchema } from "@/lib/typeorm/typeorm-parser";

describe("parseTypeORMSchema", () => {
  it("parses a single entity", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

      @Entity()
      export class User {
        @PrimaryGeneratedColumn()
        id: number;

        @Column()
        name: string;

        @Column()
        email: string;
      }
    `;
    const diagram = parseTypeORMSchema(content, "Test");

    expect(diagram.name).toBe("Test");
    expect(diagram.tables).toHaveLength(1);

    const user = diagram.tables[0]!;
    expect(user.name).toBe("User");
    expect(user.fields).toHaveLength(3);

    const idField = user.fields.find((f) => f.name === "id")!;
    expect(idField.primaryKey).toBe(true);
    expect(idField.type).toBe("INTEGER");
  });

  it("parses entity with custom table name", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

      @Entity("blog_posts")
      export class Post {
        @PrimaryGeneratedColumn()
        id: number;

        @Column()
        title: string;
      }
    `;
    const diagram = parseTypeORMSchema(content);

    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("blog_posts");
  });

  it("parses PrimaryGeneratedColumn with uuid", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn } from "typeorm";

      @Entity()
      export class Token {
        @PrimaryGeneratedColumn("uuid")
        id: string;
      }
    `;
    const diagram = parseTypeORMSchema(content);

    const token = diagram.tables[0]!;
    const idField = token.fields.find((f) => f.name === "id")!;
    expect(idField.primaryKey).toBe(true);
    expect(idField.type).toBe("UUID");
  });

  it("parses Column with all options", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

      @Entity()
      export class Product {
        @PrimaryGeneratedColumn()
        id: number;

        @Column({ type: "varchar", length: 255, unique: true })
        name: string;

        @Column({ type: "text", nullable: true })
        description: string;

        @Column({ type: "decimal", default: 0 })
        price: number;

        @Column({ name: "sku_code" })
        sku: string;
      }
    `;
    const diagram = parseTypeORMSchema(content);

    const product = diagram.tables[0]!;
    expect(product.fields).toHaveLength(5);

    const nameField = product.fields.find((f) => f.name === "name")!;
    expect(nameField.type).toBe("VARCHAR(255)");
    expect(nameField.unique).toBe(true);

    const descField = product.fields.find((f) => f.name === "description")!;
    expect(descField.nullable).toBe(true);
    expect(descField.type).toBe("TEXT");

    const priceField = product.fields.find((f) => f.name === "price")!;
    expect(priceField.default).toBe("0");

    const skuField = product.fields.find((f) => f.name === "sku_code")!;
    expect(skuField).toBeDefined();
  });

  it("parses ManyToOne with JoinColumn", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";

      @Entity()
      export class User {
        @PrimaryGeneratedColumn()
        id: number;

        @Column()
        name: string;
      }

      @Entity()
      export class Post {
        @PrimaryGeneratedColumn()
        id: number;

        @Column()
        title: string;

        @ManyToOne(() => User, (user) => user.posts)
        @JoinColumn({ name: "author_id" })
        author: User;
      }
    `;
    const diagram = parseTypeORMSchema(content);

    expect(diagram.tables).toHaveLength(2);

    const postTable = diagram.tables.find((t) => t.name === "Post")!;
    const authorField = postTable.fields.find((f) => f.name === "author_id")!;
    expect(authorField).toBeDefined();
    expect(authorField.isForeignKey).toBe(true);
    expect(authorField.references).toEqual({ table: "User", field: "id" });

    expect(diagram.relationships).toHaveLength(1);
    const rel = diagram.relationships[0]!;
    expect(rel.sourceTableId).toBe(postTable.id);
    expect(rel.cardinality).toBe("one-to-many");
  });

  it("parses OneToOne relationship", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from "typeorm";

      @Entity()
      export class User {
        @PrimaryGeneratedColumn()
        id: number;

        @Column()
        name: string;
      }

      @Entity()
      export class Profile {
        @PrimaryGeneratedColumn()
        id: number;

        @Column({ nullable: true })
        bio: string;

        @OneToOne(() => User)
        @JoinColumn()
        user: User;
      }
    `;
    const diagram = parseTypeORMSchema(content);

    expect(diagram.tables).toHaveLength(2);

    const profileTable = diagram.tables.find((t) => t.name === "Profile")!;
    const userField = profileTable.fields.find((f) => f.isForeignKey)!;
    expect(userField).toBeDefined();

    expect(diagram.relationships).toHaveLength(1);
    expect(diagram.relationships[0]!.cardinality).toBe("one-to-one");
  });

  it("parses multiple entities with relationships", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";

      @Entity()
      export class User {
        @PrimaryGeneratedColumn()
        id: number;

        @Column({ type: "varchar", length: 255, unique: true })
        email: string;

        @Column({ nullable: true })
        bio: string;

        @OneToMany(() => Post, (post) => post.author)
        posts: Post[];
      }

      @Entity("blog_posts")
      export class Post {
        @PrimaryGeneratedColumn("uuid")
        id: string;

        @Column()
        title: string;

        @ManyToOne(() => User, (user) => user.posts)
        @JoinColumn({ name: "author_id" })
        author: User;

        @Column({ type: "text", nullable: true })
        content: string;
      }
    `;
    const diagram = parseTypeORMSchema(content, "Blog");

    expect(diagram.name).toBe("Blog");
    expect(diagram.tables).toHaveLength(2);

    const userTable = diagram.tables.find((t) => t.name === "User")!;
    const postTable = diagram.tables.find((t) => t.name === "blog_posts")!;

    expect(userTable).toBeDefined();
    expect(postTable).toBeDefined();

    // User should not have the 'posts' relation field as a column (OneToMany is skipped)
    expect(userTable.fields.find((f) => f.name === "posts")).toBeUndefined();

    // Post should have author_id FK
    const authorField = postTable.fields.find((f) => f.name === "author_id")!;
    expect(authorField.isForeignKey).toBe(true);

    expect(diagram.relationships).toHaveLength(1);
    const rel = diagram.relationships[0]!;
    expect(rel.sourceTableId).toBe(postTable.id);
    expect(rel.targetTableId).toBe(userTable.id);
  });

  it("handles empty/invalid input", () => {
    const diagram = parseTypeORMSchema("");
    expect(diagram.tables).toHaveLength(0);
    expect(diagram.relationships).toHaveLength(0);
    expect(diagram.name).toBe("TypeORM Schema");
    expect(diagram.databaseType).toBe("postgresql");
  });

  it("handles non-TypeORM TypeScript gracefully", () => {
    const content = `
      export class Foo {
        bar: string;
        baz(): void {
          console.log("hello");
        }
      }
    `;
    const diagram = parseTypeORMSchema(content);
    expect(diagram.tables).toHaveLength(0);
    expect(diagram.relationships).toHaveLength(0);
  });

  it("parses CreateDateColumn and UpdateDateColumn", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

      @Entity()
      export class Article {
        @PrimaryGeneratedColumn()
        id: number;

        @Column()
        title: string;

        @CreateDateColumn()
        createdAt: Date;

        @UpdateDateColumn()
        updatedAt: Date;
      }
    `;
    const diagram = parseTypeORMSchema(content);

    const article = diagram.tables[0]!;
    expect(article.fields).toHaveLength(4);

    const createdAt = article.fields.find((f) => f.name === "createdAt")!;
    expect(createdAt.type).toBe("TIMESTAMP");

    const updatedAt = article.fields.find((f) => f.name === "updatedAt")!;
    expect(updatedAt.type).toBe("TIMESTAMP");
  });

  it("generates unique IDs for all entities", () => {
    const content = `
      import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";

      @Entity()
      export class A {
        @PrimaryGeneratedColumn()
        id: number;
      }

      @Entity()
      export class B {
        @PrimaryGeneratedColumn()
        id: number;

        @ManyToOne(() => A)
        @JoinColumn({ name: "a_id" })
        a: A;
      }
    `;
    const diagram = parseTypeORMSchema(content);

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
