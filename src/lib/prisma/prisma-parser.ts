import type { Diagram, DatabaseType } from "@/lib/domain";
import { generateId, getTableColor } from "@/lib/utils";

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
  return buildPrismaDiagram(models, databaseType, name);
}

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

function extractEnums(content: string): PrismaEnum[] {
  const enums: PrismaEnum[] = [];
  const enumRegex = /enum\s+(\w+)\s*\{([^}]*)\}/g;

  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    const values = body
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, "").trim())
      .filter((l) => l.length > 0 && !l.startsWith("//"));
    enums.push({ name, values });
  }

  return enums;
}

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

function extractBraceBlock(content: string, startIdx: number): string | null {
  let depth = 0;
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) return content.substring(startIdx + 1, i);
    }
  }
  return null;
}

function parseModelBody(
  modelName: string,
  body: string,
  enumNames: Set<string>
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
      /@@unique\s*\(\s*\[([^\]]+)\]\s*\)/
    );
    if (compositeUniqueMatch) {
      compositeUniques.push(
        compositeUniqueMatch[1]!.split(",").map((s) => s.trim())
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

    // Skip model-level attributes we don't handle
    if (line.startsWith("@@")) continue;

    // Parse field: name Type? @attributes
    const fieldMatch = line.match(
      /^(\w+)\s+(\w+)(\[\])?\s*(\?)?\s*(.*)?$/
    );
    if (!fieldMatch) continue;

    const fieldName = fieldMatch[1]!;
    const fieldType = fieldMatch[2]!;
    const isList = !!fieldMatch[3];
    const isOptional = !!fieldMatch[4];
    const attrs = fieldMatch[5] || "";

    // Skip pure relation fields (type is another model and no @relation with fields)
    const isRelationField = !isScalarType(fieldType) && !enumNames.has(fieldType);
    if (isRelationField && isList) continue; // Many-side of relation, no FK here

    const isPK = /@id\b/.test(attrs);
    const isUnique = /@unique\b/.test(attrs);
    const isUpdatedAt = /@updatedAt\b/.test(attrs);

    // Extract @default
    const defaultMatch = attrs.match(/@default\s*\(([^)]+)\)/);
    const defaultValue = defaultMatch ? defaultMatch[1]!.trim() : undefined;

    // Extract @relation
    let relation: PrismaField["relation"] | undefined;
    const relationMatch = attrs.match(
      /@relation\s*\(\s*(?:name:\s*["']\w+["'],?\s*)?(?:fields:\s*\[([^\]]+)\])?\s*,?\s*(?:references:\s*\[([^\]]+)\])?\s*(?:,\s*onDelete:\s*\w+)?\s*(?:,\s*onUpdate:\s*\w+)?\s*\)/
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

  return { name: modelName, dbName, fields, compositeId, compositeUniques, indexes };
}

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

function buildPrismaDiagram(
  models: PrismaModel[],
  databaseType: DatabaseType,
  name?: string
): Diagram {
  // First pass: extract relations from model bodies by re-reading model fields that are relation types
  // We need the original content... but we already parsed models. Let's use a different approach:
  // Build the diagram from models, then use a second function to resolve relations.

  const tables = models.map((model, index) => ({
    id: generateId(),
    name: model.dbName || model.name,
    schema: undefined,
    fields: model.fields.map((field) => ({
      id: generateId(),
      name: field.map || field.name,
      type: field.type,
      primaryKey: field.isPrimaryKey,
      unique: field.isUnique,
      nullable: field.isOptional,
      default: field.default,
      isForeignKey: false,
      references: undefined as { table: string; field: string } | undefined,
    })),
    indexes: (model.indexes || []).map((cols) => ({
      id: generateId(),
      name: `idx_${model.name.toLowerCase()}_${cols.join("_")}`,
      columns: cols,
      unique: false,
    })),
    x: 0,
    y: 0,
    color: getTableColor(index),
    isView: false,
  }));

  // Now resolve relations. We need to go back to the Prisma content...
  // Actually, we need to extract relations differently.
  // Let's re-parse the relations from model bodies in a separate pass.
  const relationships = resolveRelations(models, tables);

  return {
    id: generateId(),
    name: name ?? "Prisma Schema",
    databaseType,
    tables,
    relationships,
    createdAt: new Date().toISOString(),
  };
}

interface DiagramTable {
  id: string;
  name: string;
  fields: {
    id: string;
    name: string;
    type: string;
    primaryKey: boolean;
    unique: boolean;
    nullable: boolean;
    default?: string;
    isForeignKey: boolean;
    references: { table: string; field: string } | undefined;
  }[];
  indexes: { id: string; name: string; columns: string[]; unique: boolean }[];
}

function resolveRelations(
  models: PrismaModel[],
  tables: DiagramTable[]
) {
  const tableByModelName = new Map(
    models.map((m, i) => [m.name, tables[i]!])
  );

  const relationships: {
    id: string;
    sourceTableId: string;
    sourceFieldId: string;
    targetTableId: string;
    targetFieldId: string;
    cardinality: "one-to-one" | "one-to-many" | "many-to-many";
  }[] = [];

  for (const model of models) {
    const sourceTable = tableByModelName.get(model.name);
    if (!sourceTable) continue;

    for (const field of model.fields) {
      // Convention: field ending with Id (e.g., authorId) references Author model
      const idMatch = field.name.match(/^(.+?)Id$/i);
      if (!idMatch) continue;

      // Try to find the target model
      const refName = idMatch[1]!;
      const targetModelName = models.find(
        (m) =>
          m.name.toLowerCase() === refName.toLowerCase() ||
          m.name.toLowerCase() === refName.toLowerCase() + "s"
      )?.name;

      if (!targetModelName) continue;

      const targetTable = tableByModelName.get(targetModelName);
      if (!targetTable) continue;

      // Find the FK field in source table
      const sourceField = sourceTable.fields.find(
        (f) => f.name === (field.map || field.name)
      );
      if (!sourceField) continue;

      // Find the PK field in target table (usually "id")
      const targetField = targetTable.fields.find((f) => f.primaryKey);
      if (!targetField) continue;

      // Mark as FK
      sourceField.isForeignKey = true;
      sourceField.references = {
        table: targetTable.name,
        field: targetField.name,
      };

      relationships.push({
        id: generateId(),
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetFieldId: targetField.id,
        cardinality: field.isUnique ? "one-to-one" : "one-to-many",
      });
    }
  }

  return relationships;
}

/**
 * Re-parse Prisma content to resolve @relation directives explicitly.
 * This is more accurate than convention-based matching.
 */
export function parsePrismaRelations(
  content: string,
): { source: string; sourceField: string; target: string; targetField: string }[] {
  const relations: {
    source: string;
    sourceField: string;
    target: string;
    targetField: string;
  }[] = [];

  const modelRegex = /model\s+(\w+)\s*\{/g;
  let match;

  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1]!;
    const startIdx = content.indexOf("{", match.index);
    const body = extractBraceBlock(content, startIdx);
    if (!body) continue;

    // Find relation fields: fieldName ModelType @relation(fields: [...], references: [...])
    const relFieldRegex =
      /(\w+)\s+(\w+)\??\s+@relation\s*\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\][^)]*\)/g;

    let relMatch;
    while ((relMatch = relFieldRegex.exec(body)) !== null) {
      const targetModelName = relMatch[2]!;
      const sourceFields = relMatch[3]!.split(",").map((s) => s.trim());
      const targetFields = relMatch[4]!.split(",").map((s) => s.trim());

      for (let i = 0; i < sourceFields.length; i++) {
        relations.push({
          source: modelName,
          sourceField: sourceFields[i]!,
          target: targetModelName,
          targetField: targetFields[i] || "id",
        });
      }
    }
  }

  return relations;
}
