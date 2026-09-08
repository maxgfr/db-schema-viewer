import { beforeEach, expect, it, vi } from "vitest";
import { generateObject, streamText } from "ai";
import { querySchema, queryData, suggestCharts, generateCustomChart, challengeSchema } from "../../src/ai/ai-service";
import type { Diagram } from "../../src/domain";
vi.mock("ai", () => ({ generateObject: vi.fn(), streamText: vi.fn() }));
const settings = { apiKey: "test-key", model: "test", providerId: "openai" };
const diagram: Diagram = { id: "d", name: "Schema", databaseType: "postgresql", tables: [], relationships: [], createdAt: "2026-01-01" };
beforeEach(() => vi.resetAllMocks());
it("streams schema answers and completes exactly once", async () => {
  vi.mocked(streamText).mockReturnValue({ textStream: (async function* () { yield "Hello"; yield " world"; })() } as any);
  const chunk = vi.fn(), complete = vi.fn();
  await querySchema(settings, diagram, "Explain", chunk, complete);
  expect(chunk.mock.calls).toEqual([["Hello"], [" world"]]);
  expect(complete).toHaveBeenCalledExactlyOnceWith("Hello world");
});
it("propagates provider failures without completing successfully", async () => {
  vi.mocked(streamText).mockReturnValue({ textStream: (async function* () { yield "Partial"; throw new Error("Provider unavailable"); })() } as any);
  const complete = vi.fn();
  await expect(queryData(settings, [], "Explain", vi.fn(), complete)).rejects.toThrow("Provider unavailable");
  expect(complete).not.toHaveBeenCalled();
});
it("does not complete an aborted stream even if the provider keeps yielding", async () => {
  const controller = new AbortController();
  vi.mocked(streamText).mockReturnValue({ textStream: (async function* () { yield "First"; controller.abort(); yield "Late"; })() } as any);
  const chunk = vi.fn(), complete = vi.fn();
  await expect(querySchema(settings, diagram, "Explain", chunk, complete, [], controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(chunk).toHaveBeenCalledExactlyOnceWith("First");
  expect(complete).not.toHaveBeenCalled();
});
it("summarizes dumps with 200,000 numeric rows without overflowing the call stack", async () => {
  vi.mocked(generateObject).mockResolvedValue({ object: { suggestions: [] } } as any);
  await expect(suggestCharts(settings, { name: "values", columns: ["value"], rows: Array.from({ length: 200_000 }, (_, i) => ({ value: i })) }, { value: "number" })).resolves.toEqual([]);
});
it("filters chart suggestions and custom charts with nonexistent columns", async () => {
  const chart = { type: "bar", xColumn: "x", yColumn: "missing", title: "Invalid", description: "", aggregation: "sum", reasoning: "" };
  const table = { name: "t", columns: ["x"], rows: [{ x: 1 }] };
  vi.mocked(generateObject).mockResolvedValueOnce({ object: { suggestions: [chart] } } as any);
  expect(await suggestCharts(settings, table, { x: "number" })).toEqual([]);
  vi.mocked(generateObject).mockResolvedValueOnce({ object: { chart } } as any);
  expect(await generateCustomChart(settings, table, { x: "number" }, "Chart")).toBeNull();
});
it("returns a structured challenge", async () => {
  const result = { overallScore: 90, summary: "Good", issues: [] };
  vi.mocked(generateObject).mockResolvedValue({ object: result } as any);
  expect(await challengeSchema(settings, diagram)).toEqual(result);
});
