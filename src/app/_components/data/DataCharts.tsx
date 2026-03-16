"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Download, Sparkles, Loader2, Send, X, BarChart3, TrendingUp, PieChart as PieChartIcon, ScatterChart as ScatterIcon, AreaChart as AreaIcon, RotateCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
} from "recharts";
import type { ParsedDumpTable } from "@/lib/dump/dump-parser";
import { inferColumnTypes } from "@/lib/dump/data-types";
import { loadAISettings } from "@/lib/storage/cookie-storage";
import {
  suggestCharts,
  generateCustomChart,
  type ChartSuggestion,
} from "@/lib/ai/ai-service";

interface DataChartsProps {
  table: ParsedDumpTable;
}

type ChartType = "bar" | "line" | "pie" | "scatter" | "area";
type Aggregation = "sum" | "avg" | "count" | "min" | "max" | "none";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
];

const CHART_TYPE_ICONS: Record<ChartType, typeof BarChart3> = {
  bar: BarChart3,
  line: TrendingUp,
  pie: PieChartIcon,
  scatter: ScatterIcon,
  area: AreaIcon,
};

function useThemeColors() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsLight(document.documentElement.classList.contains("light"));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return {
    grid: isLight ? "#d1d5db" : "#334155",
    axis: isLight ? "#4b5563" : "#94a3b8",
    tooltipBg: isLight ? "#ffffff" : "#1e293b",
    tooltipBorder: isLight ? "#d1d5db" : "#334155",
    tooltipLabel: isLight ? "#111827" : "#f8fafc",
  };
}

/* ---------- Chart data processing ---------- */

function processChartData(
  table: ParsedDumpTable,
  xCol: string,
  yCol: string,
  aggregation: Aggregation,
): Array<{ x: string; y: number }> {
  if (!xCol || !yCol) return [];

  if (aggregation === "none") {
    return table.rows.map((row) => ({
      x: String(row[xCol] ?? ""),
      y: typeof row[yCol] === "number" ? row[yCol] : Number(row[yCol]) || 0,
    }));
  }

  const groups = new Map<string, number[]>();
  for (const row of table.rows) {
    const key = String(row[xCol] ?? "");
    const val = typeof row[yCol] === "number" ? row[yCol] : Number(row[yCol]) || 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(val);
  }

  return Array.from(groups.entries()).map(([key, vals]) => {
    let y: number;
    switch (aggregation) {
      case "sum": y = vals.reduce((a, b) => a + b, 0); break;
      case "avg": y = vals.reduce((a, b) => a + b, 0) / vals.length; break;
      case "count": y = vals.length; break;
      case "min": y = Math.min(...vals); break;
      case "max": y = Math.max(...vals); break;
      default: y = vals[0] ?? 0;
    }
    return { x: key, y: Math.round(y * 100) / 100 };
  });
}

/* ---------- Single chart renderer ---------- */

function ChartRenderer({
  data,
  chartType,
  theme,
}: {
  data: Array<{ x: string; y: number }>;
  chartType: ChartType;
  theme: ReturnType<typeof useThemeColors>;
}) {
  const tooltipStyle = {
    backgroundColor: theme.tooltipBg,
    border: `1px solid ${theme.tooltipBorder}`,
    borderRadius: "8px",
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {chartType === "bar" ? (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis dataKey="x" stroke={theme.axis} tick={{ fontSize: 11 }} />
          <YAxis stroke={theme.axis} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: theme.tooltipLabel }} />
          <Bar dataKey="y" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      ) : chartType === "line" ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis dataKey="x" stroke={theme.axis} tick={{ fontSize: 11 }} />
          <YAxis stroke={theme.axis} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1" }} />
        </LineChart>
      ) : chartType === "pie" ? (
        <PieChart>
          <Pie data={data} dataKey="y" nameKey="x" cx="50%" cy="50%" outerRadius={80} label>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      ) : chartType === "scatter" ? (
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis dataKey="x" stroke={theme.axis} tick={{ fontSize: 11 }} />
          <YAxis dataKey="y" stroke={theme.axis} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Scatter data={data} fill="#6366f1" />
        </ScatterChart>
      ) : (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis dataKey="x" stroke={theme.axis} tick={{ fontSize: 11 }} />
          <YAxis stroke={theme.axis} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="y" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

/* ---------- Main component ---------- */

export function DataCharts({ table }: DataChartsProps) {
  const theme = useThemeColors();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const columnTypes = useMemo(
    () => inferColumnTypes(table.columns, table.rows),
    [table]
  );

  const numericCols = table.columns.filter((c) => columnTypes[c] === "number");
  const categoryCols = table.columns.filter((c) => columnTypes[c] !== "number");

  // Manual chart state
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xCol, setXCol] = useState(categoryCols[0] ?? table.columns[0] ?? "");
  const [yCol, setYCol] = useState(numericCols[0] ?? table.columns[1] ?? "");
  const [aggregation, setAggregation] = useState<Aggregation>("sum");

  // AI state
  const [aiSuggestions, setAiSuggestions] = useState<ChartSuggestion[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");

  // Reset column selections when table changes (keep chartType & aggregation)
  const [prevTableName, setPrevTableName] = useState(table.name);
  if (prevTableName !== table.name) {
    setPrevTableName(table.name);
    setXCol(categoryCols[0] ?? table.columns[0] ?? "");
    setYCol(numericCols[0] ?? table.columns[1] ?? "");
    setAiSuggestions([]);
  }

  const manualChartData = useMemo(
    () => processChartData(table, xCol, yCol, aggregation),
    [table, xCol, yCol, aggregation]
  );

  const handleExportPNG = useCallback(async () => {
    const el = chartContainerRef.current;
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `chart-${table.name}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Chart exported as PNG");
    } catch {
      toast.error("Failed to export chart");
    }
  }, [table.name]);

  const handleSuggestCharts = useCallback(async () => {
    const settings = loadAISettings();
    if (!settings || (!settings.apiKey && !settings.customEndpoint)) {
      toast.error("No AI configured", {
        description: "Go to Settings to configure an API key or a local endpoint.",
      });
      return;
    }

    setIsLoadingAI(true);
    try {
      const suggestions = await suggestCharts(settings, table, columnTypes);
      if (suggestions.length === 0) {
        toast.warning("No chart suggestions generated for this dataset.");
      } else {
        setAiSuggestions(suggestions);
        toast.success(`${suggestions.length} chart suggestions generated`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally {
      setIsLoadingAI(false);
    }
  }, [table, columnTypes]);

  const handleCustomChart = useCallback(async () => {
    if (!customPrompt.trim()) return;

    const settings = loadAISettings();
    if (!settings || (!settings.apiKey && !settings.customEndpoint)) {
      toast.error("No AI configured", {
        description: "Go to Settings to configure an API key or a local endpoint.",
      });
      return;
    }

    setIsLoadingCustom(true);
    try {
      const chart = await generateCustomChart(settings, table, columnTypes, customPrompt.trim());
      if (!chart) {
        toast.warning("Could not generate a chart for that request. Try rephrasing.");
      } else {
        setAiSuggestions((prev) => [...prev, chart]);
        setCustomPrompt("");
        toast.success(`Chart "${chart.title}" created`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate chart");
    } finally {
      setIsLoadingCustom(false);
    }
  }, [customPrompt, table, columnTypes]);

  const handleRemoveSuggestion = useCallback((index: number) => {
    setAiSuggestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleApplySuggestion = useCallback((s: ChartSuggestion) => {
    setChartType(s.type);
    setXCol(s.xColumn);
    setYCol(s.yColumn);
    setAggregation(s.aggregation);
    setActiveTab("manual");
    toast.success(`Applied: ${s.title}`);
  }, []);

  return (
    <div className="space-y-4 p-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border">
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "manual" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "ai" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Charts
          </button>
        </div>

        <div className="flex-1" />

        {activeTab === "manual" && (
          <button
            onClick={handleExportPNG}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            title="Export chart as PNG"
            aria-label="Export chart as PNG"
          >
            <Download className="h-3.5 w-3.5" />
            PNG
          </button>
        )}
      </div>

      {activeTab === "manual" ? (
        <>
          {/* Manual controls */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Chart Type</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="rounded-lg border border-border bg-accent px-3 py-1.5 text-sm text-foreground focus:outline-none"
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="pie">Pie</option>
                <option value="scatter">Scatter</option>
                <option value="area">Area</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">X Axis</label>
              <select
                value={xCol}
                onChange={(e) => setXCol(e.target.value)}
                className="rounded-lg border border-border bg-accent px-3 py-1.5 text-sm text-foreground focus:outline-none"
              >
                {table.columns.map((c) => (
                  <option key={c} value={c}>
                    {c} {columnTypes[c] === "number" ? "(num)" : columnTypes[c] === "date" ? "(date)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Y Axis</label>
              <select
                value={yCol}
                onChange={(e) => setYCol(e.target.value)}
                className="rounded-lg border border-border bg-accent px-3 py-1.5 text-sm text-foreground focus:outline-none"
              >
                {table.columns.map((c) => (
                  <option key={c} value={c}>
                    {c} {columnTypes[c] === "number" ? "(num)" : columnTypes[c] === "date" ? "(date)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Aggregation</label>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as Aggregation)}
                className="rounded-lg border border-border bg-accent px-3 py-1.5 text-sm text-foreground focus:outline-none"
              >
                <option value="sum">Sum</option>
                <option value="avg">Average</option>
                <option value="count">Count</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
                <option value="none">None (raw)</option>
              </select>
            </div>
          </div>

          {/* Manual chart */}
          <div ref={chartContainerRef} className="h-80 w-full">
            <ChartRenderer data={manualChartData} chartType={chartType} theme={theme} />
          </div>
        </>
      ) : (
        <>
          {/* AI controls */}
          <div className="space-y-3">
            {/* Suggest button */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSuggestCharts}
                disabled={isLoadingAI}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isLoadingAI ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isLoadingAI ? "Analyzing data..." : "Suggest Charts"}
              </button>

              {aiSuggestions.length > 0 && (
                <button
                  onClick={() => setAiSuggestions([])}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>

            {/* Custom chart prompt */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoadingCustom && handleCustomChart()}
                placeholder="Describe a chart you want, e.g. &quot;Show revenue by category as a pie chart&quot;"
                className="flex-1 rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                disabled={isLoadingCustom}
              />
              <button
                onClick={handleCustomChart}
                disabled={!customPrompt.trim() || isLoadingCustom}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
                aria-label="Generate custom chart"
              >
                {isLoadingCustom ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* AI suggestions grid */}
          {aiSuggestions.length === 0 && !isLoadingAI && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">AI-Powered Chart Suggestions</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Click &ldquo;Suggest Charts&rdquo; to let AI analyze your data and recommend the best
                  visualizations, or describe a custom chart in natural language.
                </p>
              </div>
            </div>
          )}

          {isLoadingAI && aiSuggestions.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-muted-foreground">Analyzing {table.rows.length} rows across {table.columns.length} columns...</p>
            </div>
          )}

          {aiSuggestions.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {aiSuggestions.map((suggestion, i) => {
                const data = processChartData(table, suggestion.xColumn, suggestion.yColumn, suggestion.aggregation);
                const Icon = CHART_TYPE_ICONS[suggestion.type];
                return (
                  <div
                    key={i}
                    className="group rounded-xl border border-border bg-accent/30 transition-colors hover:border-indigo-500/40"
                  >
                    {/* Card header */}
                    <div className="flex items-start gap-2 border-b border-border/50 px-3 py-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20">
                        <Icon className="h-3.5 w-3.5 text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{suggestion.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{suggestion.description}</p>
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => handleApplySuggestion(suggestion)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Apply to manual chart"
                          aria-label="Apply to manual chart"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveSuggestion(i)}
                          className="rounded p-1 text-muted-foreground hover:bg-red-500/20 hover:text-red-400"
                          title="Remove chart"
                          aria-label="Remove chart"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="h-48 px-2 py-2">
                      <ChartRenderer data={data} chartType={suggestion.type} theme={theme} />
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border/50 px-3 py-1.5">
                      <p className="text-[10px] text-muted-foreground">
                        {suggestion.xColumn} vs {suggestion.yColumn} &middot; {suggestion.aggregation} &middot; {suggestion.reasoning}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
