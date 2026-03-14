import { z } from "zod";

export const DatabaseType = z.enum([
  "postgresql",
  "mysql",
  "mariadb",
  "sqlite",
  "supabase",
  "cockroachdb",
  "clickhouse",
  "bigquery",
  "snowflake",
  "generic",
]);
export type DatabaseType = z.infer<typeof DatabaseType>;

export const DATABASE_TYPE_LABELS: Record<DatabaseType, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mariadb: "MariaDB",
  sqlite: "SQLite",
  supabase: "Supabase",
  cockroachdb: "CockroachDB",
  clickhouse: "ClickHouse",
  bigquery: "BigQuery",
  snowflake: "Snowflake",
  generic: "Generic SQL",
};

export const Cardinality = z.enum([
  "one-to-one",
  "one-to-many",
  "many-to-many",
]);
export type Cardinality = z.infer<typeof Cardinality>;

export const DBField = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  primaryKey: z.boolean().default(false),
  unique: z.boolean().default(false),
  nullable: z.boolean().default(true),
  default: z.string().optional(),
  comment: z.string().optional(),
  isForeignKey: z.boolean().default(false),
  references: z
    .object({
      table: z.string(),
      field: z.string(),
    })
    .optional(),
});
export type DBField = z.infer<typeof DBField>;

export const DBIndex = z.object({
  id: z.string(),
  name: z.string(),
  columns: z.array(z.string()),
  unique: z.boolean().default(false),
});
export type DBIndex = z.infer<typeof DBIndex>;

export const DBTable = z.object({
  id: z.string(),
  name: z.string(),
  schema: z.string().optional(),
  fields: z.array(DBField),
  indexes: z.array(DBIndex).default([]),
  x: z.number().default(0),
  y: z.number().default(0),
  color: z.string().optional(),
  isView: z.boolean().default(false),
  comment: z.string().optional(),
});
export type DBTable = z.infer<typeof DBTable>;

export const DBRelationship = z.object({
  id: z.string(),
  sourceTableId: z.string(),
  sourceFieldId: z.string(),
  targetTableId: z.string(),
  targetFieldId: z.string(),
  cardinality: Cardinality,
});
export type DBRelationship = z.infer<typeof DBRelationship>;

export const Diagram = z.object({
  id: z.string(),
  name: z.string(),
  databaseType: DatabaseType,
  tables: z.array(DBTable),
  relationships: z.array(DBRelationship),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  /** Original schema source code (SQL, Drizzle, Prisma, etc.) — preserved for "View Source". */
  sourceContent: z.string().optional(),
});
export type Diagram = z.infer<typeof Diagram>;
