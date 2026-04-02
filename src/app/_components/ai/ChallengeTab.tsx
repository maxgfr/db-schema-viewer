"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Shield,
  Loader2,
  AlertTriangle,
  Info,
  Download,
  Filter,
} from "lucide-react";
import type { Diagram } from "db-schema-toolkit";
import { downloadBlob } from "@/lib/export/image-export";
import { loadAISettings } from "@/lib/storage/cookie-storage";
import {
  challengeSchema,
  type SchemaIssue,
  type ChallengeResponse,
} from "db-schema-toolkit/ai";

type SeverityFilter = "all" | "critical" | "warning" | "info";
type CategoryFilter =
  | "all"
  | "naming"
  | "normalization"
  | "indexing"
  | "relationships"
  | "types"
  | "performance"
  | "security";

interface ChallengeTabProps {
  diagram: Diagram;
}

export function ChallengeTab({ diagram }: ChallengeTabProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [challengeResult, setChallengeResult] = useState<ChallengeResponse | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const handleChallenge = useCallback(async () => {
    const settings = loadAISettings();
    if (!settings || (!settings.apiKey && !settings.customEndpoint)) {
      toast.error("No AI configured", {
        description: "Go to Settings to configure an API key or a local Ollama endpoint.",
      });
      return;
    }

    setIsLoading(true);
    setChallengeResult(null);

    try {
      const result = await challengeSchema(settings, diagram);
      setChallengeResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Challenge failed");
    } finally {
      setIsLoading(false);
    }
  }, [diagram]);

  const handleExportReport = useCallback(() => {
    if (!challengeResult) return;
    const json = JSON.stringify(challengeResult, null, 2);
    downloadBlob(json, "schema-challenge-report.json", "application/json");
    toast.success("Report exported");
  }, [challengeResult]);

  const severityIcon = (severity: SchemaIssue["severity"]) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case "info": return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const severityCounts = useMemo(() => {
    if (!challengeResult) return { critical: 0, warning: 0, info: 0 };
    return challengeResult.issues.reduce(
      (acc, issue) => {
        acc[issue.severity]++;
        return acc;
      },
      { critical: 0, warning: 0, info: 0 }
    );
  }, [challengeResult]);

  const filteredIssues = useMemo(() => {
    if (!challengeResult) return [];
    return challengeResult.issues.filter((issue) => {
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
      return true;
    });
  }, [challengeResult, severityFilter, categoryFilter]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {!challengeResult && !isLoading && (
        <div className="flex flex-col items-center py-8">
          <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Run an AI-powered review of your schema to find potential
            issues with naming, normalization, indexing, and more.
          </p>
          <button
            onClick={handleChallenge}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
          >
            Challenge My Schema
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center py-8">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm text-muted-foreground">Analyzing your schema...</p>
        </div>
      )}

      {challengeResult && (
        <div className="space-y-4">
          {/* Score */}
          <div className="rounded-xl border border-border bg-accent p-4 text-center">
            <div className="mb-1 text-3xl font-bold text-foreground">
              {challengeResult.overallScore}/100
            </div>
            <p className="text-sm text-muted-foreground">
              {challengeResult.summary}
            </p>
          </div>

          {/* Severity counts */}
          <div className="flex items-center justify-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {severityCounts.critical} critical
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {severityCounts.warning} warnings
            </span>
            <span className="flex items-center gap-1 text-blue-400">
              <Info className="h-3 w-3" />
              {severityCounts.info} info
            </span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              className="rounded-lg border border-border bg-accent px-2 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="rounded-lg border border-border bg-accent px-2 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="naming">Naming</option>
              <option value="normalization">Normalization</option>
              <option value="indexing">Indexing</option>
              <option value="relationships">Relationships</option>
              <option value="types">Types</option>
              <option value="performance">Performance</option>
              <option value="security">Security</option>
            </select>
            <div className="flex-1" />
            <button
              onClick={handleExportReport}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              title="Export report as JSON"
            >
              <Download className="h-3 w-3" />
              Export Report
            </button>
          </div>

          {/* Issues */}
          <div className="space-y-3">
            {filteredIssues.map((issue, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-accent/50 p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  {severityIcon(issue.severity)}
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {issue.category}
                  </span>
                  {issue.table && (
                    <span className="rounded bg-accent px-1.5 py-0.5 text-xs text-foreground">
                      {issue.table}
                      {issue.field ? `.${issue.field}` : ""}
                    </span>
                  )}
                </div>
                <p className="mb-1 text-sm text-foreground">
                  {issue.description}
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-300">
                  {issue.suggestion}
                </p>
              </div>
            ))}
            {filteredIssues.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No issues match the current filters.
              </p>
            )}
          </div>

          <button
            onClick={handleChallenge}
            className="w-full rounded-xl border border-border py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
          >
            Run Again
          </button>
        </div>
      )}
    </div>
  );
}
