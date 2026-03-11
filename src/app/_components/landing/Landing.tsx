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
  Sun,
  Moon,
} from "lucide-react";
import type { Diagram } from "@/lib/domain";
import { SAMPLE_SCHEMAS } from "@/lib/sql/sample-schemas";
import { SCHEMA_TEMPLATES } from "@/lib/sql/schema-templates";
import { parseSchemaFile } from "@/lib/parsing/parse-schema-file";
import type { Theme } from "@/hooks/use-theme";
import { SchemaUpload } from "../schema/SchemaUpload";

interface LandingProps {
  onDiagramCreated: (diagram: Diagram) => void;
  theme: Theme;
  onToggleTheme: () => void;
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

export function Landing({ onDiagramCreated, theme, onToggleTheme }: LandingProps) {
  const [showUpload, setShowUpload] = useState(false);

  const handleSQLParsed = useCallback(
    (sql: string, fileName?: string) => {
      try {
        const diagram = parseSchemaFile(sql, fileName);
        onDiagramCreated(diagram);
        toast.success(
          `Loaded ${diagram.tables.length} tables, ${diagram.relationships.length} relationships`
        );
      } catch (err) {
        toast.error("Failed to parse schema", {
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
      {/* Theme toggle */}
      <div className="absolute right-4 top-4 z-10">
        <button
          onClick={onToggleTheme}
          className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-5 py-3">
              <Database className="h-8 w-8 text-indigo-400" />
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                DB Schema Viewer
              </h1>
            </div>

            <p className="max-w-2xl text-lg text-muted-foreground">
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
        <h2 className="mb-6 text-center text-lg font-semibold text-muted-foreground">
          Or try a sample schema
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_SCHEMAS.map((sample) => (
            <button
              key={sample.name}
              onClick={() => handleSample(sample.sql, sample.name)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-card"
            >
              <FileText className="h-5 w-5 shrink-0 text-indigo-400" />
              <div className="flex-1">
                <div className="font-medium text-foreground">{sample.name}</div>
                <div className="text-xs text-muted-foreground">{sample.description}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-indigo-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Schema Templates */}
      {SCHEMA_TEMPLATES.length > 0 && (
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h2 className="mb-6 text-center text-lg font-semibold text-muted-foreground">
            More templates
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCHEMA_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => handleSample(tpl.sql, tpl.name)}
                className="group flex flex-col rounded-xl border border-border bg-card/50 p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-card"
              >
                <span className="mb-1 rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-400 self-start">
                  {tpl.category}
                </span>
                <span className="mt-1 font-medium text-foreground">{tpl.name}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold text-foreground">
          Everything you need to understand your schema
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card/50 p-6 transition-colors hover:border-primary/30"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20">
                <feature.icon className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Supported DBs */}
      <div className="border-t border-border py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-6 text-sm font-medium text-muted-foreground uppercase tracking-wider">
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
              "Drizzle ORM",
              "Prisma",
              "DBML",
              "TypeORM",
            ].map((db) => (
              <span
                key={db}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
              >
                {db}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts info */}
      <div className="border-t border-border py-8">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Keyboard Shortcuts
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span><kbd className="rounded bg-card px-1.5 py-0.5 font-mono text-foreground/70">Cmd+I</kbd> Import</span>
            <span><kbd className="rounded bg-card px-1.5 py-0.5 font-mono text-foreground/70">Cmd+E</kbd> Export</span>
            <span><kbd className="rounded bg-card px-1.5 py-0.5 font-mono text-foreground/70">Cmd+K</kbd> AI Panel</span>
            <span><kbd className="rounded bg-card px-1.5 py-0.5 font-mono text-foreground/70">Cmd+Shift+S</kbd> Share</span>
            <span><kbd className="rounded bg-card px-1.5 py-0.5 font-mono text-foreground/70">Esc</kbd> Close</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
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
