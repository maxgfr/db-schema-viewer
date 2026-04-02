export {
  analyzeSchema,
  computeMetrics,
  detectAntiPatterns,
  computeQualityScore,
} from "./analysis/schema-analyzer";
export type {
  SchemaMetrics,
  AntiPattern,
  QualityScore,
  SchemaAnalysis,
} from "./analysis/schema-analyzer";

export { diffSchemas } from "./analysis/schema-diff";
export type {
  SchemaDiff,
  TableDiff,
  FieldDiff,
  RelationshipChange,
} from "./analysis/schema-diff";
