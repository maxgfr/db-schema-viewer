import type { Diagram } from "@/lib/domain";
import { parseSQLToDiagram } from "@/lib/sql";
import { parseDrizzleSchema } from "@/lib/drizzle/drizzle-parser";
import { parsePrismaSchema } from "@/lib/prisma/prisma-parser";
import { parseDBMLSchema } from "@/lib/dbml/dbml-parser";
import { parseTypeORMSchema } from "@/lib/typeorm/typeorm-parser";
import { autoLayout } from "@/lib/layout/auto-layout";

/**
 * Detect format from fileName extension, route to the appropriate parser,
 * apply auto-layout, and return a Diagram.
 *
 * - `.dbml`        -> parseDBMLSchema
 * - `.prisma`      -> parsePrismaSchema
 * - `.ts`/`.js` with @Entity/@Column/@PrimaryGeneratedColumn -> parseTypeORMSchema
 * - `.ts`/`.js` (default) -> parseDrizzleSchema
 * - otherwise      -> parseSQLToDiagram
 */
export function parseSchemaFile(content: string, fileName?: string): Diagram {
  const isDBML = fileName?.endsWith(".dbml");
  const isPrisma = fileName?.endsWith(".prisma");
  const isTS = fileName?.endsWith(".ts") || fileName?.endsWith(".js");
  const isTypeORM =
    isTS && /(@Entity|@Column|@PrimaryGeneratedColumn)/.test(content);
  const isDrizzle = isTS && !isTypeORM;

  let diagram: Diagram;

  if (isDBML) {
    diagram = parseDBMLSchema(content, stripExtension(fileName));
  } else if (isPrisma) {
    diagram = parsePrismaSchema(content, stripExtension(fileName));
  } else if (isTypeORM) {
    diagram = parseTypeORMSchema(content, stripExtension(fileName));
  } else if (isDrizzle) {
    diagram = parseDrizzleSchema(content, stripExtension(fileName));
  } else {
    diagram = parseSQLToDiagram(content, stripExtension(fileName));
  }

  const layoutedTables = autoLayout(diagram.tables, diagram.relationships);
  return { ...diagram, tables: layoutedTables };
}

/** Remove file extension from a filename, returning just the base name. */
function stripExtension(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  return fileName.replace(/\.[^.]+$/, "");
}
