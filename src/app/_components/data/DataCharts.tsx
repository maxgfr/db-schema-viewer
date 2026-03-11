"use client";

import { useState, useMemo } from "react";
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

interface DataChartsProps {
  table: ParsedDumpTable;
}

type ChartType = "bar" | "line" | "pie" | "scatter" | "area";
type Aggregation = "sum" | "avg" | "count" | "none";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
];

export function DataCharts({ table }: DataChartsProps) {
  const columnTypes = useMemo(
    () => inferColumnTypes(table.columns, table.rows),
    [table]
  );

  const numericCols = table.columns.filter((c) => columnTypes[c] === "number");
  const categoryCols = table.columns.filter((c) => columnTypes[c] !== "number");

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xCol, setXCol] = useState(categoryCols[0] ?? table.columns[0] ?? "");
  const [yCol, setYCol] = useState(numericCols[0] ?? table.columns[1] ?? "");
  const [aggregation, setAggregation] = useState<Aggregation>("sum");

  const chartData = useMemo(() => {
    if (!xCol || !yCol) return [];

    if (aggregation === "none") {
      return table.rows.map((row) => ({
        x: row[xCol] ?? "",
        y: typeof row[yCol] === "number" ? row[yCol] : Number(row[yCol]) || 0,
      }));
    }

    // Aggregate
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
        default: y = vals[0] ?? 0;
      }
      return { x: key, y: Math.round(y * 100) / 100 };
    });
  }, [table.rows, xCol, yCol, aggregation]);

  return (
    <div className="space-y-4 p-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Chart Type</label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
            <option value="scatter">Scatter</option>
            <option value="area">Area</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">X Axis</label>
          <select
            value={xCol}
            onChange={(e) => setXCol(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none"
          >
            {table.columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Y Axis</label>
          <select
            value={yCol}
            onChange={(e) => setYCol(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none"
          >
            {table.columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Aggregation</label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value as Aggregation)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none"
          >
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="count">Count</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                labelStyle={{ color: "#f8fafc" }}
              />
              <Bar dataKey="y" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
              <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1" }} />
            </LineChart>
          ) : chartType === "pie" ? (
            <PieChart>
              <Pie data={chartData} dataKey="y" nameKey="x" cx="50%" cy="50%" outerRadius={120} label>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
            </PieChart>
          ) : chartType === "scatter" ? (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 12 }} name={xCol} />
              <YAxis dataKey="y" stroke="#94a3b8" tick={{ fontSize: 12 }} name={yCol} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
              <Scatter data={chartData} fill="#6366f1" />
            </ScatterChart>
          ) : (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
              <Area type="monotone" dataKey="y" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
