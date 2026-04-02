import type { DatabaseType } from "../domain";

interface DetectionRule {
  type: DatabaseType;
  patterns: RegExp[];
  weight: number;
}

const DETECTION_RULES: DetectionRule[] = [
  // Supabase-specific (must be before PG since it's a PG variant)
  {
    type: "supabase",
    patterns: [
      /\bsupabase\b/i,
      /\bauth\.users\b/i,
      /\bstorage\.buckets\b/i,
      /\brealtime\b/i,
      /\bpgsodium\b/i,
      /\bextensions\b.*\bcreate\s+extension\b/i,
    ],
    weight: 3,
  },
  // CockroachDB-specific
  {
    type: "cockroachdb",
    patterns: [
      /\bCOCKROACH\b/i,
      /\bINTERLEAVE\s+IN\s+PARENT\b/i,
      /\bCREATE\s+CHANGEFEED\b/i,
      /\bcrdb_internal\b/i,
    ],
    weight: 3,
  },
  // ClickHouse
  {
    type: "clickhouse",
    patterns: [
      /\bENGINE\s*=\s*(MergeTree|ReplacingMergeTree|SummingMergeTree|AggregatingMergeTree|CollapsingMergeTree|VersionedCollapsingMergeTree|Log|TinyLog|Memory|Buffer|Distributed|Kafka)/i,
      /\bORDER\s+BY\s+\(/i,
      /\bPARTITION\s+BY\b/i,
      /\bUInt(?:8|16|32|64|128|256)\b/,
      /\bInt(?:8|16|32|64|128|256)\b/,
      /\bFloat(?:32|64)\b/,
      /\bFixedString\b/,
      /\bLowCardinality\b/,
      /\bNullable\s*\(/,
    ],
    weight: 2,
  },
  // BigQuery
  {
    type: "bigquery",
    patterns: [
      /\bSTRUCT\s*</i,
      /\bARRAY\s*</i,
      /\bBIGQUERY\b/i,
      /\bINT64\b/,
      /\bFLOAT64\b/,
      /\bBOOL\b/,
      /\bSTRING\b(?!\s*\()/,
      /\bBYTES\b/,
      /\bGEOGRAPHY\b/,
      /\bPARTITION\s+BY\s+_PARTITIONDATE\b/i,
      /\bCLUSTER\s+BY\b/i,
    ],
    weight: 2,
  },
  // Snowflake
  {
    type: "snowflake",
    patterns: [
      /\bSNOWFLAKE\b/i,
      /\bVARIANT\b/,
      /\bOBJECT\b(?!\s+REFERENCES)/,
      /\bCLUSTER\s+BY\s+\(/i,
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?STAGE\b/i,
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?PIPE\b/i,
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?STREAM\b/i,
      /\bNUMBER\s*\(\d+,\s*\d+\)/,
    ],
    weight: 2,
  },
  // PostgreSQL
  {
    type: "postgresql",
    patterns: [
      /\bSERIAL\b/i,
      /\bBIGSERIAL\b/i,
      /\bSMALLSERIAL\b/i,
      /\bUUID\b/i,
      /\bJSONB\b/i,
      /\b::/,
      /\bCREATE\s+TYPE\b/i,
      /\bCREATE\s+EXTENSION\b/i,
      /\bTEXT\[\]/i,
      /\bINTEGER\[\]/i,
      /\bBOOLEAN\b/i,
      /\bTIMESTAMPTZ\b/i,
      /\bBYTEA\b/i,
      /\bSET\s+search_path\b/i,
      /\bpg_catalog\b/i,
    ],
    weight: 1,
  },
  // MySQL
  {
    type: "mysql",
    patterns: [
      /\bAUTO_INCREMENT\b/i,
      /\bENGINE\s*=\s*InnoDB\b/i,
      /\bENGINE\s*=\s*MyISAM\b/i,
      /\bDEFAULT\s+CHARSET\b/i,
      /\bCOLLATE\b/i,
      /\bUNSIGNED\b/i,
      /\bTINYINT\b/i,
      /\bMEDIUMINT\b/i,
      /\bMEDIUMTEXT\b/i,
      /\bLONGTEXT\b/i,
      /\bENUM\s*\(/i,
      /`\w+`/,
    ],
    weight: 1,
  },
  // MariaDB
  {
    type: "mariadb",
    patterns: [
      /\bMariaDB\b/i,
      /\bENGINE\s*=\s*Aria\b/i,
      /\bENGINE\s*=\s*ColumnStore\b/i,
      /\bSYSTEM\s+VERSIONING\b/i,
    ],
    weight: 3,
  },
  // SQLite
  {
    type: "sqlite",
    patterns: [
      /\bAUTOINCREMENT\b/i,
      /\bINTEGER\s+PRIMARY\s+KEY\b/i,
      /\bPRAGMA\b/i,
      /\bWITHOUT\s+ROWID\b/i,
      /\bSQLITE\b/i,
    ],
    weight: 2,
  },
];

export function detectDatabaseType(sql: string): DatabaseType {
  const scores: Partial<Record<DatabaseType, number>> = {};

  for (const rule of DETECTION_RULES) {
    let matchCount = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(sql)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      scores[rule.type] = (scores[rule.type] ?? 0) + matchCount * rule.weight;
    }
  }

  let bestType: DatabaseType = "generic";
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type as DatabaseType;
    }
  }

  return bestType;
}
