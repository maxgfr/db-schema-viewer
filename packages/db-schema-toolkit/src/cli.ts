import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseSchemaFile } from "./parsing/parse-schema-file";
import { analyzeSchema } from "./analysis/schema-analyzer";
import { diffSchemas } from "./analysis/schema-diff";
import { exportDiagramToSQL } from "./sql-export/index";
import { exportDiagramToMarkdown } from "./export/markdown-export";
import { exportDiagramToMermaid } from "./export/mermaid-export";
import { exportDiagramToPrisma } from "./export/prisma-export";
import { exportDiagramToDrizzle } from "./export/drizzle-export";
import { exportDiagramToDBML } from "./export/dbml-export";
import { exportDiagramToPlantUML } from "./export/plantuml-export";
import type { Diagram } from "./domain/index";
import type { DatabaseType } from "./domain/index";

const EXPORT_FORMATS = [
  "sql",
  "markdown",
  "mermaid",
  "prisma",
  "drizzle",
  "dbml",
  "plantuml",
  "json",
] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

const DB_TYPES = [
  "postgresql",
  "mysql",
  "mariadb",
  "sqlite",
  "supabase",
  "cockroachdb",
  "clickhouse",
  "bigquery",
  "snowflake",
] as const;

// ── Helpers ──────────────────────────────────────────────────────

function bold(s: string) {
  return `\x1b[1m${s}\x1b[0m`;
}
function dim(s: string) {
  return `\x1b[2m${s}\x1b[0m`;
}
function green(s: string) {
  return `\x1b[32m${s}\x1b[0m`;
}
function yellow(s: string) {
  return `\x1b[33m${s}\x1b[0m`;
}
function red(s: string) {
  return `\x1b[31m${s}\x1b[0m`;
}
function cyan(s: string) {
  return `\x1b[36m${s}\x1b[0m`;
}

function die(message: string): never {
  console.error(red(`Error: ${message}`));
  process.exit(1);
}

function readSchemaFile(filePath: string): { content: string; fileName: string } {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    die(`File not found: ${filePath}`);
  }
  const content = readFileSync(resolved, "utf-8");
  const fileName = basename(resolved);
  return { content, fileName };
}

function parseDiagram(filePath: string): Diagram {
  const { content, fileName } = readSchemaFile(filePath);
  try {
    return parseSchemaFile(content, fileName);
  } catch (err) {
    die(`Failed to parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function output(content: string, outputPath?: string) {
  if (outputPath) {
    writeFileSync(resolve(outputPath), content, "utf-8");
    console.error(green(`Written to ${outputPath}`));
  } else {
    process.stdout.write(content);
  }
}

function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { positional, flags };
}

// ── Commands ─────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${bold("db-schema-toolkit")} — Parse, export, and analyze database schemas from the CLI.

${bold("USAGE")}
  ${cyan("db-schema")} <command> [options]

${bold("COMMANDS")}
  ${green("export")} <file> ${dim("--format <fmt>")}   Convert schema to another format
  ${green("analyze")} <file>                Analyze schema quality
  ${green("diff")} <file1> <file2>          Compare two schemas
  ${green("parse")} <file>                  Parse and output diagram as JSON
  ${green("info")} <file>                   Show schema summary
  ${green("help")}                          Show this help message

${bold("EXPORT FORMATS")}
  sql, markdown, mermaid, prisma, drizzle, dbml, plantuml, json

${bold("OPTIONS")}
  ${dim("--format, -f")}     Output format (for export command)
  ${dim("--output, -o")}     Write to file instead of stdout
  ${dim("--db-type, -d")}    Target database type for SQL export
                   ${dim("(postgresql, mysql, mariadb, sqlite, supabase,")}
                   ${dim(" cockroachdb, clickhouse, bigquery, snowflake)")}
  ${dim("--json")}           Output as JSON (for analyze/diff commands)

${bold("EXAMPLES")}
  ${dim("# Convert a SQL schema to Mermaid ERD")}
  db-schema export schema.sql --format mermaid

  ${dim("# Convert Prisma schema to Markdown documentation")}
  db-schema export schema.prisma -f markdown -o docs.md

  ${dim("# Convert Drizzle schema to PostgreSQL DDL")}
  db-schema export schema.ts -f sql --db-type postgresql

  ${dim("# Analyze schema quality")}
  db-schema analyze schema.sql

  ${dim("# Compare two schema versions")}
  db-schema diff old-schema.sql new-schema.sql

  ${dim("# Parse and output as JSON for piping")}
  db-schema parse schema.prisma | jq '.tables[].name'

${bold("SUPPORTED INPUT FORMATS")}
  SQL (PostgreSQL, MySQL, SQLite, MariaDB, Supabase, CockroachDB,
       ClickHouse, BigQuery, Snowflake)
  Drizzle ORM (.ts), Prisma (.prisma), DBML (.dbml),
  TypeORM (.ts), MikroORM (.ts), Sequelize (.ts/.js), Kysely (.ts)
`);
}

function cmdExport(args: string[]) {
  const { positional, flags } = parseArgs(args);
  const filePath = positional[0];
  if (!filePath) die("Missing input file. Usage: db-schema export <file> --format <fmt>");

  const format = (flags["format"] || flags["f"]) as string | undefined;
  if (!format) die("Missing --format. Available: " + EXPORT_FORMATS.join(", "));
  if (!EXPORT_FORMATS.includes(format as ExportFormat)) {
    die(`Unknown format "${format}". Available: ${EXPORT_FORMATS.join(", ")}`);
  }

  const outputPath = (flags["output"] || flags["o"]) as string | undefined;
  const dbType = (flags["db-type"] || flags["d"]) as string | undefined;

  if (dbType && !DB_TYPES.includes(dbType as (typeof DB_TYPES)[number])) {
    die(`Unknown database type "${dbType}". Available: ${DB_TYPES.join(", ")}`);
  }

  const diagram = parseDiagram(filePath);
  let result: string;

  switch (format as ExportFormat) {
    case "sql":
      result = exportDiagramToSQL(diagram, (dbType as DatabaseType) ?? undefined);
      break;
    case "markdown":
      result = exportDiagramToMarkdown(diagram);
      break;
    case "mermaid":
      result = exportDiagramToMermaid(diagram);
      break;
    case "prisma":
      result = exportDiagramToPrisma(diagram);
      break;
    case "drizzle":
      result = exportDiagramToDrizzle(diagram);
      break;
    case "dbml":
      result = exportDiagramToDBML(diagram);
      break;
    case "plantuml":
      result = exportDiagramToPlantUML(diagram);
      break;
    case "json":
      result = JSON.stringify(diagram, null, 2) + "\n";
      break;
    default:
      die(`Unsupported format: ${format}`);
  }

  output(result, outputPath);
}

function cmdAnalyze(args: string[]) {
  const { positional, flags } = parseArgs(args);
  const filePath = positional[0];
  if (!filePath) die("Missing input file. Usage: db-schema analyze <file>");

  const diagram = parseDiagram(filePath);
  const analysis = analyzeSchema(diagram);
  const asJson = flags["json"] === true;

  if (asJson) {
    output(JSON.stringify(analysis, null, 2) + "\n", (flags["output"] || flags["o"]) as string | undefined);
    return;
  }

  const { metrics, antiPatterns, qualityScore } = analysis;

  console.log(`\n${bold("Schema Analysis")} — ${diagram.name || basename(filePath)}\n`);

  // Quality score
  const scoreColor = qualityScore.overall >= 80 ? green : qualityScore.overall >= 50 ? yellow : red;
  console.log(`${bold("Quality Score:")} ${scoreColor(String(qualityScore.overall) + "/100")}`);
  console.log(
    dim(
      `  Naming: ${qualityScore.naming}  Normalization: ${qualityScore.normalization}  Relationships: ${qualityScore.relationships}  Indexing: ${qualityScore.indexing}`
    )
  );

  // Metrics
  console.log(`\n${bold("Metrics")}`);
  console.log(`  Tables: ${metrics.tableCount}   Views: ${metrics.viewCount}   Fields: ${metrics.fieldCount}`);
  console.log(`  Relationships: ${metrics.relationshipCount}   Avg fields/table: ${metrics.avgFieldsPerTable.toFixed(1)}`);
  console.log(`  Relational density: ${metrics.relationalDensity.toFixed(2)}   Max FK depth: ${metrics.maxDepth}`);
  if (metrics.orphanTables.length > 0) {
    console.log(`  Orphan tables: ${metrics.orphanTables.join(", ")}`);
  }

  // Anti-patterns
  if (antiPatterns.length > 0) {
    console.log(`\n${bold("Issues")} (${antiPatterns.length})`);
    for (const ap of antiPatterns) {
      const icon =
        ap.severity === "critical" ? red("●") : ap.severity === "warning" ? yellow("●") : dim("●");
      const location = [ap.table, ap.field].filter(Boolean).join(".");
      console.log(`  ${icon} ${ap.description}${location ? dim(` [${location}]`) : ""}`);
      console.log(`    ${dim(ap.suggestion)}`);
    }
  } else {
    console.log(`\n${green("No issues detected!")}`);
  }

  console.log();
}

function cmdDiff(args: string[]) {
  const { positional, flags } = parseArgs(args);
  const file1 = positional[0];
  const file2 = positional[1];
  if (!file1 || !file2) die("Missing input files. Usage: db-schema diff <file1> <file2>");

  const diagram1 = parseDiagram(file1);
  const diagram2 = parseDiagram(file2);
  const diff = diffSchemas(diagram1, diagram2);
  const asJson = flags["json"] === true;

  if (asJson) {
    output(JSON.stringify(diff, null, 2) + "\n", (flags["output"] || flags["o"]) as string | undefined);
    return;
  }

  console.log(`\n${bold("Schema Diff")}`);
  console.log(dim(`  ${file1} → ${file2}\n`));

  if (diff.addedTables.length > 0) {
    console.log(green(`  + Tables added: ${diff.addedTables.join(", ")}`));
  }
  if (diff.removedTables.length > 0) {
    console.log(red(`  - Tables removed: ${diff.removedTables.join(", ")}`));
  }

  for (const td of diff.modifiedTables) {
    console.log(`\n  ${bold(td.tableName)}`);
    for (const f of td.addedFields) console.log(green(`    + ${f}`));
    for (const f of td.removedFields) console.log(red(`    - ${f}`));
    for (const f of td.modifiedFields) {
      for (const c of f.changes) {
        console.log(yellow(`    ~ ${f.fieldName}.${c.property}: ${c.oldValue} → ${c.newValue}`));
      }
    }
    for (const idx of td.addedIndexes) console.log(green(`    + index: ${idx}`));
    for (const idx of td.removedIndexes) console.log(red(`    - index: ${idx}`));
  }

  if (diff.addedRelationships.length > 0) {
    console.log(green(`\n  + Relationships added: ${diff.addedRelationships.length}`));
  }
  if (diff.removedRelationships.length > 0) {
    console.log(red(`  - Relationships removed: ${diff.removedRelationships.length}`));
  }

  console.log(`\n${dim(diff.summary)}\n`);
}

function cmdParse(args: string[]) {
  const { positional, flags } = parseArgs(args);
  const filePath = positional[0];
  if (!filePath) die("Missing input file. Usage: db-schema parse <file>");

  const diagram = parseDiagram(filePath);
  output(
    JSON.stringify(diagram, null, 2) + "\n",
    (flags["output"] || flags["o"]) as string | undefined
  );
}

function cmdInfo(args: string[]) {
  const { positional } = parseArgs(args);
  const filePath = positional[0];
  if (!filePath) die("Missing input file. Usage: db-schema info <file>");

  const diagram = parseDiagram(filePath);

  console.log(`\n${bold(diagram.name || basename(filePath))}`);
  console.log(dim(`  Database: ${diagram.databaseType}`));
  console.log(`  Tables: ${diagram.tables.filter((t) => !t.isView).length}`);
  console.log(`  Views: ${diagram.tables.filter((t) => t.isView).length}`);
  console.log(`  Fields: ${diagram.tables.reduce((s, t) => s + t.fields.length, 0)}`);
  console.log(`  Relationships: ${diagram.relationships.length}`);
  console.log();

  for (const table of diagram.tables) {
    const tag = table.isView ? dim(" (view)") : "";
    console.log(`  ${bold(table.name)}${tag}`);
    for (const f of table.fields) {
      const tags: string[] = [];
      if (f.primaryKey) tags.push(cyan("PK"));
      if (f.isForeignKey) tags.push(yellow("FK"));
      if (f.unique) tags.push(dim("UQ"));
      if (!f.nullable) tags.push(dim("NN"));
      const suffix = tags.length > 0 ? "  " + tags.join(" ") : "";
      console.log(`    ${f.name} ${dim(f.type)}${suffix}`);
    }
    console.log();
  }
}

// ── Main ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);

switch (command) {
  case "export":
    cmdExport(rest);
    break;
  case "analyze":
    cmdAnalyze(rest);
    break;
  case "diff":
    cmdDiff(rest);
    break;
  case "parse":
    cmdParse(rest);
    break;
  case "info":
    cmdInfo(rest);
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    die(`Unknown command "${command}". Run "db-schema help" for usage.`);
}
