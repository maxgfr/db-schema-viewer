import { describe, it, expect } from "vitest";
import { parseKyselySchema } from "@/lib/kysely/kysely-parser";

describe("parseKyselySchema", () => {
  it("parses a basic Database interface with table interfaces", () => {
    const content = `
interface Database {
  users: UsersTable;
  posts: PostsTable;
}

interface UsersTable {
  id: Generated<number>;
  name: string;
  email: string;
}

interface PostsTable {
  id: Generated<number>;
  title: string;
  content: string;
}
    `;
    const diagram = parseKyselySchema(content, "Test");
    expect(diagram.name).toBe("Test");
    expect(diagram.tables).toHaveLength(2);

    const users = diagram.tables.find((t) => t.name === "users");
    expect(users).toBeDefined();
    expect(users!.fields).toHaveLength(3);

    const posts = diagram.tables.find((t) => t.name === "posts");
    expect(posts).toBeDefined();
    expect(posts!.fields).toHaveLength(3);
  });

  it("maps TypeScript types to SQL types", () => {
    const content = `
interface Database {
  items: ItemsTable;
}

interface ItemsTable {
  id: Generated<number>;
  name: string;
  price: number;
  active: boolean;
  created_at: Date;
  big_count: bigint;
  data: object;
  tags: string[];
}
    `;
    const diagram = parseKyselySchema(content);

    const items = diagram.tables.find((t) => t.name === "items")!;
    expect(items).toBeDefined();

    const findField = (name: string) => items.fields.find((f) => f.name === name);

    expect(findField("name")!.type).toBe("VARCHAR");
    expect(findField("price")!.type).toBe("INTEGER");
    expect(findField("active")!.type).toBe("BOOLEAN");
    expect(findField("created_at")!.type).toBe("TIMESTAMP");
    expect(findField("big_count")!.type).toBe("BIGINT");
    expect(findField("data")!.type).toBe("JSONB");
    expect(findField("tags")!.type).toBe("VARCHAR[]");
  });

  it("detects Generated<T> as primary key with default for id fields", () => {
    const content = `
interface Database {
  users: UsersTable;
}

interface UsersTable {
  id: Generated<number>;
  name: string;
  created_at: Generated<Date>;
}
    `;
    const diagram = parseKyselySchema(content);

    const users = diagram.tables.find((t) => t.name === "users")!;
    const idField = users.fields.find((f) => f.name === "id")!;

    expect(idField.primaryKey).toBe(true);
    expect(idField.unique).toBe(true);
    expect(idField.nullable).toBe(false);
    expect(idField.default).toBe("auto");
    expect(idField.type).toBe("INTEGER");

    // created_at is Generated but not named "id", so not primary key
    const createdAt = users.fields.find((f) => f.name === "created_at")!;
    expect(createdAt.primaryKey).toBe(false);
    expect(createdAt.default).toBe("auto");
    expect(createdAt.type).toBe("TIMESTAMP");
  });

  it("detects nullable fields (string | null)", () => {
    const content = `
interface Database {
  profiles: ProfilesTable;
}

interface ProfilesTable {
  id: Generated<number>;
  bio: string | null;
  avatar_url: string | null;
  nickname: string;
}
    `;
    const diagram = parseKyselySchema(content);

    const profiles = diagram.tables.find((t) => t.name === "profiles")!;

    const bio = profiles.fields.find((f) => f.name === "bio")!;
    expect(bio.nullable).toBe(true);
    expect(bio.type).toBe("VARCHAR");

    const avatarUrl = profiles.fields.find((f) => f.name === "avatar_url")!;
    expect(avatarUrl.nullable).toBe(true);

    const nickname = profiles.fields.find((f) => f.name === "nickname")!;
    expect(nickname.nullable).toBe(false);
  });

  it("detects optional fields as nullable", () => {
    const content = `
interface Database {
  settings: SettingsTable;
}

interface SettingsTable {
  id: Generated<number>;
  theme?: string;
  language: string;
}
    `;
    const diagram = parseKyselySchema(content);

    const settings = diagram.tables.find((t) => t.name === "settings")!;

    const theme = settings.fields.find((f) => f.name === "theme")!;
    expect(theme.nullable).toBe(true);

    const language = settings.fields.find((f) => f.name === "language")!;
    expect(language.nullable).toBe(false);
  });

  it("detects FK columns by naming convention (_id suffix)", () => {
    const content = `
interface Database {
  users: UsersTable;
  posts: PostsTable;
  comments: CommentsTable;
}

interface UsersTable {
  id: Generated<number>;
  name: string;
}

interface PostsTable {
  id: Generated<number>;
  title: string;
  author_id: number;
}

interface CommentsTable {
  id: Generated<number>;
  body: string;
  post_id: number;
  user_id: number;
}
    `;
    const diagram = parseKyselySchema(content);

    // posts.author_id → does not match because "author" pluralizes to "authors",
    // and there is no "authors" table (the table is "users")
    // But post_id → posts and user_id → users should match
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(2);

    const postRel = diagram.relationships.find((r) => {
      const sourceTable = diagram.tables.find((t) => t.id === r.sourceTableId);
      const targetTable = diagram.tables.find((t) => t.id === r.targetTableId);
      return sourceTable?.name === "comments" && targetTable?.name === "posts";
    });
    expect(postRel).toBeDefined();

    const userRel = diagram.relationships.find((r) => {
      const sourceTable = diagram.tables.find((t) => t.id === r.sourceTableId);
      const targetTable = diagram.tables.find((t) => t.id === r.targetTableId);
      return sourceTable?.name === "comments" && targetTable?.name === "users";
    });
    expect(userRel).toBeDefined();
  });

  it("handles multiple tables with various types", () => {
    const content = `
interface Database {
  departments: DepartmentsTable;
  employees: EmployeesTable;
  projects: ProjectsTable;
}

interface DepartmentsTable {
  id: Generated<number>;
  name: string;
}

interface EmployeesTable {
  id: Generated<number>;
  first_name: string;
  last_name: string;
  department_id: number;
  hired_at: Date;
  salary: number;
  is_active: boolean;
}

interface ProjectsTable {
  id: Generated<number>;
  title: string;
  description: string | null;
  budget: number;
}
    `;
    const diagram = parseKyselySchema(content);
    expect(diagram.tables).toHaveLength(3);

    const employees = diagram.tables.find((t) => t.name === "employees")!;
    expect(employees.fields).toHaveLength(7);

    // department_id should reference departments
    const deptRel = diagram.relationships.find((r) => {
      const sourceTable = diagram.tables.find((t) => t.id === r.sourceTableId);
      const targetTable = diagram.tables.find((t) => t.id === r.targetTableId);
      return (
        sourceTable?.name === "employees" &&
        targetTable?.name === "departments"
      );
    });
    expect(deptRel).toBeDefined();
  });

  it("handles `type Database = { ... }` syntax", () => {
    const content = `
type Database = {
  orders: OrdersTable;
  products: ProductsTable;
}

interface OrdersTable {
  id: Generated<number>;
  product_id: number;
  quantity: number;
}

interface ProductsTable {
  id: Generated<number>;
  name: string;
  price: number;
}
    `;
    const diagram = parseKyselySchema(content);
    expect(diagram.tables).toHaveLength(2);

    const orders = diagram.tables.find((t) => t.name === "orders")!;
    expect(orders).toBeDefined();
    expect(orders.fields).toHaveLength(3);

    // product_id → products
    const productRel = diagram.relationships.find((r) => {
      const sourceTable = diagram.tables.find((t) => t.id === r.sourceTableId);
      const targetTable = diagram.tables.find((t) => t.id === r.targetTableId);
      return (
        sourceTable?.name === "orders" && targetTable?.name === "products"
      );
    });
    expect(productRel).toBeDefined();
  });

  it("handles ColumnType<S, I, U>", () => {
    const content = `
interface Database {
  events: EventsTable;
}

interface EventsTable {
  id: Generated<number>;
  payload: ColumnType<string, string, string>;
  timestamp: ColumnType<Date, string | undefined, never>;
}
    `;
    const diagram = parseKyselySchema(content);

    const events = diagram.tables.find((t) => t.name === "events")!;

    const payload = events.fields.find((f) => f.name === "payload")!;
    expect(payload.type).toBe("VARCHAR");

    const timestamp = events.fields.find((f) => f.name === "timestamp")!;
    expect(timestamp.type).toBe("TIMESTAMP");
  });

  it("handles export keyword on interfaces", () => {
    const content = `
export interface Database {
  tasks: TasksTable;
}

export interface TasksTable {
  id: Generated<number>;
  title: string;
  done: boolean;
}
    `;
    const diagram = parseKyselySchema(content);
    expect(diagram.tables).toHaveLength(1);

    const tasks = diagram.tables.find((t) => t.name === "tasks")!;
    expect(tasks.fields).toHaveLength(3);
  });

  it("strips comments before parsing", () => {
    const content = `
// This is the database schema
interface Database {
  users: UsersTable; // main table
}

/* Multi-line comment
   describing the table */
interface UsersTable {
  id: Generated<number>;
  // This is the user's name
  name: string;
}
    `;
    const diagram = parseKyselySchema(content);
    expect(diagram.tables).toHaveLength(1);

    const users = diagram.tables.find((t) => t.name === "users")!;
    expect(users.fields).toHaveLength(2);
  });

  it("uses default name when none provided", () => {
    const content = `
interface Database {
  items: ItemsTable;
}

interface ItemsTable {
  id: Generated<number>;
}
    `;
    const diagram = parseKyselySchema(content);
    expect(diagram.name).toBe("Kysely Schema");
  });

  it("handles table types defined with type alias", () => {
    const content = `
interface Database {
  logs: LogEntry;
}

type LogEntry = {
  id: Generated<number>;
  message: string;
  level: string;
  created_at: Date;
}
    `;
    const diagram = parseKyselySchema(content);
    expect(diagram.tables).toHaveLength(1);

    const logs = diagram.tables.find((t) => t.name === "logs")!;
    expect(logs.fields).toHaveLength(4);
    expect(logs.fields.find((f) => f.name === "message")!.type).toBe("VARCHAR");
  });

  it("handles null | T union ordering", () => {
    const content = `
interface Database {
  items: ItemsTable;
}

interface ItemsTable {
  id: Generated<number>;
  description: null | string;
}
    `;
    const diagram = parseKyselySchema(content);

    const items = diagram.tables.find((t) => t.name === "items")!;
    const description = items.fields.find((f) => f.name === "description")!;
    expect(description.nullable).toBe(true);
    expect(description.type).toBe("VARCHAR");
  });
});
