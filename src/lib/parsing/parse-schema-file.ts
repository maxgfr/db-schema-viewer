import type { Diagram } from "@/lib/domain";
import { parseSQLToDiagram } from "@/lib/sql";
import { parseDrizzleSchema } from "@/lib/drizzle/drizzle-parser";
import { parsePrismaSchema } from "@/lib/prisma/prisma-parser";
import { parseDBMLSchema } from "@/lib/dbml/dbml-parser";
import { parseTypeORMSchema } from "@/lib/typeorm/typeorm-parser";
import { parseSequelizeSchema } from "@/lib/sequelize/sequelize-parser";
import { parseMikroORMSchema } from "@/lib/mikroorm/mikroorm-parser";
import { parseKyselySchema } from "@/lib/kysely/kysely-parser";
import { autoLayout } from "@/lib/layout/auto-layout";

/**
 * Detect format from fileName extension (or content heuristics for auto-detect),
 * route to the appropriate parser, apply auto-layout, and return a Diagram.
 */
export function parseSchemaFile(content: string, fileName?: string): Diagram {
  const format = detectFormat(content, fileName);
  const name = stripExtension(fileName);

  let diagram: Diagram;

  switch (format) {
    case "dbml":
      diagram = parseDBMLSchema(content, name);
      break;
    case "prisma":
      diagram = parsePrismaSchema(content, name);
      break;
    case "typeorm":
      diagram = parseTypeORMSchema(content, name);
      break;
    case "sequelize":
      diagram = parseSequelizeSchema(content, name);
      break;
    case "mikroorm":
      diagram = parseMikroORMSchema(content, name);
      break;
    case "kysely":
      diagram = parseKyselySchema(content, name);
      break;
    case "drizzle":
      diagram = parseDrizzleSchema(content, name);
      break;
    default:
      diagram = parseSQLToDiagram(content, name);
  }

  const layoutedTables = autoLayout(diagram.tables, diagram.relationships);
  return { ...diagram, tables: layoutedTables };
}

type SchemaFormat = "sql" | "drizzle" | "prisma" | "typeorm" | "dbml" | "sequelize" | "mikroorm" | "kysely";

/**
 * Detect schema format from file extension first, then fall back to
 * content-based heuristics (for auto-detect / paste without extension).
 */
export function detectFormat(content: string, fileName?: string): SchemaFormat {
  // 1. Extension-based detection
  if (fileName?.endsWith(".dbml")) return "dbml";
  if (fileName?.endsWith(".prisma")) return "prisma";

  const isTS = fileName?.endsWith(".ts") || fileName?.endsWith(".js");
  if (isTS) {
    // TypeORM: @Entity, @Column decorators
    if (/(@Entity|@Column|@PrimaryGeneratedColumn)/.test(content)) {
      // MikroORM also uses @Entity but with @Property instead of @Column
      if (/@Property\s*\(/.test(content) || /@PrimaryKey\s*\(/.test(content))
        return "mikroorm";
      return "typeorm";
    }
    // Sequelize: define() or Model.init()
    if (/sequelize\.define\s*\(/.test(content) || /\.init\s*\(\s*\{/.test(content) && /DataTypes\./.test(content))
      return "sequelize";
    // Kysely: interface Database or type Database
    if (/(?:interface|type)\s+Database\s*[={]/.test(content) && /Generated</.test(content))
      return "kysely";
    return "drizzle";
  }

  // 2. Content-based detection (auto-detect mode: no fileName or unknown extension)
  if (fileName && /\.(sql|txt)$/i.test(fileName)) return "sql";

  // Drizzle: imports from drizzle-orm, or uses pgTable/mysqlTable/sqliteTable/pgTableCreator
  if (
    /from\s+["']drizzle-orm/.test(content) ||
    /(?:pgTable|mysqlTable|sqliteTable|pgTableCreator)\s*[(<]/.test(content)
  ) {
    return "drizzle";
  }

  // MikroORM: @Entity + @Property
  if (/@Entity\s*\(/.test(content) && /@Property\s*\(/.test(content))
    return "mikroorm";

  // TypeORM: decorators
  if (/(@Entity|@Column|@PrimaryGeneratedColumn)/.test(content))
    return "typeorm";

  // Sequelize: define() or DataTypes
  if (/sequelize\.define\s*\(/.test(content) || (/\.init\s*\(/.test(content) && /DataTypes\./.test(content)))
    return "sequelize";

  // Kysely: interface Database with Generated<>
  if (/(?:interface|type)\s+Database\s*[={]/.test(content) && /Generated</.test(content))
    return "kysely";

  // Prisma: model blocks with field definitions
  if (/^\s*model\s+\w+\s*\{/m.test(content)) return "prisma";

  // DBML: Table blocks or Ref: declarations
  if (/^\s*Table\s+\w+/m.test(content) || /^\s*Ref\s*:/m.test(content))
    return "dbml";

  return "sql";
}

/** Remove file extension from a filename, returning just the base name. */
function stripExtension(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  return fileName.replace(/\.[^.]+$/, "");
}
