import type { Diagram, Cardinality } from "../domain";
import type { ParsedColumn, ParsedRelationship } from "../parsing/types";
import { buildDiagram } from "../parsing/build-diagram";
import { extractBraceBlock } from "../parsing/extract-brace-block";
import { inlineObjectSpreads } from "../parsing/inline-helpers";

interface SequelizeModel {
  /** The variable/class name used in code (e.g., `User`, `Post`) */
  className: string;
  /** The SQL table name (from modelName / first arg / tableName option) */
  tableName: string;
  columns: ParsedColumn[];
  indexes: { name: string; columns: string[]; unique: boolean }[];
}

/**
 * Parse Sequelize model definitions from JavaScript/TypeScript source into a Diagram.
 *
 * Supports:
 * - `sequelize.define('ModelName', { ... })` syntax
 * - `Model.init({ ... }, { sequelize, modelName: '...' })` syntax
 * - DataTypes: STRING, INTEGER, BOOLEAN, DATE, TEXT, FLOAT, DECIMAL, UUID, JSON, ENUM
 * - Column options: primaryKey, allowNull, unique, defaultValue, references
 * - Associations: belongsTo, hasMany, hasOne, belongsToMany
 */
export function parseSequelizeSchema(content: string, name?: string): Diagram {
  // Strip comments to avoid false matches
  let cleaned = stripComments(content);

  // Inline constant object spreads (e.g., const baseColumns = {...}; ...baseColumns)
  cleaned = inlineObjectSpreads(cleaned);

  const models: SequelizeModel[] = [];
  const relationships: ParsedRelationship[] = [];

  // Extract models from both syntaxes
  extractDefineModels(cleaned, models);
  extractInitModels(cleaned, models);

  // Build className → tableName map for resolving associations
  const classToTable = new Map<string, string>();
  for (const model of models) {
    classToTable.set(model.className, model.tableName);
  }

  // Extract FK relationships from column `references`
  for (const model of models) {
    for (const col of model.columns) {
      if (!col.references) continue;

      // Resolve class names to table names
      const resolvedTable =
        classToTable.get(col.references.table) || col.references.table;
      col.references = { table: resolvedTable, column: col.references.column };

      // Find the target model to get the PK column name
      const targetModel = models.find(
        (m) => m.tableName === resolvedTable || m.className === resolvedTable,
      );
      const targetPK = targetModel?.columns.find((c) => c.primaryKey)?.name;

      relationships.push({
        sourceTable: model.tableName,
        sourceColumn: col.name,
        targetTable: resolvedTable,
        targetColumn: targetPK || col.references.column,
      });
    }
  }

  // Extract association-based relationships
  extractAssociations(cleaned, classToTable, models, relationships);

  // Convert to shared ParsedTable format
  const parsedTables = models.map((m) => ({
    name: m.tableName,
    columns: m.columns,
    indexes: m.indexes,
    isView: false,
  }));

  return buildDiagram(
    parsedTables,
    relationships,
    "postgresql",
    name ?? "Sequelize Schema",
  );
}

// ── Comment stripping ────────────────────────────────────────────

function stripComments(content: string): string {
  // Remove single-line comments
  content = content.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  return content;
}

// ── sequelize.define() extraction ────────────────────────────────

function extractDefineModels(
  content: string,
  models: SequelizeModel[],
): void {
  // Match patterns:
  //   const User = sequelize.define('User', { ... })
  //   const User = sequelize.define('User', { ... }, { ... })
  //   export const User = sequelize.define("users", { ... })
  const defineRegex =
    /(?:(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*)?(?:\w+)\.define\s*\(\s*["'`](\w+)["'`]\s*,\s*\{/g;

  let match;
  while ((match = defineRegex.exec(content)) !== null) {
    const variableName = match[1] || match[2]!;
    const modelName = match[2]!;

    // Find the opening brace of the columns object
    const braceStart = content.lastIndexOf("{", match.index + match[0].length);
    const body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    const columns = parseSequelizeColumns(body);

    // Check for a third options argument with tableName
    let tableName = modelName;
    const afterBody = content.substring(braceStart + 1 + body.length + 1); // after closing }
    const optionsMatch = afterBody.match(/^\s*,\s*\{/);
    if (optionsMatch) {
      const optStart =
        braceStart + 1 + body.length + 1 + optionsMatch.index! + optionsMatch[0].length - 1;
      const optBody = extractBraceBlock(content, optStart);
      if (optBody) {
        const tableNameMatch = optBody.match(
          /tableName\s*:\s*["'`](\w+)["'`]/,
        );
        if (tableNameMatch) {
          tableName = tableNameMatch[1]!;
        }
      }
    }

    models.push({
      className: variableName,
      tableName,
      columns,
      indexes: [],
    });
  }
}

// ── Model.init() extraction ──────────────────────────────────────

function extractInitModels(content: string, models: SequelizeModel[]): void {
  // Match patterns:
  //   User.init({ ... }, { sequelize, modelName: 'User' })
  //   class User extends Model {}
  //   User.init({ ... }, { sequelize, modelName: 'users', tableName: 'users' })
  const initRegex = /(\w+)\.init\s*\(\s*\{/g;

  let match;
  while ((match = initRegex.exec(content)) !== null) {
    const className = match[1]!;

    // Find the opening brace of the columns object
    const braceStart = content.lastIndexOf("{", match.index + match[0].length);
    const body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    const columns = parseSequelizeColumns(body);

    // Parse the second argument (options) to find modelName / tableName
    let tableName = className;
    const afterBody = content.substring(braceStart + 1 + body.length + 1);
    const optionsMatch = afterBody.match(/^\s*,\s*\{/);
    if (optionsMatch) {
      const optStart =
        braceStart + 1 + body.length + 1 + optionsMatch.index! + optionsMatch[0].length - 1;
      const optBody = extractBraceBlock(content, optStart);
      if (optBody) {
        const tableNameMatch = optBody.match(
          /tableName\s*:\s*["'`](\w+)["'`]/,
        );
        const modelNameMatch = optBody.match(
          /modelName\s*:\s*["'`](\w+)["'`]/,
        );
        if (tableNameMatch) {
          tableName = tableNameMatch[1]!;
        } else if (modelNameMatch) {
          tableName = modelNameMatch[1]!;
        }
      }
    }

    // Avoid duplicates if the same model was already parsed via define()
    if (!models.some((m) => m.className === className)) {
      models.push({
        className,
        tableName,
        columns,
        indexes: [],
      });
    }
  }
}

// ── Column parsing ───────────────────────────────────────────────

function parseSequelizeColumns(body: string): ParsedColumn[] {
  const columns: ParsedColumn[] = [];

  // Split body into top-level field entries by finding `fieldName: { ... }` or `fieldName: DataTypes.X`
  // We use a regex to find field names followed by either a block or a DataTypes reference
  const fieldRegex =
    /(\w+)\s*:\s*(?:(\{)|(?:new\s+)?DataTypes\s*\.\s*(\w+)(?:\s*\(([^)]*)\))?|(?:new\s+)?Sequelize\s*\.\s*(\w+)(?:\s*\(([^)]*)\))?)/g;

  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(body)) !== null) {
    const fieldName = fieldMatch[1]!;
    const isBlock = !!fieldMatch[2];
    const simpleType = fieldMatch[3] || fieldMatch[5];
    const simpleTypeArgs = fieldMatch[4] || fieldMatch[6];

    if (isBlock) {
      // Field defined as object: fieldName: { type: DataTypes.X, ... }
      const blockStart = body.lastIndexOf("{", fieldMatch.index + fieldMatch[0].length);
      const blockBody = extractBraceBlock(body, blockStart);
      if (!blockBody) continue;

      const col = parseColumnBlock(fieldName, blockBody);
      if (col) {
        columns.push(col);
        // Advance past the block to avoid re-matching content within it
        fieldRegex.lastIndex = blockStart + 1 + blockBody.length + 1;
      }
    } else if (simpleType) {
      // Field defined as shorthand: fieldName: DataTypes.STRING
      columns.push({
        name: fieldName,
        type: mapSequelizeType(simpleType, simpleTypeArgs),
        primaryKey: false,
        unique: false,
        nullable: true,
      });
    }
  }

  return columns;
}

function parseColumnBlock(fieldName: string, blockBody: string): ParsedColumn | null {
  // Extract `type: DataTypes.X(...)` or `type: Sequelize.X(...)`
  const typeMatch = blockBody.match(
    /type\s*:\s*(?:new\s+)?(?:DataTypes|Sequelize)\s*\.\s*(\w+)(?:\s*\(([^)]*)\))?/,
  );
  if (!typeMatch) return null;

  const dataType = typeMatch[1]!;
  const typeArgs = typeMatch[2];

  const isPK = /primaryKey\s*:\s*true/.test(blockBody);
  const allowNullMatch = blockBody.match(/allowNull\s*:\s*(true|false)/);
  const isNullable = allowNullMatch ? allowNullMatch[1] === "true" : !isPK;
  const isUnique = /unique\s*:\s*true/.test(blockBody);

  let defaultValue: string | undefined;
  const defaultMatch = blockBody.match(
    /defaultValue\s*:\s*(?:["'`]([^"'`]*)["'`]|(\d+(?:\.\d+)?)|(\w+))/,
  );
  if (defaultMatch) {
    defaultValue = defaultMatch[1] ?? defaultMatch[2] ?? defaultMatch[3];
  }

  // Parse references: { model: 'table', key: 'column' }
  let references: ParsedColumn["references"] | undefined;
  const referencesMatch = blockBody.match(
    /references\s*:\s*\{([^}]*)\}/,
  );
  if (referencesMatch) {
    const refBody = referencesMatch[1]!;
    const modelMatch = refBody.match(/model\s*:\s*["'`](\w+)["'`]/);
    const keyMatch = refBody.match(/key\s*:\s*["'`](\w+)["'`]/);
    if (modelMatch) {
      references = {
        table: modelMatch[1]!,
        column: keyMatch ? keyMatch[1]! : "id",
      };
    }
  }

  return {
    name: fieldName,
    type: mapSequelizeType(dataType, typeArgs),
    primaryKey: isPK,
    unique: isUnique || isPK,
    nullable: isPK ? false : isNullable,
    default: defaultValue,
    references,
  };
}

// ── Association extraction ───────────────────────────────────────

function extractAssociations(
  content: string,
  classToTable: Map<string, string>,
  models: SequelizeModel[],
  relationships: ParsedRelationship[],
): void {
  // Match: ModelA.belongsTo(ModelB, { foreignKey: '...' })
  // Match: ModelA.hasMany(ModelB, { foreignKey: '...' })
  // Match: ModelA.hasOne(ModelB, { foreignKey: '...' })
  // Match: ModelA.belongsToMany(ModelB, { through: '...' })
  const assocRegex =
    /(\w+)\s*\.\s*(belongsTo|hasMany|hasOne|belongsToMany)\s*\(\s*(\w+)(?:\s*,\s*\{([^}]*)\})?\s*\)/g;

  let match;
  while ((match = assocRegex.exec(content)) !== null) {
    const sourceClass = match[1]!;
    const assocType = match[2]!;
    const targetClass = match[3]!;
    const options = match[4] || "";

    const sourceTable = classToTable.get(sourceClass) || sourceClass;
    const targetTable = classToTable.get(targetClass) || targetClass;

    // Extract foreignKey from options
    const fkMatch = options.match(/foreignKey\s*:\s*["'`](\w+)["'`]/);
    const foreignKey = fkMatch ? fkMatch[1]! : undefined;

    // Determine cardinality and relationship direction
    let cardinality: Cardinality;
    let relSourceTable: string;
    let relSourceColumn: string;
    let relTargetTable: string;
    let relTargetColumn: string;

    const sourceModel = models.find((m) => m.className === sourceClass);
    const targetModel = models.find((m) => m.className === targetClass);
    const sourcePK = sourceModel?.columns.find((c) => c.primaryKey)?.name || "id";
    const targetPK = targetModel?.columns.find((c) => c.primaryKey)?.name || "id";

    switch (assocType) {
      case "belongsTo": {
        // source has FK pointing to target's PK
        cardinality = "one-to-many";
        const fkName = foreignKey || `${targetClass}Id`;
        relSourceTable = sourceTable;
        relSourceColumn = fkName;
        relTargetTable = targetTable;
        relTargetColumn = targetPK;
        break;
      }
      case "hasMany": {
        // target has FK pointing to source's PK
        cardinality = "one-to-many";
        const fkName = foreignKey || `${sourceClass}Id`;
        relSourceTable = targetTable;
        relSourceColumn = fkName;
        relTargetTable = sourceTable;
        relTargetColumn = sourcePK;
        break;
      }
      case "hasOne": {
        // target has FK pointing to source's PK (one-to-one)
        cardinality = "one-to-one";
        const fkName = foreignKey || `${sourceClass}Id`;
        relSourceTable = targetTable;
        relSourceColumn = fkName;
        relTargetTable = sourceTable;
        relTargetColumn = sourcePK;
        break;
      }
      case "belongsToMany": {
        // Many-to-many via junction table
        cardinality = "many-to-many";
        relSourceTable = sourceTable;
        relSourceColumn = sourcePK;
        relTargetTable = targetTable;
        relTargetColumn = targetPK;
        break;
      }
      default:
        continue;
    }

    // For belongsTo/hasMany/hasOne, ensure the FK column exists on the owning model
    // so that resolveRelationships in buildDiagram can match it.
    if (assocType !== "belongsToMany") {
      const fkOwnerModel = models.find((m) => m.tableName === relSourceTable);
      if (
        fkOwnerModel &&
        !fkOwnerModel.columns.some((c) => c.name === relSourceColumn)
      ) {
        fkOwnerModel.columns.push({
          name: relSourceColumn,
          type: "INTEGER",
          primaryKey: false,
          unique: assocType === "hasOne",
          nullable: true,
          references: { table: relTargetTable, column: relTargetColumn },
        });
      }
    }

    // Avoid duplicates
    const exists = relationships.some(
      (r) =>
        r.sourceTable === relSourceTable &&
        r.sourceColumn === relSourceColumn &&
        r.targetTable === relTargetTable &&
        r.targetColumn === relTargetColumn,
    );

    if (!exists) {
      relationships.push({
        sourceTable: relSourceTable,
        sourceColumn: relSourceColumn,
        targetTable: relTargetTable,
        targetColumn: relTargetColumn,
        cardinality,
        isOrmOnly: true,
      });
    }
  }
}

// ── Type mapping ─────────────────────────────────────────────────

function mapSequelizeType(dataType: string, args?: string): string {
  const upper = dataType.toUpperCase();

  const map: Record<string, string> = {
    STRING: "VARCHAR",
    TEXT: "TEXT",
    CITEXT: "CITEXT",
    INTEGER: "INTEGER",
    BIGINT: "BIGINT",
    SMALLINT: "SMALLINT",
    TINYINT: "TINYINT",
    MEDIUMINT: "MEDIUMINT",
    FLOAT: "FLOAT",
    REAL: "REAL",
    DOUBLE: "DOUBLE PRECISION",
    DECIMAL: "DECIMAL",
    BOOLEAN: "BOOLEAN",
    DATE: "TIMESTAMP",
    DATEONLY: "DATE",
    TIME: "TIME",
    UUID: "UUID",
    UUIDV4: "UUID",
    UUIDV1: "UUID",
    JSON: "JSON",
    JSONB: "JSONB",
    BLOB: "BLOB",
    ARRAY: "ARRAY",
    VIRTUAL: "VIRTUAL",
    CHAR: "CHAR",
    GEOMETRY: "GEOMETRY",
    GEOGRAPHY: "GEOGRAPHY",
    HSTORE: "HSTORE",
    RANGE: "RANGE",
    CIDR: "CIDR",
    INET: "INET",
    MACADDR: "MACADDR",
  };

  const mapped = map[upper] || upper;

  if (args !== undefined && args.trim() !== "") {
    // STRING(255) -> VARCHAR(255), ENUM('a','b') -> ENUM('a','b')
    if (upper === "STRING" || upper === "CHAR") {
      return `${mapped}(${args.trim()})`;
    }
    if (upper === "DECIMAL" || upper === "FLOAT" || upper === "DOUBLE") {
      return `${mapped}(${args.trim()})`;
    }
    if (upper === "ENUM") {
      return `ENUM(${args.trim()})`;
    }
  }

  return mapped;
}
