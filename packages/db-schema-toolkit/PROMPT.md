# db-schema-toolkit — AI Assistant Prompt

Use this prompt to give an AI assistant (Claude, GPT, Copilot, etc.) context about the `db-schema-toolkit` CLI. Paste it into your system prompt, CLAUDE.md, .cursorrules, or copilot-instructions.md.

---

## Prompt

You have access to the `db-schema-toolkit` CLI via `npx db-schema-toolkit` (or `db-schema-toolkit` if installed globally). Use it to work with database schemas.

### What it does

Parses database schema files (SQL, Drizzle, Prisma, DBML, TypeORM, MikroORM, Sequelize, Kysely) and can export them to other formats, analyze quality, or diff two versions.

### Commands

```
db-schema-toolkit export <file> -f <format> [-o <output>] [-d <db-type>]
db-schema-toolkit analyze <file> [--json] [--fail-under <score>]
db-schema-toolkit diff <file1> <file2> [--json]
db-schema-toolkit parse <file>
db-schema-toolkit info <file> [--json]
db-schema-toolkit generate <file> [--rows <n>] [--seed <n>]
db-schema-toolkit share <file>
```

Use `-` as filename to read from stdin (with `--filename` to hint format detection).

### Export formats

`markdown`, `mermaid`, `sql`, `prisma`, `drizzle`, `dbml`, `plantuml`, `json`

### DB types (for `-f sql`)

`postgresql`, `mysql`, `mariadb`, `sqlite`, `supabase`, `cockroachdb`, `clickhouse`, `bigquery`, `snowflake`

### Common tasks

```bash
# Generate Markdown docs from a Drizzle schema
npx db-schema-toolkit export src/db/schema.ts -f markdown -o docs/schema.md

# Generate a Mermaid diagram from a Prisma schema
npx db-schema-toolkit export prisma/schema.prisma -f mermaid

# Convert SQL to Drizzle ORM
npx db-schema-toolkit export schema.sql -f drizzle -o schema.ts

# Get a quality score
npx db-schema-toolkit analyze schema.sql --json | jq '.qualityScore.overall'

# Quality gate in CI (exit 1 if score < 70)
npx db-schema-toolkit analyze schema.sql --fail-under 70

# Generate fake data
npx db-schema-toolkit generate schema.sql --rows 50

# Get a shareable link
npx db-schema-toolkit share schema.prisma

# Read from stdin
cat schema.sql | npx db-schema-toolkit parse -

# Compare two versions of a schema
npx db-schema-toolkit diff old.sql new.sql

# Get the full parsed schema as JSON for processing
npx db-schema-toolkit parse schema.ts | jq '.tables[] | {name, fields: [.fields[].name]}'
```

### Format auto-detection

The input format is detected automatically:
- `.sql` → SQL (dialect auto-detected from content)
- `.prisma` → Prisma
- `.dbml` → DBML
- `.ts` with `drizzle-orm` imports → Drizzle
- `.ts` with `@Entity` → TypeORM
- `.ts` with `@mikro-orm` → MikroORM
- `.ts`/`.js` with `sequelize.define` → Sequelize
- `.ts` with `kysely` → Kysely

### Output to stdout or file

All commands output to stdout by default. Use `-o <file>` to write to a file. Errors and status messages go to stderr, so piping works correctly:

```bash
db-schema-toolkit export schema.sql -f json | jq '.tables[].name'
db-schema-toolkit analyze schema.sql --json | jq '.antiPatterns[] | select(.severity == "critical")'
```

### In GitHub Actions

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Generate schema docs
    run: npx db-schema-toolkit export src/db/schema.ts -f markdown -o docs/DATABASE.md

  - name: Quality gate
    run: npx db-schema-toolkit analyze src/db/schema.ts --fail-under 70

  - name: Commit updated docs
    run: |
      git diff --quiet docs/ || {
        git add docs/DATABASE.md
        git commit -m "docs: update database schema documentation"
        git push
      }
```

### JSON output structure

When using `--json` or `-f json`, the output follows these structures:

**`parse` / `export -f json`** → `Diagram` object:
```json
{
  "id": "string",
  "name": "string",
  "databaseType": "postgresql|mysql|sqlite|...",
  "tables": [
    {
      "id": "string",
      "name": "string",
      "fields": [
        {
          "id": "string",
          "name": "string",
          "type": "string",
          "primaryKey": true,
          "nullable": false,
          "unique": false,
          "isForeignKey": false
        }
      ]
    }
  ],
  "relationships": [
    {
      "id": "string",
      "sourceTableId": "string",
      "sourceFieldId": "string",
      "targetTableId": "string",
      "targetFieldId": "string",
      "cardinality": "one-to-one|one-to-many|many-to-many"
    }
  ]
}
```

**`analyze --json`** → Analysis object:
```json
{
  "metrics": {
    "tableCount": 0,
    "fieldCount": 0,
    "relationshipCount": 0,
    "avgFieldsPerTable": 0,
    "relationalDensity": 0,
    "orphanTables": []
  },
  "antiPatterns": [
    {
      "type": "string",
      "severity": "critical|warning|info",
      "description": "string",
      "suggestion": "string",
      "table": "string",
      "field": "string"
    }
  ],
  "qualityScore": {
    "overall": 0,
    "naming": 0,
    "normalization": 0,
    "relationships": 0,
    "indexing": 0
  }
}
```

**`diff --json`** → Diff object:
```json
{
  "addedTables": ["string"],
  "removedTables": ["string"],
  "modifiedTables": [
    {
      "tableName": "string",
      "addedFields": ["string"],
      "removedFields": ["string"],
      "modifiedFields": [
        {
          "fieldName": "string",
          "changes": [{ "property": "string", "oldValue": "string", "newValue": "string" }]
        }
      ]
    }
  ],
  "summary": "string"
}
```
