"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Database,
  Upload,
  Share2,
  Brain,
  Download,
  BarChart3,
  FileText,
  ChevronRight,
  Sun,
  Moon,
  Star,
  Github,
  Code,
  Layers,
  Braces,
  FileCode,
  Zap,
  Lock,
  GitCompareArrows,
  Monitor,
} from "lucide-react";
import type { Diagram } from "@/lib/domain";
import { SAMPLE_SCHEMAS } from "@/lib/sql/sample-schemas";
import { SCHEMA_TEMPLATES } from "@/lib/sql/schema-templates";
import { EXAMPLE_SCHEMAS } from "@/lib/examples/example-schemas";
import { parseSchemaFile } from "@/lib/parsing/parse-schema-file";
import type { Theme, ThemeMode } from "@/hooks/use-theme";
import { SchemaUpload } from "../schema/SchemaUpload";

interface LandingProps {
  onDiagramCreated: (diagram: Diagram) => void;
  theme: Theme;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

type SampleTab = "sql" | "orm";

const FEATURES = [
  {
    icon: Database,
    title: "13 Dialects",
    description:
      "PostgreSQL, MySQL, SQLite, MariaDB, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake, Drizzle, Prisma, TypeORM, DBML",
  },
  {
    icon: Zap,
    title: "Instant Parsing",
    description:
      "Paste or drop your schema — tables, fields, and relationships appear in milliseconds",
  },
  {
    icon: Brain,
    title: "AI Review",
    description:
      "Get naming, normalization, indexing and performance suggestions powered by AI",
  },
  {
    icon: Share2,
    title: "Shareable URLs",
    description:
      "Share schemas via compressed URLs. No sign-up, no database, no server",
  },
  {
    icon: Download,
    title: "Export Anywhere",
    description:
      "PNG, SVG, PDF, SQL, Prisma, Drizzle, Mermaid, Markdown — all from one diagram",
  },
  {
    icon: Lock,
    title: "100% Private",
    description:
      "Everything runs in your browser. Your schema never leaves your machine",
  },
  {
    icon: BarChart3,
    title: "Data Explorer",
    description:
      "Upload SQL dumps, browse INSERT data in tables, and generate charts",
  },
  {
    icon: GitCompareArrows,
    title: "Schema Diff",
    description:
      "Compare two versions of a schema side-by-side to see what changed",
  },
];

const FORMAT_ICONS: Record<string, typeof Database> = {
  drizzle: Code,
  prisma: Layers,
  typeorm: Braces,
  dbml: FileCode,
};

const ALL_SAMPLES = [
  ...SAMPLE_SCHEMAS.map((s) => ({ ...s, tab: "sql" as SampleTab, category: undefined as string | undefined, fileName: undefined as string | undefined })),
  ...SCHEMA_TEMPLATES.map((s) => ({ ...s, tab: "sql" as SampleTab })),
  ...EXAMPLE_SCHEMAS.map((s) => ({ ...s, tab: "orm" as SampleTab })),
];

export function Landing({ onDiagramCreated, theme, themeMode, onToggleTheme }: LandingProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<SampleTab>("sql");

  const handleSQLParsed = useCallback(
    (sql: string, fileName?: string) => {
      try {
        const diagram = parseSchemaFile(sql, fileName);
        onDiagramCreated({ ...diagram, sourceContent: sql });
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

  const filteredSamples = useMemo(
    () => ALL_SAMPLES.filter((s) => s.tab === activeTab),
    [activeTab]
  );

  const tabs: { id: SampleTab; label: string; count: number }[] = [
    { id: "sql", label: "SQL", count: SAMPLE_SCHEMAS.length + SCHEMA_TEMPLATES.length },
    { id: "orm", label: "ORM / DSL", count: EXAMPLE_SCHEMAS.length },
  ];

  return (
    <div className="min-h-screen">
      {/* Theme toggle */}
      <div className="absolute right-4 top-4 z-10">
        <button
          onClick={onToggleTheme}
          className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={`Theme: ${themeMode} (click to cycle)`}
          aria-label={`Theme: ${themeMode} (click to cycle)`}
        >
          {themeMode === "system" ? <Monitor className="h-4 w-4" /> : theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/15 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-24">
          <div className="flex flex-col items-center text-center">
            <div className="mb-8 flex items-center gap-3 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-5 py-2.5">
              <Database className="h-6 w-6 text-indigo-400" />
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">Open Source &middot; Free &middot; No Sign-up</span>
            </div>

            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Understand your database<br />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">in seconds</span>
            </h1>

            <p className="mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Drop any schema file — SQL, Prisma, Drizzle, TypeORM, or DBML — and get an
              interactive ER diagram with AI-powered review. Everything runs in your browser.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2.5 rounded-xl bg-indigo-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Upload className="h-5 w-5" />
                Import Schema
              </button>
              <a
                href="https://github.com/maxgfr/db-schema-viewer"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-7 py-3.5 font-semibold text-foreground transition-all hover:border-amber-500/50 hover:bg-accent hover:scale-[1.02] active:scale-[0.98]"
              >
                <Star className="h-5 w-5 text-amber-400" />
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Samples — Tabbed */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-2 text-center text-2xl font-bold text-foreground">
          Try a sample
        </h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Pick a schema to see the viewer in action — no upload needed
        </p>

        {/* Tabs */}
        <div className="mb-6 flex items-center justify-center gap-1 rounded-xl border border-border bg-card/50 p-1 mx-auto w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${activeTab === tab.id ? "text-indigo-200" : "text-muted-foreground/60"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sample cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSamples.map((sample) => {
            const CategoryIcon = sample.category ? FORMAT_ICONS[sample.category] : undefined;
            return (
              <button
                key={`${sample.name}-${sample.category ?? "sql"}`}
                onClick={() => handleSample(sample.sql, sample.fileName ?? sample.name)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-card"
              >
                {CategoryIcon ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CategoryIcon className="h-4 w-4 text-emerald-400" />
                  </div>
                ) : (
                  <FileText className="h-5 w-5 shrink-0 text-indigo-400" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{sample.name}</span>
                    {sample.category && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        {sample.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">{sample.description}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-indigo-400" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Features Grid */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-4 text-center text-2xl font-bold text-foreground">
            Everything you need
          </h2>
          <p className="mb-12 text-center text-sm text-muted-foreground">
            From import to share, all the tools to understand and communicate your schema
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-indigo-500/30 hover:bg-card"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
                  <feature.icon className="h-4.5 w-4.5 text-indigo-400" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-foreground">{feature.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Supported formats — compact */}
      <div className="border-t border-border py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-6 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Supported Formats
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { name: "PostgreSQL" },
              { name: "MySQL" },
              { name: "SQLite" },
              { name: "MariaDB" },
              { name: "Supabase" },
              { name: "CockroachDB" },
              { name: "ClickHouse" },
              { name: "BigQuery" },
              { name: "Snowflake" },
              { name: "Drizzle ORM", version: "v0.29+" },
              { name: "Prisma", version: "v2+" },
              { name: "TypeORM", version: "v0.2+" },
              { name: "DBML", version: "v2" },
            ].map((db) => (
              <span
                key={db.name}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
              >
                {db.name}
                {db.version && (
                  <span className="ml-1 text-[10px] text-muted-foreground/50">{db.version}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="border-t border-border py-8">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Keyboard Shortcuts
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span><kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-foreground/70">Cmd+I</kbd> Import</span>
            <span><kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-foreground/70">Cmd+E</kbd> Export</span>
            <span><kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-foreground/70">Cmd+K</kbd> AI</span>
            <span><kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-foreground/70">Cmd+Shift+S</kbd> Share</span>
            <span><kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-foreground/70">Esc</kbd> Close</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Built with Next.js, React Flow & Tailwind CSS
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/maxgfr/db-schema-viewer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
              <a
                href="https://github.com/maxgfr/db-schema-viewer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-amber-400"
              >
                <Star className="h-4 w-4" />
                Star
              </a>
            </div>
          </div>
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
