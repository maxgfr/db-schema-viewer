"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Database,
  Upload,
  Share2,
  Brain,
  Download,
  BarChart3,
  FileText,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import type { Diagram } from "@/lib/domain";
import { parseSQLToDiagram } from "@/lib/sql";
import { autoLayout } from "@/lib/layout/auto-layout";
import { SAMPLE_SCHEMAS } from "@/lib/sql/sample-schemas";
import { SchemaUpload } from "../schema/SchemaUpload";

interface LandingProps {
  onDiagramCreated: (diagram: Diagram) => void;
}

const FEATURES = [
  {
    icon: Database,
    title: "Multi-Database Support",
    description:
      "PostgreSQL, MySQL, SQLite, MariaDB, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake",
  },
  {
    icon: Sparkles,
    title: "Auto-Detection",
    description:
      "Automatically detects your database type from SQL syntax patterns",
  },
  {
    icon: Brain,
    title: "AI-Powered Review",
    description:
      "Get AI analysis of your schema with naming, normalization, and performance suggestions",
  },
  {
    icon: Share2,
    title: "Shareable URLs",
    description:
      "Share your schema via compressed URLs, like Excalidraw. No account needed.",
  },
  {
    icon: Download,
    title: "Export Anywhere",
    description:
      "Export as PNG, SVG, PDF, or SQL for any target database dialect",
  },
  {
    icon: BarChart3,
    title: "Data Exploration",
    description:
      "Upload small SQL dumps, explore data in tables, and generate charts",
  },
];

export function Landing({ onDiagramCreated }: LandingProps) {
  const [showUpload, setShowUpload] = useState(false);

  const handleSQLParsed = useCallback(
    (sql: string, fileName?: string) => {
      try {
        const diagram = parseSQLToDiagram(sql, fileName?.replace(/\.sql$/i, ""));
        const layouted = autoLayout(diagram.tables, diagram.relationships);
        onDiagramCreated({ ...diagram, tables: layouted });
        toast.success(
          `Loaded ${diagram.tables.length} tables, ${diagram.relationships.length} relationships`
        );
      } catch (err) {
        toast.error("Failed to parse SQL", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [onDiagramCreated]
  );

  const handleSample = useCallback(
    (sql: string, name: string) => {
      handleSQLParsed(sql, name);
    },
    [handleSQLParsed]
  );

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-5 py-3">
              <Database className="h-8 w-8 text-indigo-400" />
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                DB Schema Viewer
              </h1>
            </div>

            <p className="max-w-2xl text-lg text-slate-400">
              Visualize database schemas in your browser. Upload SQL, see
              interactive diagrams, get AI-powered reviews, share via URL.{" "}
              <span className="text-indigo-400">100% client-side</span> — your
              data never leaves your browser.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40"
              >
                <Upload className="h-5 w-5" />
                Upload SQL
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sample Schemas */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 text-center text-lg font-semibold text-slate-300">
          Or try a sample schema
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_SCHEMAS.map((sample) => (
            <button
              key={sample.name}
              onClick={() => handleSample(sample.sql, sample.name)}
              className="group flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-slate-800"
            >
              <FileText className="h-5 w-5 shrink-0 text-indigo-400" />
              <div className="flex-1">
                <div className="font-medium text-white">{sample.name}</div>
                <div className="text-xs text-slate-500">{sample.description}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-indigo-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold text-white">
          Everything you need to understand your schema
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 transition-colors hover:border-slate-600"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20">
                <feature.icon className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="mb-2 font-semibold text-white">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Supported DBs */}
      <div className="border-t border-slate-800 py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-6 text-sm font-medium text-slate-500 uppercase tracking-wider">
            Supported Databases
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              "PostgreSQL",
              "MySQL",
              "SQLite",
              "MariaDB",
              "Supabase",
              "CockroachDB",
              "ClickHouse",
              "BigQuery",
              "Snowflake",
            ].map((db) => (
              <span
                key={db}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300"
              >
                {db}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts info */}
      <div className="border-t border-slate-800 py-8">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Keyboard Shortcuts
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span><kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">Cmd+I</kbd> Import</span>
            <span><kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">Cmd+E</kbd> Export</span>
            <span><kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">Cmd+K</kbd> AI Panel</span>
            <span><kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">Cmd+Shift+S</kbd> Share</span>
            <span><kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">Esc</kbd> Close</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-slate-500">
          <p>
            Open source on GitHub. Built with Next.js, React Flow, and
            Tailwind CSS.
          </p>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <SchemaUpload
          onClose={() => setShowUpload(false)}
          onSQLParsed={handleSQLParsed}
        />
      )}
    </div>
  );
}
