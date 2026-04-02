import type { Diagram, DatabaseType } from "../domain";
import type { ParsedColumn, ParsedRelationship, ParsedIndex } from "../parsing/types";
import { buildDiagram } from "../parsing/build-diagram";
import { extractBraceBlock } from "../parsing/extract-brace-block";

interface PrismaField {
  name: string;
  type: string;
  isOptional: boolean;
  isList: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isUpdatedAt: boolean;
  default?: string;
  relation?: {
    fields: string[];
    references: string[];
  };
  map?: string;
}

interface PrismaModel {
  name: string;
  dbName?: string;
  fields: PrismaField[];
  compositeId?: string[];
  compositeUniques?: string[][];
  indexes?: string[][];
}

interface PrismaEnum {
  name: string;
  values: string[];
}

/**
 * Parse a Prisma schema (.prisma) file into a Diagram.
 * Beta feature — uses regex-based parsing.
 */
export function parsePrismaSchema(content: string, name?: string): Diagram {
  const databaseType = detectPrismaProvider(content);
  const enums = extractEnums(content);
  const models = extractModels(content, enums);

  const parsedTables = models.map((model) => ({
    name: model.dbName || model.name,
    columns: modelFieldsToColumns(model),
    indexes: modelIndexes(model),
    isView: false,
  }));

  const relationships = resolveRelationships(models);

  return buildDiagram(parsedTables, relationships, databaseType, name ?? "Prisma Schema");
}

// ── Provider detection ─────────────────────────────────────────────

function detectPrismaProvider(content: string): DatabaseType {
  const dsMatch = /datasource\s+\w+\s*\{([^}]*)\}/s.exec(content);
  if (!dsMatch) return "postgresql";

  const providerMatch = /provider\s*=\s*["'](\w+)["']/.exec(dsMatch[1]!);
  if (!providerMatch) return "postgresql";

  switch (providerMatch[1]!.toLowerCase()) {
    case "postgresql":
    case "postgres":
      return "postgresql";
    case "mysql":
      return "mysql";
    case "sqlite":
      return "sqlite";
    case "cockroachdb":
      return "cockroachdb";
    default:
      return "postgresql";
  }
}

// ── Enum extraction ────────────────────────────────────────────────

function extractEnums(content: string): PrismaEnum[] {
  const enums: PrismaEnum[] = [];
  const enumRegex = /enum\s+(\w+)\s*\{([^}]*)\}/g;

  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const enumName = match[1]!;
    const body = match[2]!;
    const values = body
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, "").trim())
      .filter((l) => l.length > 0 && !l.startsWith("//"));
    enums.push({ name: enumName, values });
  }

  return enums;
}

// ── Model extraction ───────────────────────────────────────────────

function extractModels(content: string, enums: PrismaEnum[]): PrismaModel[] {
  const models: PrismaModel[] = [];
  const modelRegex = /model\s+(\w+)\s*\{/g;
  const enumNames = new Set(enums.map((e) => e.name));

  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1]!;
    const startIdx = content.indexOf("{", match.index);
    const body = extractBraceBlock(content, startIdx);
    if (!body) continue;

    const model = parseModelBody(modelName, body, enumNames);
    models.push(model);
  }

  return models;
}

function parseModelBody(
  modelName: string,
  body: string,
  enumNames: Set<string>,
): PrismaModel {
  const fields: PrismaField[] = [];
  let compositeId: string[] | undefined;
  const compositeUniques: string[][] = [];
  const indexes: string[][] = [];
  let dbName: string | undefined;

  const lines = body.split("\n").map((l) => l.replace(/\/\/.*$/, "").trim());

  for (const line of lines) {
    if (!line || line.startsWith("//")) continue;

    // @@id([field1, field2])
    const compositeIdMatch = line.match(/@@id\s*\(\s*\[([^\]]+)\]\s*\)/);
    if (compositeIdMatch) {
      compositeId = compositeIdMatch[1]!.split(",").map((s) => s.trim());
      continue;
    }

    // @@unique([field1, field2])
    const compositeUniqueMatch = line.match(
      /@@unique\s*\(\s*\[([^\]]+)\]\s*\)/,
    );
    if (compositeUniqueMatch) {
      compositeUniques.push(
        compositeUniqueMatch[1]!.split(",").map((s) => s.trim()),
      );
      continue;
    }

    // @@index([field1, field2])
    const indexMatch = line.match(/@@index\s*\(\s*\[([^\]]+)\]\s*\)/);
    if (indexMatch) {
      indexes.push(indexMatch[1]!.split(",").map((s) => s.trim()));
      continue;
    }

    // @@map("table_name")
    const mapMatch = line.match(/@@map\s*\(\s*["'](\w+)["']\s*\)/);
    if (mapMatch) {
      dbName = mapMatch[1];
      continue;
    }

    // Skip other model-level attributes
    if (line.startsWith("@@")) continue;

    // Parse field: name Type? @attributes
    const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?\s*(\?)?\s*(.*)?$/);
    if (!fieldMatch) continue;

    const fieldName = fieldMatch[1]!;
    const fieldType = fieldMatch[2]!;
    const isList = !!fieldMatch[3];
    const isOptional = !!fieldMatch[4];
    const attrs = fieldMatch[5] || "";

    // Skip pure relation fields (type is another model and no @relation with fields)
    const isRelationField =
      !isScalarType(fieldType) && !enumNames.has(fieldType);
    if (isRelationField && isList) continue;

    const isPK = /@id\b/.test(attrs);
    const isUnique = /@unique\b/.test(attrs);
    const isUpdatedAt = /@updatedAt\b/.test(attrs);

    const defaultMatch = attrs.match(/@default\s*\(([^)]+)\)/);
    const defaultValue = defaultMatch ? defaultMatch[1]!.trim() : undefined;

    // Extract @relation
    let relation: PrismaField["relation"] | undefined;
    const relationMatch = attrs.match(
      /@relation\s*\(\s*(?:name:\s*["']\w+["'],?\s*)?(?:fields:\s*\[([^\]]+)\])?\s*,?\s*(?:references:\s*\[([^\]]+)\])?\s*(?:,\s*onDelete:\s*\w+)?\s*(?:,\s*onUpdate:\s*\w+)?\s*\)/,
    );
    if (relationMatch && relationMatch[1] && relationMatch[2]) {
      relation = {
        fields: relationMatch[1].split(",").map((s) => s.trim()),
        references: relationMatch[2].split(",").map((s) => s.trim()),
      };
    }

    // Extract @map
    const fieldMapMatch = attrs.match(/@map\s*\(\s*["'](\w+)["']\s*\)/);

    // If it's a relation field with @relation(fields: [...], references: [...])
    // we skip it as a visible field — the FK field itself will be defined separately
    if (isRelationField && relation) continue;

    fields.push({
      name: fieldName,
      type: mapPrismaType(fieldType, enumNames),
      isOptional,
      isList,
      isPrimaryKey: isPK,
      isUnique,
      isUpdatedAt,
      default: defaultValue,
      map: fieldMapMatch?.[1],
    });
  }

  // Mark composite PK fields
  if (compositeId) {
    for (const fieldName of compositeId) {
      const field = fields.find((f) => f.name === fieldName);
      if (field) field.isPrimaryKey = true;
    }
  }

  return {
    name: modelName,
    dbName,
    fields,
    compositeId,
    compositeUniques,
    indexes,
  };
}

// ── Convert Prisma model fields to shared ParsedColumn[] ──────────

function modelFieldsToColumns(model: PrismaModel): ParsedColumn[] {
  return model.fields.map((field) => ({
    name: field.map || field.name,
    type: field.type,
    primaryKey: field.isPrimaryKey,
    unique: field.isUnique,
    nullable: field.isOptional,
    default: field.default,
  }));
}

function modelIndexes(model: PrismaModel): ParsedIndex[] {
  return (model.indexes || []).map((cols) => ({
    name: `idx_${model.name.toLowerCase()}_${cols.join("_")}`,
    columns: cols,
    unique: false,
  }));
}

// ── Relationship resolution ────────────────────────────────────────

function resolveRelationships(models: PrismaModel[]): ParsedRelationship[] {
  const relationships: ParsedRelationship[] = [];
  for (const model of models) {
    const sourceTableName = model.dbName || model.name;

    for (const field of model.fields) {
      // Convention: field ending with Id (e.g., authorId) references Author model
      const idMatch = field.name.match(/^(.+?)Id$/i);
      if (!idMatch) continue;

      const refName = idMatch[1]!;
      const targetModel = models.find(
        (m) =>
          m.name.toLowerCase() === refName.toLowerCase() ||
          m.name.toLowerCase() === refName.toLowerCase() + "s",
      );

      if (!targetModel) continue;

      const targetTableName = targetModel.dbName || targetModel.name;

      // Find PK field in target model
      const targetPK = targetModel.fields.find((f) => f.isPrimaryKey);
      if (!targetPK) continue;

      const sourceColumnName = field.map || field.name;
      const targetColumnName = targetPK.map || targetPK.name;

      relationships.push({
        sourceTable: sourceTableName,
        sourceColumn: sourceColumnName,
        targetTable: targetTableName,
        targetColumn: targetColumnName,
        cardinality: field.isUnique ? "one-to-one" : "one-to-many",
      });
    }
  }

  return relationships;
}

// ── Helpers ────────────────────────────────────────────────────────

function isScalarType(type: string): boolean {
  const scalars = new Set([
    "String",
    "Int",
    "BigInt",
    "Float",
    "Decimal",
    "Boolean",
    "DateTime",
    "Json",
    "Bytes",
  ]);
  return scalars.has(type);
}

function mapPrismaType(type: string, enumNames: Set<string>): string {
  if (enumNames.has(type)) return `ENUM(${type})`;

  const map: Record<string, string> = {
    String: "VARCHAR",
    Int: "INTEGER",
    BigInt: "BIGINT",
    Float: "FLOAT",
    Decimal: "DECIMAL",
    Boolean: "BOOLEAN",
    DateTime: "TIMESTAMP",
    Json: "JSON",
    Bytes: "BYTEA",
  };
  return map[type] || type;
}

