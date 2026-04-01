import type { Diagram, Cardinality } from "@/lib/domain";
import type { ParsedColumn, ParsedRelationship } from "@/lib/parsing/types";
import { buildDiagram } from "@/lib/parsing/build-diagram";
import { extractBraceBlock } from "@/lib/parsing/extract-brace-block";
import { resolveClassInheritance } from "@/lib/parsing/inline-helpers";

interface MikroORMEntity {
  className: string;
  tableName: string;
  columns: (ParsedColumn & { cardinality?: Cardinality })[];
  indexes: { name: string; columns: string[]; unique: boolean }[];
}

/**
 * Parse MikroORM entity definitions from TypeScript source into a Diagram.
 * Uses regex-based parsing since we can't run TypeScript in the browser.
 */
export function parseMikroORMSchema(content: string, name?: string): Diagram {
  const entities = extractEntities(content);

  // Build className -> tableName map for resolving FK references
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
            table:
              classToTable.get(col.references.table) || col.references.table,
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

  // Build explicit relationships from FK columns
  const relationships: ParsedRelationship[] = [];
  for (const entity of entities) {
    for (const col of entity.columns) {
      if (!col.references) continue;

      const resolvedTargetTable =
        classToTable.get(col.references.table) || col.references.table;

      // Find the target entity's PK field name
      const targetEntity = entities.find(
        (e) =>
          e.className === col.references!.table ||
          e.tableName === resolvedTargetTable,
      );
      const targetPKName =
        targetEntity?.columns.find((c) => c.primaryKey)?.name;

      relationships.push({
        sourceTable: entity.tableName,
        sourceColumn: col.name,
        targetTable: resolvedTargetTable,
        targetColumn: targetPKName || col.references.column,
        cardinality: col.cardinality,
      });
    }
  }

  return buildDiagram(
    parsedTables,
    relationships,
    "postgresql",
    name ?? "MikroORM Schema",
  );
}

// -- Entity extraction --------------------------------------------------------

function extractEntities(content: string): MikroORMEntity[] {
  const entities: MikroORMEntity[] = [];

  // Extract all class bodies for inheritance resolution (AST-based when available)
  const classBodies = resolveClassInheritance(content);

  // Match @Entity() or @Entity({ tableName: '...' }) followed by class Name
  const entityRegex =
    /@Entity\s*\(\s*(\{[^}]*\})?\s*\)\s*(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g;

  let match;
  while ((match = entityRegex.exec(content)) !== null) {
    const entityOpts = match[1];
    const className = match[2]!;
    const parentClassName = match[3];

    let tableName = className;
    if (entityOpts) {
      const tableNameMatch = entityOpts.match(
        /tableName\s*:\s*["'`](\w+)["'`]/,
      );
      if (tableNameMatch) {
        tableName = tableNameMatch[1]!;
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
    const indexes = parseEntityIndexes(body);

    entities.push({ className, tableName, columns, indexes });
  }

  return entities;
}


// -- Column parsing -----------------------------------------------------------

function parseEntityColumns(
  body: string,
): (ParsedColumn & { cardinality?: Cardinality })[] {
  const columns: (ParsedColumn & { cardinality?: Cardinality })[] = [];

  // Match one or more decorators followed by a field declaration
  // Decorator: @Word(...) possibly with nested parens
  const propertyRegex =
    /((?:@\w+(?:\s*\([^)]*(?:\([^)]*\)[^)]*)*\))\s*)+)\s*(\w+)\s*(?:[!?])?\s*:\s*([^;]+);/g;

  let match;
  while ((match = propertyRegex.exec(body)) !== null) {
    const decorators = match[1]!;
    const fieldName = match[2]!;
    const tsType = match[3]!.trim();

    // Skip relation fields that don't create columns
    const isOneToMany = /@OneToMany\s*\(/.test(decorators);
    const isManyToMany = /@ManyToMany\s*\(/.test(decorators);
    if (isOneToMany || isManyToMany) continue;

    const isPrimaryKey = /@PrimaryKey\s*\(/.test(decorators);
    const isProperty = /@Property\s*\(/.test(decorators);
    const isManyToOne = /@ManyToOne\s*\(/.test(decorators);
    const isOneToOne = /@OneToOne\s*\(/.test(decorators);
    const isEnum = /@Enum\s*\(/.test(decorators);
    const isUnique = /@Unique\s*\(/.test(decorators);

    // Only process recognized MikroORM decorators
    if (!isPrimaryKey && !isProperty && !isManyToOne && !isOneToOne && !isEnum)
      continue;

    // Resolve column type
    let colType = mapTSTypeToSQL(tsType);
    let nullable = false;
    let unique = isUnique;
    let defaultValue: string | undefined;
    let columnName = fieldName;

    // Handle @Property() options
    if (isProperty) {
      const propOptMatch = decorators.match(
        /@Property\s*\(\s*(?:\{([^}]*)\})?\s*\)/,
      );
      if (propOptMatch?.[1]) {
        const opts = propOptMatch[1];

        // type option: @Property({ type: 'string' })
        const typeMatch = opts.match(/type\s*:\s*["'`](\w+)["'`]/);
        if (typeMatch) {
          colType = mapMikroORMTypeToSQL(typeMatch[1]!);
        }

        // columnType option: @Property({ columnType: 'uuid' })
        const colTypeMatch = opts.match(/columnType\s*:\s*["'`](\w+)["'`]/);
        if (colTypeMatch) {
          colType = colTypeMatch[1]!.toUpperCase();
        }

        // nullable
        if (/nullable\s*:\s*true/.test(opts)) nullable = true;

        // unique
        if (/unique\s*:\s*true/.test(opts)) unique = true;

        // default
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

        // fieldName / name override
        const nameMatch = opts.match(/(?:fieldName|name)\s*:\s*["'`](\w+)["'`]/);
        if (nameMatch) columnName = nameMatch[1]!;

        // length for varchar
        const lengthMatch = opts.match(/length\s*:\s*(\d+)/);
        if (lengthMatch) {
          colType =
            colType === "VARCHAR"
              ? `VARCHAR(${lengthMatch[1]})`
              : `${colType}(${lengthMatch[1]})`;
        }
      }
    }

    // Handle @PrimaryKey() options
    if (isPrimaryKey) {
      const pkOptMatch = decorators.match(
        /@PrimaryKey\s*\(\s*(?:\{([^}]*)\})?\s*\)/,
      );
      if (pkOptMatch?.[1]) {
        const opts = pkOptMatch[1];
        const colTypeMatch = opts.match(/columnType\s*:\s*["'`](\w+)["'`]/);
        if (colTypeMatch) {
          colType = colTypeMatch[1]!.toUpperCase();
        }
        const typeMatch = opts.match(/type\s*:\s*["'`](\w+)["'`]/);
        if (typeMatch) {
          colType = mapMikroORMTypeToSQL(typeMatch[1]!);
        }
      }
    }

    // Handle @Enum() — resolve to VARCHAR by default
    if (isEnum) {
      colType = "VARCHAR";
    }

    // Handle @ManyToOne / @OneToOne FK columns
    let references: ParsedColumn["references"] | undefined;
    let cardinality: Cardinality | undefined;

    if (isManyToOne || isOneToOne) {
      cardinality = isManyToOne ? "one-to-many" : "one-to-one";

      // @ManyToOne(() => Entity) or @OneToOne(() => Entity)
      const relMatch = decorators.match(
        /@(?:ManyToOne|OneToOne)\s*\(\s*\(\)\s*=>\s*(\w+)/,
      );
      if (relMatch) {
        references = {
          table: relMatch[1]!,
          column: "id", // Convention: FK references 'id' by default
        };
      }

      // For ManyToOne/OneToOne, the column name is typically fieldName + "Id" or just fieldName
      // Use fieldName as the column name (MikroORM creates `field_id` or similar)
      if (!isProperty) {
        colType = "INTEGER";
      }
    }

    columns.push({
      name: columnName,
      type: colType,
      primaryKey: isPrimaryKey,
      unique: unique || isPrimaryKey,
      nullable: isPrimaryKey ? false : nullable,
      default: defaultValue,
      references,
      cardinality,
    });
  }

  return columns;
}

// -- Index parsing ------------------------------------------------------------

function parseEntityIndexes(
  body: string,
): { name: string; columns: string[]; unique: boolean }[] {
  const indexes: { name: string; columns: string[]; unique: boolean }[] = [];

  // Match @Index() on individual fields — extract column name from the field
  // We look for @Index() followed by other decorators and a field name
  const fieldIndexRegex =
    /@Index\s*\(\s*(?:\{([^}]*)\})?\s*\)\s*(?:@\w+(?:\s*\([^)]*(?:\([^)]*\)[^)]*)*\))\s*)*(\w+)\s*[!?]?\s*:/g;

  let match;
  while ((match = fieldIndexRegex.exec(body)) !== null) {
    const opts = match[1] || "";
    const fieldName = match[2]!;
    const isUnique = /unique\s*:\s*true/.test(opts);
    indexes.push({
      name: `idx_${fieldName}`,
      columns: [fieldName],
      unique: isUnique,
    });
  }

  return indexes;
}

// -- Type mapping -------------------------------------------------------------

function mapTSTypeToSQL(tsType: string): string {
  const cleanType = tsType
    .replace(/\[\]$/, "")
    .replace(/<.*>/, "")
    .replace(/\s*\|.*/, "") // Remove union types (e.g., "string | null")
    .trim();

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

function mapMikroORMTypeToSQL(mikroType: string): string {
  const map: Record<string, string> = {
    string: "VARCHAR",
    number: "INTEGER",
    boolean: "BOOLEAN",
    date: "TIMESTAMP",
    Date: "TIMESTAMP",
    bigint: "BIGINT",
    text: "TEXT",
    integer: "INTEGER",
    smallint: "SMALLINT",
    float: "FLOAT",
    double: "DOUBLE",
    decimal: "DECIMAL",
    uuid: "UUID",
    json: "JSON",
    jsonb: "JSONB",
    blob: "BYTEA",
  };

  return map[mikroType] || mikroType.toUpperCase();
}
