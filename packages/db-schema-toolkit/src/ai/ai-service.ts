import { streamText, generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { AISettings } from "./types";
import type { Diagram } from "../domain";
import type { ParsedDumpTable } from "../dump/dump-parser";
import { inferColumnTypes } from "../dump/data-types";
import { schemaToPromptContext } from "./ai-prompts";

export const SchemaIssue = z.object({
  severity: z.enum(["info", "warning", "critical"]),
  category: z.enum([
    "naming",
    "normalization",
    "indexing",
    "relationships",
    "types",
    "performance",
    "security",
    "general",
  ]),
  table: z.string().optional(),
  field: z.string().optional(),
  description: z.string(),
  suggestion: z.string(),
});
export type SchemaIssue = z.infer<typeof SchemaIssue>;

const ChallengeResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  issues: z.array(SchemaIssue),
});
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;

async function getModel(settings: AISettings): Promise<LanguageModel> {
  const modelName = settings.customModel ?? settings.model;

  if (settings.customEndpoint) {
    // Custom/local endpoints (Ollama, LM Studio) only support Chat Completions API,
    // not the OpenAI Responses API — use .chat() explicitly.
    const { createOpenAI } = await import("@ai-sdk/openai");
    const openai = createOpenAI({
      apiKey: settings.apiKey || "",
      baseURL: settings.customEndpoint,
    });
    return openai.chat(modelName);
  }

  switch (settings.providerNpm) {
    case "@ai-sdk/anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({
        apiKey: settings.apiKey,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      });
      return anthropic(modelName);
    }
    case "@ai-sdk/google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({ apiKey: settings.apiKey });
      return google(modelName);
    }
    case "@ai-sdk/mistral": {
      const { createMistral } = await import("@ai-sdk/mistral");
      const mistral = createMistral({ apiKey: settings.apiKey });
      return mistral(modelName);
    }
    default: {
      const { createOpenAI } = await import("@ai-sdk/openai");
      // Other OpenAI-compatible providers may not support the Responses API,
      // so use .chat() (Chat Completions) which is universally supported.
      const openai = createOpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.providerApi,
      });
      return openai.chat(modelName);
    }
  }
}

function languageInstruction(settings: AISettings): string {
  const lang = settings.language ?? "English";
  return `IMPORTANT: Always respond in ${lang}.`;
}

export async function querySchema(
  settings: AISettings,
  diagram: Diagram,
  question: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullText: string) => void,
  history: Array<{ prompt: string; response: string }> = [],
  abortSignal?: AbortSignal
): Promise<void> {
  const model = await getModel(settings);
  const schemaContext = schemaToPromptContext(diagram);

  const historyText = history
    .map((h) => `User: ${h.prompt}\nAssistant: ${h.response}`)
    .join("\n\n");

  const result = streamText({
    model,
    system: `You are a database schema expert. Analyze the following database schema and answer questions about it.
${languageInstruction(settings)}

DATABASE SCHEMA:
${schemaContext}`,
    prompt: `${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}User question: ${question}`,
    temperature: 0.5,
    abortSignal,
  });

  let fullText = "";
  for await (const textPart of result.textStream) {
    abortSignal?.throwIfAborted();
    fullText += textPart;
    onChunk(textPart);
  }
  abortSignal?.throwIfAborted();
  onComplete(fullText);
}

/* ---------- Chart suggestion schemas ---------- */

const ChartSuggestionSchema = z.object({
  type: z.enum(["bar", "line", "pie", "scatter", "area"]),
  title: z.string(),
  description: z.string(),
  xColumn: z.string(),
  yColumn: z.string(),
  aggregation: z.enum(["sum", "avg", "count", "min", "max", "none"]),
  reasoning: z.string(),
});

const ChartSuggestionsResponseSchema = z.object({
  suggestions: z.array(ChartSuggestionSchema),
});

const SingleChartResponseSchema = z.object({
  chart: ChartSuggestionSchema.nullable(),
});

export type ChartSuggestion = z.infer<typeof ChartSuggestionSchema>;

function summarizeTable(table: ParsedDumpTable, columnTypes: Record<string, string>): string {
  const lines: string[] = [];
  lines.push(`Table: ${table.name}`);
  lines.push(`Rows: ${table.rows.length}`);
  lines.push(`Columns (${table.columns.length}):`);

  for (const col of table.columns) {
    const type = columnTypes[col] ?? "unknown";
    const values = table.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
    const uniqueCount = new Set(values.map(String)).size;

    if (type === "number") {
      const nums = values.filter((v): v is number => typeof v === "number");
      if (nums.length > 0) {
        const min = nums.reduce((a, b) => Math.min(a, b), Infinity);
        const max = nums.reduce((a, b) => Math.max(a, b), -Infinity);
        const avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
        lines.push(`  - ${col} (${type}): ${uniqueCount} unique, min=${min}, max=${max}, avg=${avg}`);
      } else {
        lines.push(`  - ${col} (${type}): ${uniqueCount} unique values`);
      }
    } else {
      const sample = values.slice(0, 5).map(String);
      lines.push(`  - ${col} (${type}): ${uniqueCount} unique, sample: [${sample.join(", ")}]`);
    }
  }

  // Sample rows
  lines.push(`\nSample data (first 5 rows):`);
  for (const row of table.rows.slice(0, 5)) {
    const vals = table.columns.map((c) => `${c}=${row[c] ?? "NULL"}`);
    lines.push(`  { ${vals.join(", ")} }`);
  }

  return lines.join("\n");
}

const CHART_SYSTEM_PROMPT = `You are a data visualization expert. Analyze the provided dataset and suggest insightful charts.

RULES:
- xColumn and yColumn MUST be exact column names from the dataset (case-sensitive).
- Use categorical/text columns for X-axis and numeric columns for Y-axis.
- For pie charts, use aggregation "sum" or "count" to group values.
- For scatter plots, use aggregation "none" to show raw data points.
- For time-based data, prefer line or area charts.
- Each suggestion should reveal a different insight about the data.
- Provide 2-4 suggestions, prioritizing the most useful visualizations.

CHART TYPES:
- bar: Compare categories against numeric values
- line: Show trends over time or ordered sequences
- pie: Show proportional distribution (best with <10 categories)
- scatter: Show correlation between two numeric values
- area: Show cumulative trends over time`;

export async function suggestCharts(
  settings: AISettings,
  table: ParsedDumpTable,
  columnTypes: Record<string, string>,
  abortSignal?: AbortSignal,
): Promise<ChartSuggestion[]> {
  const model = await getModel(settings);
  const summary = summarizeTable(table, columnTypes);

  abortSignal?.throwIfAborted();
  const { object } = await generateObject({
    model,
    abortSignal,
    schema: ChartSuggestionsResponseSchema,
    system: CHART_SYSTEM_PROMPT,
    prompt: `Analyze this dataset and suggest 2-4 insightful charts:\n\n${summary}`,
    temperature: 0.5,
  });

  abortSignal?.throwIfAborted();
  // Validate that suggested columns actually exist
  return object.suggestions.filter(
    (s) => table.columns.includes(s.xColumn) && table.columns.includes(s.yColumn)
  );
}

export async function generateCustomChart(
  settings: AISettings,
  table: ParsedDumpTable,
  columnTypes: Record<string, string>,
  userPrompt: string,
  abortSignal?: AbortSignal,
): Promise<ChartSuggestion | null> {
  const model = await getModel(settings);
  const summary = summarizeTable(table, columnTypes);

  abortSignal?.throwIfAborted();
  const { object } = await generateObject({
    model,
    abortSignal,
    schema: SingleChartResponseSchema,
    system: CHART_SYSTEM_PROMPT,
    prompt: `User request: "${userPrompt}"\n\nDataset:\n${summary}\n\nCreate a single chart matching the user's request. If the request is impossible with the available data, set chart to null.`,
    temperature: 0.5,
  });

  abortSignal?.throwIfAborted();
  if (!object.chart) return null;

  abortSignal?.throwIfAborted();
  // Validate columns exist
  if (!table.columns.includes(object.chart.xColumn) || !table.columns.includes(object.chart.yColumn)) {
    return null;
  }

  return object.chart;
}

export async function queryData(
  settings: AISettings,
  tables: ParsedDumpTable[],
  question: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullText: string) => void,
  history: Array<{ prompt: string; response: string }> = [],
  abortSignal?: AbortSignal
): Promise<void> {
  const model = await getModel(settings);

  const tableSummaries = tables.map((table) => {
    const columnTypes = inferColumnTypes(table.columns, table.rows);
    const summary = summarizeTable(table, columnTypes);
    const rowsToShow = Math.max(5, Math.floor(30 / tables.length));
    const dataRows = table.rows.slice(0, rowsToShow).map((row) =>
      table.columns.map((c) => `${c}=${row[c] ?? "NULL"}`).join(", ")
    );
    return `${summary}\n\nData rows (first ${Math.min(rowsToShow, table.rows.length)} of ${table.rows.length}):\n${dataRows.map((r, i) => `  ${i + 1}. { ${r} }`).join("\n")}`;
  });

  const dataContext = tables.length === 1
    ? tableSummaries[0]!
    : `${tables.length} TABLES IN DATASET:\n\n${tableSummaries.join("\n\n---\n\n")}`;

  const historyText = history
    .map((h) => `User: ${h.prompt}\nAssistant: ${h.response}`)
    .join("\n\n");

  const systemPrompt = tables.length === 1
    ? `You are a data analyst expert. Analyze the following dataset and answer questions about it. Provide insights, patterns, anomalies, and recommendations based on the data. Be concise and specific, referencing actual values from the data.`
    : `You are a data analyst expert. Analyze the following multi-table dataset and answer questions about it. You can identify cross-table patterns, relationships, and provide insights that span multiple tables. Be concise and specific, referencing actual values from the data.`;

  const result = streamText({
    model,
    system: `${systemPrompt}
${languageInstruction(settings)}

DATASET:
${dataContext}`,
    prompt: `${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}User question: ${question}`,
    temperature: 0.5,
    abortSignal,
  });

  let fullText = "";
  for await (const textPart of result.textStream) {
    abortSignal?.throwIfAborted();
    fullText += textPart;
    onChunk(textPart);
  }
  abortSignal?.throwIfAborted();
  onComplete(fullText);
}

export async function challengeSchema(
  settings: AISettings,
  diagram: Diagram,
  abortSignal?: AbortSignal,
): Promise<ChallengeResponse> {
  const model = await getModel(settings);
  const schemaContext = schemaToPromptContext(diagram);

  abortSignal?.throwIfAborted();
  const { object } = await generateObject({
    model,
    abortSignal,
    schema: ChallengeResponseSchema,
    system: `You are a senior database architect performing a thorough review of a database schema. Be constructive but honest. Look for issues in naming conventions, normalization, missing indexes, relationship design, type choices, performance concerns, and security considerations.
${languageInstruction(settings)}`,
    prompt: `Review this database schema and provide detailed feedback:\n\n${schemaContext}`,
    temperature: 0.5,
  });

  abortSignal?.throwIfAborted();
  return object;
}
