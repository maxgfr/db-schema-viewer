import type { Diagram, Cardinality } from "@/lib/domain";
import { generateId, getTableColor } from "@/lib/utils";

interface TypeORMColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  unique: boolean;
  nullable: boolean;
  default?: string;
  comment?: string;
  isForeignKey: boolean;
  references?: {
    table: string;
    field: string;
  };
  cardinality?: Cardinality;
}

interface TypeORMEntity {
  className: string;
  tableName: string;
  columns: TypeORMColumn[];
  indexes: { name: string; columns: string[]; unique: boolean }[];
}


/**
 * Parse TypeORM entity definitions from TypeScript source into a Diagram.
 * Uses regex-based parsing since we can't run TypeScript in the browser.
 */
export function parseTypeORMSchema(content: string, name?: string): Diagram {
  const entities = extractEntities(content);

  return buildTypeORMDiagram(entities, name);
}

function extractEntities(content: string): TypeORMEntity[] {
  const entities: TypeORMEntity[] = [];

  // Match @Entity() or @Entity("table_name") followed by class declaration
  // Handles: @Entity(), @Entity("name"), @Entity('name'), @Entity({name: "x"})
  const entityRegex =
    /@Entity\s*\(\s*(?:["'`](\w+)["'`]|(\{[^}]*\}))?\s*\)\s*(?:export\s+)?class\s+(\w+)/g;

  let match;
  while ((match = entityRegex.exec(content)) !== null) {
    const entityDecoTableName = match[1];
    const entityOpts = match[2];
    const className = match[3]!;

    let tableName = className;
    if (entityDecoTableName) {
      tableName = entityDecoTableName;
    } else if (entityOpts) {
      const nameMatch = entityOpts.match(/name\s*:\s*["'`](\w+)["'`]/);
      if (nameMatch) {
        tableName = nameMatch[1]!;
      }
    }

    // Find class body
    const classStart = content.indexOf("{", match.index + match[0].length - className.length);
    if (classStart === -1) continue;

    // Find the opening brace of the class body (after 'class Name')
    let braceStart = -1;
    for (let i = match.index + match[0].length; i < content.length; i++) {
      if (content[i] === "{") {
        braceStart = i;
        break;
      }
    }
    if (braceStart === -1) continue;

    const body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    const columns = parseEntityColumns(body);
    const indexes = parseEntityIndexes(content, match.index, className);

    entities.push({
      className,
      tableName,
      columns,
      indexes,
    });
  }

  return entities;
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

function parseEntityColumns(body: string): TypeORMColumn[] {
  const columns: TypeORMColumn[] = [];

  // Split body into property blocks by looking for decorator patterns
  // Each property has zero or more decorators followed by a field declaration
  const propertyRegex =
    /((?:@\w+(?:\s*\([^)]*(?:\([^)]*\)[^)]*)*\))\s*)+)\s*(\w+)\s*(?:!|(?:\?))?\s*:\s*([^;]+);/g;

  let match;
  while ((match = propertyRegex.exec(body)) !== null) {
    const decorators = match[1]!;
    const fieldName = match[2]!;
    const tsType = match[3]!.trim();

    // Skip relation fields (they don't map to columns directly, unless they have @JoinColumn)
    const isRelation =
      /@(?:OneToMany|ManyToMany)\s*\(/.test(decorators);
    if (isRelation) continue;

    // Check for @ManyToOne or @OneToOne (these create FK columns)
    const isManyToOne = /@ManyToOne\s*\(/.test(decorators);
    const isOneToOne = /@OneToOne\s*\(/.test(decorators);
    const hasJoinColumn = /@JoinColumn\s*\(/.test(decorators);

    // If it's a relation without @JoinColumn for ManyToOne, TypeORM still creates a column
    // but for OneToOne without JoinColumn, skip (the other side owns it)
    if (isOneToOne && !hasJoinColumn) continue;

    // Check for primary key decorators
    const isPrimaryGenerated = /@PrimaryGeneratedColumn\s*\(/.test(decorators);
    const isPrimaryColumn = /@PrimaryColumn\s*\(/.test(decorators);
    const isPK = isPrimaryGenerated || isPrimaryColumn;

    // Check for special date columns
    const isCreateDate = /@CreateDateColumn\s*\(/.test(decorators);
    const isUpdateDate = /@UpdateDateColumn\s*\(/.test(decorators);
    const isDeleteDate = /@DeleteDateColumn\s*\(/.test(decorators);
    const isDateColumn = isCreateDate || isUpdateDate || isDeleteDate;

    // Check for regular @Column
    const isColumn = /@Column\s*\(/.test(decorators);

    // Skip if no column-related decorator
    if (!isPK && !isColumn && !isDateColumn && !isManyToOne && !isOneToOne) continue;

    // Extract column options
    let colType = mapTSTypeToSQL(tsType);
    let nullable = false;
    let unique = false;
    let defaultValue: string | undefined;
    let columnName = fieldName;

    if (isPrimaryGenerated) {
      const pgMatch = decorators.match(/@PrimaryGeneratedColumn\s*\(\s*["'`](\w+)["'`]?\s*\)/);
      if (pgMatch && pgMatch[1] === "uuid") {
        colType = "UUID";
      } else {
        colType = "INTEGER";
      }
    }

    if (isPrimaryColumn) {
      const pcMatch = decorators.match(/@PrimaryColumn\s*\(\s*(?:\{([^}]*)\}|["'`](\w+)["'`])?\s*\)/);
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
      const colOptMatch = decorators.match(/@Column\s*\(\s*(?:\{([^}]*)\}|["'`](\w+)["'`])?\s*\)/);
      if (colOptMatch) {
        if (colOptMatch[2]) {
          colType = colOptMatch[2].toUpperCase();
        } else if (colOptMatch[1]) {
          const opts = colOptMatch[1];

          const typeMatch = opts.match(/type\s*:\s*["'`](\w+)["'`]/);
          if (typeMatch) colType = typeMatch[1]!.toUpperCase();

          const lengthMatch = opts.match(/length\s*:\s*(\d+)/);
          if (lengthMatch && colType === "VARCHAR") {
            colType = `VARCHAR(${lengthMatch[1]})`;
          } else if (lengthMatch) {
            colType = `${colType}(${lengthMatch[1]})`;
          }

          if (/nullable\s*:\s*true/.test(opts)) nullable = true;
          if (/unique\s*:\s*true/.test(opts)) unique = true;

          const defaultMatch = opts.match(/default\s*:\s*("[^"]*"|'[^']*'|[^,}]+)/);
          if (defaultMatch) {
            let val = defaultMatch[1]!.trim();
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
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
    let isForeignKey = false;
    let references: TypeORMColumn["references"] | undefined;
    let cardinality: Cardinality | undefined;

    if (isManyToOne || (isOneToOne && hasJoinColumn)) {
      isForeignKey = true;
      cardinality = isManyToOne ? "one-to-many" : "one-to-one";

      // Get target entity from decorator
      const relMatch = decorators.match(/@(?:ManyToOne|OneToOne)\s*\(\s*\(\)\s*=>\s*(\w+)/);
      if (relMatch) {
        const targetEntity = relMatch[1]!;
        references = {
          table: targetEntity,
          field: "id", // Convention: FK references 'id' by default
        };
      }

      // Get join column name if specified
      const joinColMatch = decorators.match(/@JoinColumn\s*\(\s*\{([^}]*)\}\s*\)/);
      if (joinColMatch) {
        const jcNameMatch = joinColMatch[1]!.match(/name\s*:\s*["'`](\w+)["'`]/);
        if (jcNameMatch) {
          columnName = jcNameMatch[1]!;
        }
      }

      // For ManyToOne without explicit type, use INTEGER for FK
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
      isForeignKey,
      references,
      cardinality,
    });
  }

  return columns;
}

function parseEntityIndexes(
  content: string,
  entityStart: number,
  _className: string
): { name: string; columns: string[]; unique: boolean }[] {
  const indexes: { name: string; columns: string[]; unique: boolean }[] = [];

  // Look for @Index decorators before the class
  // Find the chunk before the class but after any previous class
  const before = content.substring(Math.max(0, entityStart - 500), entityStart);

  const indexRegex = /@Index\s*\(\s*(?:["'`](\w+)["'`]\s*,\s*)?\[([^\]]*)\](?:\s*,\s*\{([^}]*)\})?\s*\)/g;
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

function mapTSTypeToSQL(tsType: string): string {
  // Clean up the type - remove array brackets, generics, etc.
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

function buildTypeORMDiagram(
  entities: TypeORMEntity[],
  name?: string
): Diagram {
  // Build a map from className to tableName
  const classToTable = new Map<string, string>();
  for (const entity of entities) {
    classToTable.set(entity.className, entity.tableName);
  }

  const tables = entities.map((entity, index) => ({
    id: generateId(),
    name: entity.tableName,
    schema: undefined,
    fields: entity.columns.map((col) => {
      // Resolve references: replace entity class name with table name
      let resolvedRef = col.references;
      if (resolvedRef) {
        const resolvedTable = classToTable.get(resolvedRef.table) || resolvedRef.table;
        resolvedRef = { table: resolvedTable, field: resolvedRef.field };
      }

      return {
        id: generateId(),
        name: col.name,
        type: col.type,
        primaryKey: col.primaryKey,
        unique: col.unique,
        nullable: col.nullable,
        default: col.default,
        comment: col.comment,
        isForeignKey: col.isForeignKey,
        references: resolvedRef,
      };
    }),
    indexes: entity.indexes.map((idx) => ({
      id: generateId(),
      name: idx.name,
      columns: idx.columns,
      unique: idx.unique,
    })),
    x: 0,
    y: 0,
    color: getTableColor(index),
    isView: false,
  }));

  // Build table lookup by class name
  const tableByClass = new Map<string, (typeof tables)[number]>();
  for (let i = 0; i < entities.length; i++) {
    tableByClass.set(entities[i]!.className, tables[i]!);
  }
  // Also by resolved table name
  const tableByTableName = new Map(tables.map((t) => [t.name.toLowerCase(), t]));

  const relationships: {
    id: string;
    sourceTableId: string;
    sourceFieldId: string;
    targetTableId: string;
    targetFieldId: string;
    cardinality: Cardinality;
  }[] = [];

  // Build relationships from FK columns
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i]!;
    const table = tables[i]!;

    for (let j = 0; j < entity.columns.length; j++) {
      const col = entity.columns[j]!;
      if (!col.isForeignKey || !col.references) continue;

      const field = table.fields[j]!;

      // Resolve target: references.table is the class name, look up both class and table name
      const targetTable =
        tableByClass.get(col.references.table) ||
        tableByTableName.get(col.references.table.toLowerCase());
      if (!targetTable) continue;

      // Find PK field in target table
      const targetField = targetTable.fields.find((f) => f.primaryKey);
      if (!targetField) continue;

      relationships.push({
        id: generateId(),
        sourceTableId: table.id,
        sourceFieldId: field.id,
        targetTableId: targetTable.id,
        targetFieldId: targetField.id,
        cardinality: col.cardinality || "one-to-many",
      });
    }
  }

  return {
    id: generateId(),
    name: name ?? "TypeORM Schema",
    databaseType: "postgresql",
    tables,
    relationships,
    createdAt: new Date().toISOString(),
  };
}
