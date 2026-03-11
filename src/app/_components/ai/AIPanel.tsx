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
} from "lucide-react";
import type { Diagram } from "@/lib/domain";
import { loadAISettings } from "@/lib/storage/cookie-storage";
import {
  querySchema,
  challengeSchema,
  type SchemaIssue,
  type ChallengeResponse,
} from "@/lib/ai/ai-service";

interface AIPanelProps {
  diagram: Diagram;
  onClose: () => void;
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

const QUICK_ACTIONS = [
  { label: "Suggest indexes", prompt: "Suggest indexes for my schema to improve query performance" },
  { label: "Explain schema", prompt: "Explain the overall structure and relationships of my schema" },
  { label: "Generate migration", prompt: "Generate a migration plan for improving my schema" },
  { label: "Find issues", prompt: "Find potential issues or anti-patterns in my schema" },
];

export function AIPanel({ diagram, onClose }: AIPanelProps) {
  const [tab, setTab] = useState<"chat" | "challenge">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [challengeResult, setChallengeResult] = useState<ChallengeResponse | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success("Copied to clipboard");
    });
  }, []);

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
      toast.error("Please configure your AI API key first");
      return;
    }

    if (!settings.apiKey && !settings.customEndpoint) {
      toast.error("No AI configured", {
        description: "Go to Settings to configure an API key or a local Ollama endpoint.",
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
                { role: "assistant", content: partial + "\n\n_(stopped)_" },
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
        history
      );
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        const partial = streamingTextRef.current;
        if (partial.trim()) {
          setMessages((prev) => [...prev, { role: "assistant", content: partial + "\n\n_(stopped)_" }]);
        }
        setStreamingText("");
        streamingTextRef.current = "";
      } else {
        toast.error(err instanceof Error ? err.message : "AI request failed");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, messages, diagram]);

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
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "schema-challenge-report.json";
    link.click();
    URL.revokeObjectURL(url);
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
            <h2 className="text-lg font-bold text-foreground">AI Assistant</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent">
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
              Ask
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
              Challenge
            </button>
          </div>

          {/* Content */}
          {tab === "chat" ? (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.length === 0 && !streamingText && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <p className="mb-4">Ask questions about your schema:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleSend(action.prompt)}
                          className="rounded-lg border border-border bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/80"
                        >
                          {action.label}
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
                        ? "ml-8 bg-indigo-500/20 text-indigo-100"
                        : "mr-8 bg-accent text-foreground"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => handleCopyMessage(msg.content)}
                        className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                        title="Copy message"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                ))}
                {streamingText && (
                  <div className="mr-8 rounded-lg bg-accent px-3 py-2 text-sm text-foreground">
                    <div className="whitespace-pre-wrap">{streamingText}</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend()}
                    placeholder="Ask about your schema..."
                    className="flex-1 rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                    disabled={isLoading}
                  />
                  {isLoading ? (
                    <button
                      onClick={handleStop}
                      className="rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-500"
                      title="Stop generating"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
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
                        <p className="text-xs text-indigo-300">
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
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
