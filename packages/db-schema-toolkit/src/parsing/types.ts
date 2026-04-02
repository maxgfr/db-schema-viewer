import type { Cardinality } from "../domain";

/** Intermediate column representation shared by all parsers. */
export interface ParsedColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  unique: boolean;
  nullable: boolean;
  default?: string;
  comment?: string;
  references?: {
    table: string;
    column: string;
  };
}

/** Intermediate index representation shared by all parsers. */
export interface ParsedIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

/** Intermediate table representation shared by all parsers. */
export interface ParsedTable {
  name: string;
  schema?: string;
  columns: ParsedColumn[];
  indexes: ParsedIndex[];
  isView: boolean;
  comment?: string;
}

/** Intermediate relationship representation shared by all parsers. */
export interface ParsedRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  /** If set, overrides the default uniqueness-based inference. */
  cardinality?: Cardinality;
  /** When true, this is an ORM-level relation (e.g. Drizzle `relations()`),
   *  not a DB-level FK constraint. The source field should NOT be marked as FK. */
  isOrmOnly?: boolean;
}

/** The result of any parser's first pass (before building the Diagram). */
export interface ParseResult {
  tables: ParsedTable[];
  relationships: ParsedRelationship[];
}
