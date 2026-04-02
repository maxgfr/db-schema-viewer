export type { AISettings } from "./ai/types";
export {
  querySchema,
  challengeSchema,
  suggestCharts,
  generateCustomChart,
  queryData,
  SchemaIssue,
} from "./ai/ai-service";
export type { ChallengeResponse, ChartSuggestion } from "./ai/ai-service";
export { schemaToPromptContext } from "./ai/ai-prompts";
