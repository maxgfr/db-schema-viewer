import { faker } from "@faker-js/faker";
import type { DBTable, DBField, DBRelationship } from "../domain";
import type { ParsedDumpTable, ParsedRow } from "./dump-parser";

const DEFAULT_ROW_COUNT = 30;

// ── Type detection helpers ─────────────────────────────────────────

function isIntegerType(sqlType: string): boolean {
  return /\b(int|integer|smallint|tinyint|bigint|serial|mediumint)\b/i.test(sqlType);
}

function isFloatType(sqlType: string): boolean {
  return /\b(float|double|real|decimal|numeric|money|dec)\b/i.test(sqlType);
}

function isBooleanType(sqlType: string): boolean {
  return /\b(bool|boolean|bit)\b/i.test(sqlType);
}

function isDateType(sqlType: string): boolean {
  return /\b(date|datetime|timestamp|timestamptz|time)\b/i.test(sqlType);
}

function isTextType(sqlType: string): boolean {
  return /\b(text|varchar|char|string|clob|longtext|mediumtext|tinytext|nvarchar|nchar)\b/i.test(sqlType);
}

function isJsonType(sqlType: string): boolean {
  return /\b(json|jsonb)\b/i.test(sqlType);
}

function isUuidType(sqlType: string): boolean {
  return /\b(uuid|guid)\b/i.test(sqlType);
}

function isBinaryType(sqlType: string): boolean {
  return /\b(bytea|blob|binary|varbinary|longblob|mediumblob|tinyblob|bytes)\b/i.test(sqlType);
}

function isEnumType(sqlType: string): boolean {
  return /\benum\b/i.test(sqlType);
}

/** Extract enum values from types like ENUM(a,b,c) or ENUM('a','b','c') */
function extractEnumValues(sqlType: string): string[] | null {
  const match = sqlType.match(/\benum\s*\(([^)]+)\)/i);
  if (!match) return null;
  return match[1]!
    .split(",")
    .map((v) => v.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

// ── Per-field value generators ─────────────────────────────────────

type ValueGenerator = (index: number) => string | number | boolean | null;

/**
 * Determine the best value generator for a field based on its name and type.
 * Does NOT handle PK or FK logic — those are resolved in the main loop.
 */
function getFieldGenerator(field: DBField): ValueGenerator {
  const name = field.name.toLowerCase();
  const type = field.type;

  // ── Name-based heuristics (highest priority) ──

  if (/^(email|e_mail|email_address)$/.test(name) || name.endsWith("_email")) {
    return () => faker.internet.email();
  }
  if (/^(first_?name|given_?name|prenom)$/i.test(name)) {
    return () => faker.person.firstName();
  }
  if (/^(last_?name|family_?name|surname|nom)$/i.test(name)) {
    return () => faker.person.lastName();
  }
  if (/^(full_?name|name|display_?name|author)$/i.test(name)) {
    return () => faker.person.fullName();
  }
  if (/^(username|user_?name|login|handle)$/i.test(name)) {
    return () => faker.internet.username();
  }
  if (/^(phone|phone_?number|tel|telephone|mobile)$/i.test(name)) {
    return () => faker.phone.number();
  }
  if (/^(city|ville)$/i.test(name)) {
    return () => faker.location.city();
  }
  if (/^(country|pays)$/i.test(name)) {
    return () => faker.location.country();
  }
  if (/^(country_?code|code_?pays)$/i.test(name)) {
    return () => faker.location.countryCode();
  }
  if (/^(street|address|addr|adresse)$/i.test(name)) {
    return () => faker.location.streetAddress();
  }
  if (/^(zip|zip_?code|postal_?code|code_?postal)$/i.test(name)) {
    return () => faker.location.zipCode();
  }
  if (/^(latitude|lat)$/i.test(name)) {
    return () => parseFloat(faker.location.latitude().toString());
  }
  if (/^(longitude|lng|lon)$/i.test(name)) {
    return () => parseFloat(faker.location.longitude().toString());
  }
  if (/^(url|website|link|href)$/i.test(name)) {
    return () => faker.internet.url();
  }
  if (/^(avatar|image_?url|photo_?url|avatar_?url|profile_?image|picture)$/i.test(name)) {
    return () => faker.image.avatar();
  }
  if (/^(ip|ip_?address)$/i.test(name)) {
    return () => faker.internet.ip();
  }
  if (/^(ipv6|ip_?v6)$/i.test(name)) {
    return () => faker.internet.ipv6();
  }
  if (/^(mac|mac_?address)$/i.test(name)) {
    return () => faker.internet.mac();
  }
  if (/^(user_?agent|ua)$/i.test(name)) {
    return () => faker.internet.userAgent();
  }
  if (/^(color|colour)$/i.test(name)) {
    return () => faker.color.human();
  }
  if (/^(hex_?color|color_?hex)$/i.test(name)) {
    return () => faker.color.rgb();
  }
  if (/^(status|state|etat)$/i.test(name)) {
    return () => faker.helpers.arrayElement(["active", "inactive", "pending", "archived", "draft"]);
  }
  if (/^(role|user_?role|permission)$/i.test(name)) {
    return () => faker.helpers.arrayElement(["admin", "user", "editor", "viewer", "moderator"]);
  }
  if (/^(category|kind|genre)$/i.test(name)) {
    return () => faker.commerce.department();
  }
  if (/^(type)$/i.test(name)) {
    return () => faker.commerce.productAdjective();
  }
  if (/^(tag|label)$/i.test(name)) {
    return () => faker.word.noun();
  }
  if (/^(title|subject|headline)$/i.test(name)) {
    return () => faker.lorem.sentence({ min: 3, max: 6 });
  }
  if (/^(description|bio|summary|about)$/i.test(name)) {
    return () => faker.lorem.paragraph();
  }
  if (/^(content|body|text)$/i.test(name)) {
    return () => faker.lorem.paragraphs(2);
  }
  if (/^(notes?|comment|message|feedback)$/i.test(name)) {
    return () => faker.lorem.sentences(2);
  }
  if (/^(slug)$/i.test(name)) {
    return () => faker.helpers.slugify(faker.lorem.words(3)).toLowerCase();
  }
  if (/^(price|amount|total|cost|subtotal|unit_?price)$/i.test(name)) {
    return () => parseFloat(faker.commerce.price({ min: 1, max: 999 }));
  }
  if (/^(quantity|qty|count|stock)$/i.test(name)) {
    return () => faker.number.int({ min: 1, max: 500 });
  }
  if (/^(age)$/i.test(name)) {
    return () => faker.number.int({ min: 18, max: 85 });
  }
  if (/^(weight|height|size|width|length|depth)$/i.test(name)) {
    return () => faker.number.float({ min: 0.1, max: 999, fractionDigits: 2 });
  }
  if (/^(rating|score)$/i.test(name)) {
    return () => faker.number.float({ min: 1, max: 5, fractionDigits: 1 });
  }
  if (/^(currency|currency_?code)$/i.test(name)) {
    return () => faker.finance.currencyCode();
  }
  if (/^(iban)$/i.test(name)) {
    return () => faker.finance.iban();
  }
  if (/^(company|company_?name|organization|org)$/i.test(name)) {
    return () => faker.company.name();
  }
  if (/^(job|job_?title|position|occupation)$/i.test(name)) {
    return () => faker.person.jobTitle();
  }
  if (/^(product|product_?name|item|item_?name)$/i.test(name)) {
    return () => faker.commerce.productName();
  }
  if (/^(sku|product_?code|barcode)$/i.test(name)) {
    return () => faker.string.alphanumeric(10).toUpperCase();
  }
  if (/^(file_?name|filename)$/i.test(name)) {
    return () => faker.system.fileName();
  }
  if (/^(mime_?type|content_?type)$/i.test(name)) {
    return () => faker.system.mimeType();
  }
  if (/^(file_?path|path)$/i.test(name)) {
    return () => faker.system.filePath();
  }
  if (/^(locale|language|lang)$/i.test(name)) {
    return () => faker.helpers.arrayElement(["en", "fr", "de", "es", "ja", "zh", "pt", "it", "ko", "ru"]);
  }
  if (/^(timezone|tz|time_?zone)$/i.test(name)) {
    return () => faker.location.timeZone();
  }
  if (/^(is_|has_|can_|allow|enabled|active|verified|deleted|published|archived|blocked|confirmed)/i.test(name)) {
    return () => faker.datatype.boolean({ probability: 0.7 });
  }
  if (/(created|updated|deleted|modified|registered|published|expired|started|ended|logged|last_?login|last_?seen|birth|dob)(_?at|_?on|_?date|_?time)?$/i.test(name)) {
    return () => faker.date.between({ from: "2022-01-01", to: "2025-12-31" }).toISOString().replace("T", " ").slice(0, 19);
  }
  if (/^(password|hash|password_?hash)$/i.test(name)) {
    return () => faker.internet.password({ length: 60, prefix: "$2b$10$" });
  }
  if (/^(token|access_?token|refresh_?token|api_?key|secret)$/i.test(name)) {
    return () => faker.string.alphanumeric(64);
  }
  if (/^(salt)$/i.test(name)) {
    return () => faker.string.hexadecimal({ length: 32, prefix: "" });
  }

  // ── Type-based fallbacks ──

  if (isEnumType(type)) {
    const values = extractEnumValues(type);
    if (values && values.length > 0) {
      return () => faker.helpers.arrayElement(values);
    }
    return () => faker.helpers.arrayElement(["active", "inactive", "pending", "archived", "draft"]);
  }
  if (isBooleanType(type)) {
    return () => faker.datatype.boolean();
  }
  if (isUuidType(type)) {
    return () => faker.string.uuid();
  }
  if (isDateType(type)) {
    if (/timestamp|datetime/i.test(type)) {
      return () => faker.date.between({ from: "2022-01-01", to: "2025-12-31" }).toISOString().replace("T", " ").slice(0, 19);
    }
    return () => faker.date.between({ from: "2022-01-01", to: "2025-12-31" }).toISOString().split("T")[0]!;
  }
  if (isJsonType(type)) {
    return () => JSON.stringify({ [faker.word.noun()]: faker.word.adjective(), count: faker.number.int({ min: 1, max: 100 }) });
  }
  if (isBinaryType(type)) {
    return () => `\\x${faker.string.hexadecimal({ length: 32, prefix: "" })}`;
  }
  if (isIntegerType(type)) {
    return () => faker.number.int({ min: 1, max: 10000 });
  }
  if (isFloatType(type)) {
    return () => faker.number.float({ min: 0.01, max: 9999.99, fractionDigits: 2 });
  }
  if (isTextType(type)) {
    return () => faker.lorem.sentence();
  }

  // Fallback: short string
  return () => faker.lorem.words(3);
}

// ── FK resolution helpers ──────────────────────────────────────────

interface FKTarget {
  targetTableId: string;
  targetFieldId: string;
}

/**
 * Build FK lookup from both explicit relationships AND field.references.
 * This handles cases where parsers set field.references without creating a relationship entry.
 */
function buildFKLookup(
  tables: DBTable[],
  relationships: DBRelationship[],
): Map<string, FKTarget> {
  const fkTargets = new Map<string, FKTarget>();

  // 1. From explicit relationships (authoritative)
  for (const rel of relationships) {
    fkTargets.set(`${rel.sourceTableId}.${rel.sourceFieldId}`, {
      targetTableId: rel.targetTableId,
      targetFieldId: rel.targetFieldId,
    });
  }

  // 2. From field.references as fallback (by name → resolved to IDs)
  const tableByName = new Map<string, DBTable>();
  for (const t of tables) {
    tableByName.set(t.name.toLowerCase(), t);
  }

  for (const table of tables) {
    for (const field of table.fields) {
      const key = `${table.id}.${field.id}`;
      if (fkTargets.has(key)) continue;
      if (!field.references) continue;

      const targetTable = tableByName.get(field.references.table.toLowerCase());
      if (!targetTable) continue;

      const targetField = targetTable.fields.find(
        (f) => f.name.toLowerCase() === field.references!.field.toLowerCase(),
      );
      if (!targetField) continue;

      fkTargets.set(key, {
        targetTableId: targetTable.id,
        targetFieldId: targetField.id,
      });
    }
  }

  return fkTargets;
}

// ── Unique value enforcement ───────────────────────────────────────

/** Wraps a generator to guarantee unique values. Retries on collision. */
function makeUniqueGenerator(
  baseGen: ValueGenerator,
  maxRetries: number = 100,
): ValueGenerator {
  const seen = new Set<string | number | boolean>();
  return (index) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const value = baseGen(index + attempt);
      if (value === null) return null;
      if (!seen.has(value)) {
        seen.add(value);
        return value;
      }
    }
    // Last resort: append index to make it unique
    const fallback = `${baseGen(index)}_${index}`;
    seen.add(fallback);
    return fallback;
  };
}

// ── Main generator ─────────────────────────────────────────────────

export interface GenerateFakeDataOptions {
  /** Number of rows per table (default: 30) */
  rowCount?: number;
  /** Seed for reproducible results (default: 42) */
  seed?: number;
}

/**
 * Generate fake data for all tables in the schema.
 * Uses field names, types, FK relationships, and unique constraints
 * to produce realistic-looking data via @faker-js/faker.
 */
export function generateFakeData(
  tables: DBTable[],
  relationships: DBRelationship[],
  options: GenerateFakeDataOptions = {},
): ParsedDumpTable[] {
  const { rowCount = DEFAULT_ROW_COUNT, seed = 42 } = options;

  // Set deterministic seed for reproducible output
  faker.seed(seed);

  // Skip views and tables with 0 fields
  const filteredTables = tables.filter((t) => !t.isView && t.fields.length > 0);

  // Deduplicate fields with the same name (e.g. TypeORM produces both @ManyToOne
  // and @Column for the same FK column). Prefer the field with FK info.
  const validTables = filteredTables.map((table) => {
    const seen = new Map<string, DBField>();
    for (const field of table.fields) {
      const existing = seen.get(field.name);
      if (!existing) {
        seen.set(field.name, field);
      } else if (field.isForeignKey || field.references) {
        // Prefer the FK-aware field
        seen.set(field.name, field);
      }
    }
    if (seen.size === table.fields.length) return table;
    return { ...table, fields: [...seen.values()] };
  });

  // Build FK lookup from both relationships and field.references
  const fkTargets = buildFKLookup(validTables, relationships);

  // Detect self-referential FK fields
  const selfRefFields = new Set<string>();
  for (const [key, target] of fkTargets) {
    const sourceTableId = key.split(".")[0]!;
    if (sourceTableId === target.targetTableId) {
      selfRefFields.add(key);
    }
  }

  // Generated data per table (for FK lookups): tableId → { fieldId → values[] }
  const generatedValues = new Map<string, Map<string, (string | number | boolean | null)[]>>();

  // Topological sort: generate referenced tables first
  const sortedTables = topologicalSort(validTables, relationships);

  const result: ParsedDumpTable[] = [];

  for (const table of sortedTables) {
    const columns = table.fields.map((f) => f.name);
    const rows: ParsedRow[] = [];
    const tableValues = new Map<string, (string | number | boolean | null)[]>();

    // Initialize early so self-referential FKs can look up already-generated rows
    generatedValues.set(table.id, tableValues);

    // Build generators for each field, respecting unique constraints
    const generators = new Map<string, ValueGenerator>();
    for (const field of table.fields) {
      const baseGen = getFieldGenerator(field);
      if (field.unique && !field.primaryKey) {
        generators.set(field.id, makeUniqueGenerator(baseGen));
      } else {
        generators.set(field.id, baseGen);
      }
    }

    for (let i = 0; i < rowCount; i++) {
      const row: ParsedRow = {};

      for (const field of table.fields) {
        const fkKey = `${table.id}.${field.id}`;
        const fkTarget = fkTargets.get(fkKey);
        const isSelfRef = selfRefFields.has(fkKey);

        let value: string | number | boolean | null;

        if (fkTarget && !field.primaryKey) {
          // FK field — pick from referenced table's already-generated values
          const targetValues = generatedValues.get(fkTarget.targetTableId)?.get(fkTarget.targetFieldId);

          // Filter out nulls — FK must reference a real value
          const nonNullValues = targetValues?.filter((v): v is string | number | boolean => v !== null);

          if (nonNullValues && nonNullValues.length > 0) {
            // For self-refs: first row has no parent, then ~20% chance of null
            if (isSelfRef && (i === 0 || faker.number.float({ min: 0, max: 1 }) < 0.2)) {
              value = null;
            } else {
              value = faker.helpers.arrayElement(nonNullValues);
            }
          } else {
            value = generators.get(field.id)!(i);
          }
        } else if (field.primaryKey) {
          // PK — sequential ints or UUIDs
          if (isUuidType(field.type)) {
            value = faker.string.uuid();
          } else {
            value = i + 1;
          }
        } else {
          value = generators.get(field.id)!(i);
        }

        // Nullable handling: ~10% null for regular fields, ~5% for FK fields
        if (field.nullable && !field.primaryKey && !isSelfRef) {
          if (fkTarget && faker.number.float({ min: 0, max: 1 }) < 0.05) {
            value = null;
          } else if (!fkTarget && faker.number.float({ min: 0, max: 1 }) < 0.1) {
            value = null;
          }
        }

        row[field.name] = value;

        // Store for FK references (including self-refs — grows incrementally)
        if (!tableValues.has(field.id)) {
          tableValues.set(field.id, []);
        }
        tableValues.get(field.id)!.push(value);
      }

      rows.push(row);
    }

    result.push({ name: table.name, columns, rows });
  }

  return result;
}

/**
 * Topological sort: tables with no FK dependencies first,
 * so referenced data exists when we generate FK values.
 */
function topologicalSort(tables: DBTable[], relationships: DBRelationship[]): DBTable[] {
  const tableMap = new Map(tables.map((t) => [t.id, t]));
  const deps = new Map<string, Set<string>>();

  for (const t of tables) {
    deps.set(t.id, new Set());
  }

  for (const rel of relationships) {
    // Skip self-references to avoid false cycles
    if (
      rel.sourceTableId !== rel.targetTableId &&
      deps.has(rel.sourceTableId) &&
      tableMap.has(rel.targetTableId)
    ) {
      deps.get(rel.sourceTableId)!.add(rel.targetTableId);
    }
  }

  const sorted: DBTable[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) return; // Circular dependency — break cycle
    visiting.add(id);

    for (const depId of deps.get(id) ?? []) {
      visit(depId);
    }

    visiting.delete(id);
    visited.add(id);
    const t = tableMap.get(id);
    if (t) sorted.push(t);
  }

  for (const t of tables) {
    visit(t.id);
  }

  return sorted;
}
