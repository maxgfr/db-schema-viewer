"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  X,
  Send,
  Square,
  Loader2,
  MessageSquare,
  Shield,
  AlertTriangle,
  Info,
  Copy,
  Download,
  Filter,
  RotateCcw,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { Diagram } from "db-schema-toolkit";
import { loadAISettings } from "@/lib/storage/cookie-storage";
import {
  querySchema,
  challengeSchema,
  type SchemaIssue,
  type ChallengeResponse,
} from "db-schema-toolkit/ai";
import { MarkdownContent } from "../shared/MarkdownContent";
import { useTranslation } from "@/lib/i18n/context";

interface AIPanelProps {
  diagram: Diagram;
  onClose: () => void;
  visible?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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

interface ChallengeHistoryEntry {
  score: number;
  issueCount: number;
  timestamp: string;
  schemaName: string;
}

const CHALLENGE_HISTORY_KEY = "db-schema-viewer-challenge-history";

function loadChallengeHistory(): ChallengeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(CHALLENGE_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChallengeHistoryEntry[];
  } catch {
    return [];
  }
}

function saveChallengeEntry(entry: ChallengeHistoryEntry) {
  const history = loadChallengeHistory();
  history.push(entry);
  // Keep last 20 entries
  const trimmed = history.slice(-20);
  localStorage.setItem(CHALLENGE_HISTORY_KEY, JSON.stringify(trimmed));
}

const QUICK_ACTIONS = [
  { labelKey: "ai.quickAction.explainAsPm", prompt: "Explain this schema as if I were a product manager with no database experience. Give a business-friendly summary of what data this system manages, the main entities, and how they relate to each other." },
  { labelKey: "ai.quickAction.suggestIndexes", prompt: "Analyze all foreign keys, frequently queried columns, and column patterns in my schema. Recommend specific CREATE INDEX statements I should add, explaining why each index would help." },
  { labelKey: "ai.quickAction.generateMigration", prompt: "Based on the issues you can spot in my schema, generate concrete SQL migration statements (ALTER TABLE, ADD INDEX, ADD CONSTRAINT, etc.) in the native dialect to fix them. Group by priority." },
  { labelKey: "ai.quickAction.generateQuery", prompt: "Generate useful SQL queries for this schema: a JOIN query across the main tables, an aggregation query, and a query that would be useful for a dashboard. Use the actual table and column names." },
  { labelKey: "ai.quickAction.findIssues", prompt: "Find potential issues or anti-patterns in my schema" },
  { labelKey: "ai.quickAction.testQueries", prompt: "Suggest SQL test queries that would validate the constraints and relationships in my schema — e.g., check referential integrity, find orphan rows, verify unique constraints, and test edge cases." },
];

export function AIPanel({ diagram, onClose, visible = true }: AIPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"chat" | "challenge">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [challengeResult, setChallengeResult] = useState<ChallengeResponse | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [showHistory, setShowHistory] = useState(false);
  const [challengeHistory, setChallengeHistory] = useState<ChallengeHistoryEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    setChallengeHistory(loadChallengeHistory());
  }, []);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success(t("common.copiedToClipboard"));
    });
  }, [t]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = overrideInput ?? input;
    if (!text.trim() || isLoading) return;

    const settings = loadAISettings();
    if (!settings) {
      toast.error(t("common.configureApiKeyFirst"));
      return;
    }

    if (!settings.apiKey && !settings.customEndpoint) {
      toast.error(t("common.noAiConfigured"), {
        description: t("common.noAiConfiguredDesc"),
      });
      return;
    }

    const userMsg = text.trim();
    if (!overrideInput) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);
    setStreamingText("");
    streamingTextRef.current = "";

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const history = messages
        .reduce<Array<{ prompt: string; response: string }>>((acc, msg, i) => {
          if (msg.role === "user" && messages[i + 1]?.role === "assistant") {
            acc.push({ prompt: msg.content, response: messages[i + 1]!.content });
          }
          return acc;
        }, []);

      await querySchema(
        settings,
        diagram,
        userMsg,
        (chunk) => {
          if (controller.signal.aborted) return;
          streamingTextRef.current += chunk;
          setStreamingText(streamingTextRef.current);
        },
        (fullText) => {
          if (controller.signal.aborted) {
            const partial = streamingTextRef.current;
            if (partial.trim()) {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: partial + "\n\n" + t("ai.stopped") },
              ]);
            }
          } else {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: fullText },
            ]);
          }
          setStreamingText("");
          streamingTextRef.current = "";
        },
        history,
        controller.signal
      );
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        const partial = streamingTextRef.current;
        if (partial.trim()) {
          setMessages((prev) => [...prev, { role: "assistant", content: partial + "\n\n" + t("ai.stopped") }]);
        }
        setStreamingText("");
        streamingTextRef.current = "";
      } else {
        toast.error(err instanceof Error ? err.message : t("ai.requestFailed"));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, messages, diagram, t]);

  const handleChallenge = useCallback(async () => {
    const settings = loadAISettings();
    if (!settings || (!settings.apiKey && !settings.customEndpoint)) {
      toast.error(t("common.noAiConfigured"), {
        description: t("common.noAiConfiguredDesc"),
      });
      return;
    }

    setIsLoading(true);
    setChallengeResult(null);

    try {
      const result = await challengeSchema(settings, diagram);
      setChallengeResult(result);
      const entry: ChallengeHistoryEntry = {
        score: result.overallScore,
        issueCount: result.issues.length,
        timestamp: new Date().toISOString(),
        schemaName: diagram.name,
      };
      saveChallengeEntry(entry);
      setChallengeHistory(loadChallengeHistory());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ai.challengeFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [diagram, t]);

  const handleExportReport = useCallback((format: "json" | "md" = "json") => {
    if (!challengeResult) return;
    if (format === "md") {
      const lines: string[] = [];
      lines.push(`# Schema Challenge Report`);
      lines.push("");
      lines.push(`**Score:** ${challengeResult.overallScore}/100`);
      lines.push("");
      lines.push(`**Summary:** ${challengeResult.summary}`);
      lines.push("");
      lines.push(`## Issues (${challengeResult.issues.length})`);
      lines.push("");
      for (const issue of challengeResult.issues) {
        const icon = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
        const location = issue.table ? (issue.field ? `\`${issue.table}.${issue.field}\`` : `\`${issue.table}\``) : "";
        lines.push(`### ${icon} [${issue.severity.toUpperCase()}] ${issue.category}${location ? ` — ${location}` : ""}`);
        lines.push("");
        lines.push(issue.description);
        lines.push("");
        lines.push(`> **Suggestion:** ${issue.suggestion}`);
        lines.push("");
      }
      const md = lines.join("\n");
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "schema-challenge-report.md";
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("ai.reportExportedMd"));
    } else {
      const json = JSON.stringify(challengeResult, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "schema-challenge-report.json";
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("ai.reportExportedJson"));
    }
  }, [challengeResult, t]);

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

  const modalContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-950/70"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full max-w-lg">
        <div
          className="pointer-events-auto flex w-full flex-col border-l border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-lg font-bold text-foreground">{t("ai.title")}</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent" aria-label={t("ai.closePanel")}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("chat")}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium ${
                tab === "chat"
                  ? "border-b-2 border-indigo-500 text-indigo-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              {t("ai.ask")}
            </button>
            <button
              onClick={() => setTab("challenge")}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium ${
                tab === "challenge"
                  ? "border-b-2 border-indigo-500 text-indigo-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="h-4 w-4" />
              {t("ai.challenge")}
            </button>
          </div>

          {/* Content */}
          {tab === "chat" ? (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.length === 0 && !streamingText && (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("ai.askAnything")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("ai.tablesLoaded", { tables: diagram.tables.length, rels: diagram.relationships.length })}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.labelKey}
                          onClick={() => handleSend(action.prompt)}
                          className="rounded-lg border border-border bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/10"
                        >
                          {t(action.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`group relative rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "ml-8 bg-indigo-500/20 text-foreground"
                        : "mr-8 bg-accent text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => handleCopyMessage(msg.content)}
                        className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                        title={t("common.copyMessage")}
                        aria-label={t("common.copyMessage")}
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                ))}
                {streamingText && (
                  <div className="mr-8 rounded-lg bg-accent px-3 py-2 text-sm text-foreground">
                    <MarkdownContent content={streamingText} />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-4">
                <div className="flex gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={() => { setMessages([]); setStreamingText(""); }}
                      className="rounded-lg border border-border px-2 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={t("common.clearChatHistory")}
                      aria-label={t("common.clearChatHistory")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend()}
                    placeholder={t("ai.askPlaceholder")}
                    className="flex-1 rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                    disabled={isLoading}
                  />
                  {isLoading ? (
                    <button
                      onClick={handleStop}
                      className="rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-500"
                      title={t("common.stopGenerating")}
                      aria-label={t("common.stopGenerating")}
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {!challengeResult && !isLoading && (
                <div className="flex flex-col items-center py-8">
                  <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="mb-4 text-center text-sm text-muted-foreground">
                    {t("ai.challengeDescription")}
                  </p>
                  <button
                    onClick={handleChallenge}
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    {t("ai.challengeMySchema")}
                  </button>
                </div>
              )}

              {isLoading && (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-400" />
                  <p className="text-sm text-muted-foreground">{t("ai.analyzing")}</p>
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
                      {t("ai.severity.criticalCount", { count: severityCounts.critical })}
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {t("ai.severity.warningCount", { count: severityCounts.warning })}
                    </span>
                    <span className="flex items-center gap-1 text-blue-400">
                      <Info className="h-3 w-3" />
                      {t("ai.severity.infoCount", { count: severityCounts.info })}
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
                      <option value="all">{t("ai.severity.all")}</option>
                      <option value="critical">{t("ai.severity.critical")}</option>
                      <option value="warning">{t("ai.severity.warning")}</option>
                      <option value="info">{t("ai.severity.info")}</option>
                    </select>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                      className="rounded-lg border border-border bg-accent px-2 py-1 text-xs text-foreground focus:outline-none"
                    >
                      <option value="all">{t("ai.category.all")}</option>
                      <option value="naming">{t("ai.category.naming")}</option>
                      <option value="normalization">{t("ai.category.normalization")}</option>
                      <option value="indexing">{t("ai.category.indexing")}</option>
                      <option value="relationships">{t("ai.category.relationships")}</option>
                      <option value="types">{t("ai.category.types")}</option>
                      <option value="performance">{t("ai.category.performance")}</option>
                      <option value="security">{t("ai.category.security")}</option>
                    </select>
                    <div className="flex-1" />
                    <button
                      onClick={() => handleExportReport("md")}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                      title={t("ai.exportReportMd")}
                    >
                      <Download className="h-3 w-3" />
                      .md
                    </button>
                    <button
                      onClick={() => handleExportReport("json")}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                      title={t("ai.exportReportJson")}
                    >
                      <Download className="h-3 w-3" />
                      .json
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
                        {t("ai.noIssuesMatch")}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleChallenge}
                      className="flex-1 rounded-xl border border-border py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                    >
                      {t("ai.runAgain")}
                    </button>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className={`flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground ${showHistory ? "bg-accent text-foreground" : ""}`}
                      title={t("ai.viewScoreHistory")}
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { setChallengeResult(null); setSeverityFilter("all"); setCategoryFilter("all"); }}
                      className="flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={t("ai.clearChallengeResults")}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {showHistory && challengeHistory.length > 0 && (
                    <div className="rounded-xl border border-border bg-accent/50 p-3">
                      <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t("ai.scoreHistory")}</h4>
                      <div className="space-y-1.5">
                        {challengeHistory.slice().reverse().map((entry, i) => {
                          const prev = challengeHistory[challengeHistory.length - 1 - i - 1];
                          const diff = prev ? entry.score - prev.score : 0;
                          let TrendIcon: typeof TrendingUp;
                          let trendColor: string;
                          if (diff > 0) { TrendIcon = TrendingUp; trendColor = "text-emerald-400"; }
                          else if (diff < 0) { TrendIcon = TrendingDown; trendColor = "text-red-400"; }
                          else { TrendIcon = Minus; trendColor = "text-muted-foreground"; }

                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="font-mono font-bold text-foreground">{entry.score}</span>
                              {prev && (
                                <span className={`flex items-center gap-0.5 ${trendColor}`}>
                                  <TrendIcon className="h-3 w-3" />
                                  {diff > 0 ? "+" : ""}{diff}
                                </span>
                              )}
                              <span className="text-muted-foreground">{t("ai.issues", { count: entry.issueCount })}</span>
                              <span className="ml-auto text-muted-foreground/60">
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (!visible) return null;

  return createPortal(modalContent, document.body);
}
