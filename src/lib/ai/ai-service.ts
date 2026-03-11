import { streamText, generateObject, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { z } from "zod";
import type { AISettings } from "@/lib/storage/cookie-storage";
import type { Diagram } from "@/lib/domain";
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

function getModel(settings: AISettings): LanguageModel {
  const modelName = settings.customModel ?? settings.model;

  if (settings.customEndpoint) {
    const openai = createOpenAI({
      apiKey: settings.apiKey || "",
      baseURL: settings.customEndpoint,
    }) as unknown as (model: string) => LanguageModel;
    return openai(modelName);
  }

  switch (settings.providerNpm) {
    case "@ai-sdk/anthropic": {
      const anthropic = createAnthropic({
        apiKey: settings.apiKey,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      });
      return anthropic(modelName);
    }
    case "@ai-sdk/google": {
      const google = createGoogleGenerativeAI({ apiKey: settings.apiKey });
      return google(modelName);
    }
    case "@ai-sdk/mistral": {
      const mistral = createMistral({ apiKey: settings.apiKey });
      return mistral(modelName);
    }
    default: {
      const openai = createOpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.providerApi,
      }) as unknown as (model: string) => LanguageModel;
      return openai(modelName);
    }
  }
}

export async function querySchema(
  settings: AISettings,
  diagram: Diagram,
  question: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullText: string) => void,
  history: Array<{ prompt: string; response: string }> = []
): Promise<void> {
  const model = getModel(settings);
  const schemaContext = schemaToPromptContext(diagram);

  const historyText = history
    .map((h) => `User: ${h.prompt}\nAssistant: ${h.response}`)
    .join("\n\n");

  const result = streamText({
    model,
    system: `You are a database schema expert. Analyze the following database schema and answer questions about it.

DATABASE SCHEMA:
${schemaContext}`,
    prompt: `${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}User question: ${question}`,
    temperature: 0.5,
  });

  let fullText = "";
  for await (const textPart of result.textStream) {
    fullText += textPart;
    onChunk(textPart);
  }
  onComplete(fullText);
}

export async function challengeSchema(
  settings: AISettings,
  diagram: Diagram
): Promise<ChallengeResponse> {
  const model = getModel(settings);
  const schemaContext = schemaToPromptContext(diagram);

  const { object } = await generateObject({
    model,
    schema: ChallengeResponseSchema,
    system: `You are a senior database architect performing a thorough review of a database schema. Be constructive but honest. Look for issues in naming conventions, normalization, missing indexes, relationship design, type choices, performance concerns, and security considerations.`,
    prompt: `Review this database schema and provide detailed feedback:\n\n${schemaContext}`,
    temperature: 0.5,
  });

  return object;
}
