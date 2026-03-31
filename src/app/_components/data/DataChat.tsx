"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Send, Square, MessageSquare, Copy, RotateCcw } from "lucide-react";
import type { ParsedDumpTable } from "@/lib/dump/dump-parser";
import { loadAISettings } from "@/lib/storage/cookie-storage";
import { queryData } from "@/lib/ai/ai-service";
import { MarkdownContent } from "../shared/MarkdownContent";
import { useTranslation } from "@/lib/i18n/context";

export type { DataChatMessage } from "./DataExplorerContext";
import type { DataChatMessage } from "./DataExplorerContext";

type MessageUpdater = DataChatMessage[] | ((prev: DataChatMessage[]) => DataChatMessage[]);

interface DataChatProps {
  tables: ParsedDumpTable[];
  messages: DataChatMessage[];
  onMessagesChange: (update: MessageUpdater) => void;
  chatKey: string;
}

const SINGLE_TABLE_ACTIONS = [
  { labelKey: "dataChat.summarize", prompt: "Give me a concise summary of this dataset: key statistics, notable patterns, and any anomalies." },
  { labelKey: "dataChat.findPatterns", prompt: "What patterns or trends can you identify in this data?" },
  { labelKey: "dataChat.dataQuality", prompt: "Analyze the data quality: are there missing values, outliers, or inconsistencies?" },
  { labelKey: "dataChat.keyInsights", prompt: "What are the top 3 most interesting insights from this data?" },
];

const MULTI_TABLE_ACTIONS = [
  { labelKey: "dataChat.overview", prompt: "Give me an overview of all tables: key statistics, sizes, and what each table seems to contain." },
  { labelKey: "dataChat.crossTablePatterns", prompt: "Identify relationships and patterns across the different tables. Are there foreign key links or shared columns?" },
  { labelKey: "dataChat.dataQuality", prompt: "Analyze the data quality across all tables: missing values, inconsistencies, and potential issues." },
  { labelKey: "dataChat.keyInsights", prompt: "What are the top 5 most interesting insights from this entire dataset?" },
];

export function DataChat({ tables, messages, onMessagesChange, chatKey }: DataChatProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");
  const streamChatKeyRef = useRef<string | null>(null);

  // Only show streaming UI for the conversation that started it
  const isActiveStream = streamChatKeyRef.current === chatKey;

  const isMultiTable = tables.length > 1;
  const quickActions = isMultiTable ? MULTI_TABLE_ACTIONS : SINGLE_TABLE_ACTIONS;

  const contextLabel = useMemo(() => {
    if (tables.length === 1) {
      return `${tables[0]!.name}: ${tables[0]!.rows.length} rows, ${tables[0]!.columns.length} columns`;
    }
    const totalRows = tables.reduce((sum, t) => sum + t.rows.length, 0);
    return `${tables.length} tables, ${totalRows} total rows`;
  }, [tables]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleCopy = useCallback((content: string) => {
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
    onMessagesChange((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);
    setStreamingText("");
    streamingTextRef.current = "";
    streamChatKeyRef.current = chatKey;

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

      await queryData(
        settings,
        tables,
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
              onMessagesChange((prev) => [
                ...prev,
                { role: "assistant", content: partial + "\n\n" + t("ai.stopped") },
              ]);
            }
          } else {
            onMessagesChange((prev) => [
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
          onMessagesChange((prev) => [...prev, { role: "assistant", content: partial + "\n\n" + t("ai.stopped") }]);
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
  }, [input, isLoading, messages, tables, onMessagesChange, chatKey, t]);

  const placeholder = isMultiTable
    ? t("dataChat.askAllTables", { count: tables.length })
    : t("dataChat.askAboutTable", { name: tables[0]?.name ?? "data" });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !(isActiveStream && streamingText) && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("dataChat.askAnything")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{contextLabel}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((action) => (
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
                onClick={() => handleCopy(msg.content)}
                className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                title={t("common.copyMessage")}
                aria-label={t("common.copyMessage")}
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
        {isActiveStream && streamingText && (
          <div className="mr-8 rounded-lg bg-accent px-3 py-2 text-sm text-foreground">
            <MarkdownContent content={streamingText} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => onMessagesChange([])}
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
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
            disabled={isActiveStream && isLoading}
          />
          {isActiveStream && isLoading ? (
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
    </div>
  );
}
