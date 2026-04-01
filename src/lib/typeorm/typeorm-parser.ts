import type { Diagram, Cardinality } from "@/lib/domain";
import type { ParsedColumn, ParsedRelationship } from "@/lib/parsing/types";
import { buildDiagram } from "@/lib/parsing/build-diagram";
import { extractBraceBlock } from "@/lib/parsing/extract-brace-block";
import { resolveClassInheritance } from "@/lib/parsing/inline-helpers";

interface TypeORMEntity {
  className: string;
  tableName: string;
  columns: (ParsedColumn & { cardinality?: Cardinality })[];
  indexes: { name: string; columns: string[]; unique: boolean }[];
}

/**
 * Parse TypeORM entity definitions from TypeScript source into a Diagram.
 * Uses regex-based parsing since we can't run TypeScript in the browser.
 */
export function parseTypeORMSchema(content: string, name?: string): Diagram {
  const entities = extractEntities(content);

  // Build className → tableName map for resolving FK references
  const classToTable = new Map<string, string>();
  for (const entity of entities) {
    classToTable.set(entity.className, entity.tableName);
  }

  // Convert to shared types, resolving class names to table names
  const parsedTables = entities.map((entity) => ({
    name: entity.tableName,
    columns: entity.columns.map((col) => {
      const resolved = col.references
        ? {
            table: classToTable.get(col.references.table) || col.references.table,
            column: col.references.column,
          }
        : undefined;
      return {
        name: col.name,
        type: col.type,
        primaryKey: col.primaryKey,
        unique: col.unique,
        nullable: col.nullable,
        default: col.default,
        comment: col.comment,
        references: resolved,
      };
    }),
    indexes: entity.indexes,
    isView: false,
  }));

  // Build explicit relationships from FK columns (TypeORM resolves to PK)
  const relationships: ParsedRelationship[] = [];
  for (const entity of entities) {
    for (const col of entity.columns) {
      if (!col.references) continue;

      const resolvedTargetTable =
        classToTable.get(col.references.table) || col.references.table;

      // TypeORM FK → target PK. Find the target entity's PK field name.
      const targetEntity = entities.find(
        (e) =>
          e.className === col.references!.table ||
          e.tableName === resolvedTargetTable,
      );
      const targetPKName = targetEntity?.columns.find((c) => c.primaryKey)?.name;

      relationships.push({
        sourceTable: entity.tableName,
        sourceColumn: col.name,
        targetTable: resolvedTargetTable,
        targetColumn: targetPKName || col.references.column,
        cardinality: col.cardinality,
      });
    }
  }

  return buildDiagram(parsedTables, relationships, "postgresql", name ?? "TypeORM Schema");
}

// ── Entity extraction ──────────────────────────────────────────────

function extractEntities(content: string): TypeORMEntity[] {
  const entities: TypeORMEntity[] = [];

  // Extract all class bodies for inheritance resolution (AST-based when available)
  const classBodies = resolveClassInheritance(content);

  const entityRegex =
    /@Entity\s*\(\s*(?:["'`](\w+)["'`]|(\{[^}]*\}))?\s*\)\s*(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g;

  let match;
  while ((match = entityRegex.exec(content)) !== null) {
    const entityDecoTableName = match[1];
    const entityOpts = match[2];
    const className = match[3]!;
    const parentClassName = match[4];

    let tableName = className;
    if (entityDecoTableName) {
      tableName = entityDecoTableName;
    } else if (entityOpts) {
      const nameMatch = entityOpts.match(/name\s*:\s*["'`](\w+)["'`]/);
      if (nameMatch) {
        tableName = nameMatch[1]!;
      }
    }

    // Find the opening brace of the class body
    let braceStart = -1;
    for (let i = match.index + match[0].length; i < content.length; i++) {
      if (content[i] === "{") {
        braceStart = i;
        break;
      }
    }
    if (braceStart === -1) continue;

    let body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    // Merge parent class columns if this entity extends another class
    if (parentClassName) {
      const parentBody = classBodies.get(parentClassName);
      if (parentBody) {
        body = parentBody + "\n" + body;
      }
    }

    const columns = parseEntityColumns(body);
    const indexes = parseEntityIndexes(content, match.index);

    entities.push({ className, tableName, columns, indexes });
  }

  return entities;
}


// ── Column parsing ─────────────────────────────────────────────────

function parseEntityColumns(
  body: string,
): (ParsedColumn & { cardinality?: Cardinality })[] {
  const columns: (ParsedColumn & { cardinality?: Cardinality })[] = [];

  const propertyRegex =
    /((?:@\w+(?:\s*\([^)]*(?:\([^)]*\)[^)]*)*\))\s*)+)\s*(\w+)\s*(?:!|(?:\?))?\s*:\s*([^;]+);/g;

  let match;
  while ((match = propertyRegex.exec(body)) !== null) {
    const decorators = match[1]!;
    const fieldName = match[2]!;
    const tsType = match[3]!.trim();

    // Skip relation fields that don't create columns
    const isRelation = /@(?:OneToMany|ManyToMany)\s*\(/.test(decorators);
    if (isRelation) continue;

    const isManyToOne = /@ManyToOne\s*\(/.test(decorators);
    const isOneToOne = /@OneToOne\s*\(/.test(decorators);
    const hasJoinColumn = /@JoinColumn\s*\(/.test(decorators);

    if (isOneToOne && !hasJoinColumn) continue;

    const isPrimaryGenerated = /@PrimaryGeneratedColumn\s*\(/.test(decorators);
    const isPrimaryColumn = /@PrimaryColumn\s*\(/.test(decorators);
    const isPK = isPrimaryGenerated || isPrimaryColumn;

    const isCreateDate = /@CreateDateColumn\s*\(/.test(decorators);
    const isUpdateDate = /@UpdateDateColumn\s*\(/.test(decorators);
    const isDeleteDate = /@DeleteDateColumn\s*\(/.test(decorators);
    const isDateColumn = isCreateDate || isUpdateDate || isDeleteDate;

    const isColumn = /@Column\s*\(/.test(decorators);

    if (!isPK && !isColumn && !isDateColumn && !isManyToOne && !isOneToOne)
      continue;

    // Resolve column type and options
    let colType = mapTSTypeToSQL(tsType);
    let nullable = false;
    let unique = false;
    let defaultValue: string | undefined;
    let columnName = fieldName;

    if (isPrimaryGenerated) {
      const pgMatch = decorators.match(
        /@PrimaryGeneratedColumn\s*\(\s*["'`](\w+)["'`]?\s*\)/,
      );
      colType = pgMatch && pgMatch[1] === "uuid" ? "UUID" : "INTEGER";
    }

    if (isPrimaryColumn) {
      const pcMatch = decorators.match(
        /@PrimaryColumn\s*\(\s*(?:\{([^}]*)\}|["'`](\w+)["'`])?\s*\)/,
      );
      if (pcMatch) {
        if (pcMatch[2]) {
          colType = pcMatch[2].toUpperCase();
        } else if (pcMatch[1]) {
          const typeMatch = pcMatch[1].match(/type\s*:\s*["'`](\w+)["'`]/);
          if (typeMatch) colType = typeMatch[1]!.toUpperCase();
        }
      }
    }

    if (isDateColumn) {
      colType = "TIMESTAMP";
      if (isDeleteDate) nullable = true;
    }

    if (isColumn) {
      const colOptMatch = decorators.match(
        /@Column\s*\(\s*(?:\{([^}]*)\}|["'`](\w+)["'`])?\s*\)/,
      );
      if (colOptMatch) {
        if (colOptMatch[2]) {
          colType = colOptMatch[2].toUpperCase();
        } else if (colOptMatch[1]) {
          const opts = colOptMatch[1];

          const typeMatch = opts.match(/type\s*:\s*["'`](\w+)["'`]/);
          if (typeMatch) colType = typeMatch[1]!.toUpperCase();

          const lengthMatch = opts.match(/length\s*:\s*(\d+)/);
          if (lengthMatch) {
            colType =
              colType === "VARCHAR"
                ? `VARCHAR(${lengthMatch[1]})`
                : `${colType}(${lengthMatch[1]})`;
          }

          if (/nullable\s*:\s*true/.test(opts)) nullable = true;
          if (/unique\s*:\s*true/.test(opts)) unique = true;

          const defaultMatch = opts.match(
            /default\s*:\s*("[^"]*"|'[^']*'|[^,}]+)/,
          );
          if (defaultMatch) {
            let val = defaultMatch[1]!.trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            defaultValue = val;
          }

          const nameMatch = opts.match(/name\s*:\s*["'`](\w+)["'`]/);
          if (nameMatch) columnName = nameMatch[1]!;
        }
      }
    }

    // Handle ManyToOne / OneToOne FK columns
    let references: ParsedColumn["references"] | undefined;
    let cardinality: Cardinality | undefined;

    if (isManyToOne || (isOneToOne && hasJoinColumn)) {
      cardinality = isManyToOne ? "one-to-many" : "one-to-one";

      const relMatch = decorators.match(
        /@(?:ManyToOne|OneToOne)\s*\(\s*\(\)\s*=>\s*(\w+)/,
      );
      if (relMatch) {
        references = {
          table: relMatch[1]!,
          column: "id", // Convention: FK references 'id' by default
        };
      }

      const joinColMatch = decorators.match(
        /@JoinColumn\s*\(\s*\{([^}]*)\}\s*\)/,
      );
      if (joinColMatch) {
        const jcNameMatch = joinColMatch[1]!.match(
          /name\s*:\s*["'`](\w+)["'`]/,
        );
        if (jcNameMatch) {
          columnName = jcNameMatch[1]!;
        }
      }

      if (!isColumn) {
        colType = "INTEGER";
      }
    }

    columns.push({
      name: columnName,
      type: colType,
      primaryKey: isPK,
      unique: unique || isPK,
      nullable: isPK ? false : nullable,
      default: defaultValue,
      references,
      cardinality,
    });
  }

  return columns;
}

// ── Index parsing ──────────────────────────────────────────────────

function parseEntityIndexes(
  content: string,
  entityStart: number,
): { name: string; columns: string[]; unique: boolean }[] {
  const indexes: { name: string; columns: string[]; unique: boolean }[] = [];

  const before = content.substring(
    Math.max(0, entityStart - 500),
    entityStart,
  );

  const indexRegex =
    /@Index\s*\(\s*(?:["'`](\w+)["'`]\s*,\s*)?\[([^\]]*)\](?:\s*,\s*\{([^}]*)\})?\s*\)/g;
  let idxMatch;
  while ((idxMatch = indexRegex.exec(before)) !== null) {
    const idxName = idxMatch[1] || `idx_${indexes.length}`;
    const cols = idxMatch[2]!
      .split(",")
      .map((s) => s.trim().replace(/["'`]/g, ""))
      .filter(Boolean);
    const opts = idxMatch[3] || "";
    const isUnique = /unique\s*:\s*true/.test(opts);

    indexes.push({ name: idxName, columns: cols, unique: isUnique });
  }

  return indexes;
}

// ── Type mapping ──────────────────────────────────────────────────

function mapTSTypeToSQL(tsType: string): string {
  const cleanType = tsType.replace(/\[\]$/, "").replace(/<.*>/, "").trim();

  const map: Record<string, string> = {
    string: "VARCHAR",
    number: "INTEGER",
    boolean: "BOOLEAN",
    Date: "TIMESTAMP",
    bigint: "BIGINT",
    Buffer: "BYTEA",
  };

  return map[cleanType] || "VARCHAR";
}
