"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Send, Square, MessageSquare, Copy } from "lucide-react";
import type { ParsedDumpTable } from "@/lib/dump/dump-parser";
import { inferColumnTypes } from "@/lib/dump/data-types";
import { loadAISettings } from "@/lib/storage/cookie-storage";
import { queryData } from "@/lib/ai/ai-service";

interface DataChatProps {
  table: ParsedDumpTable;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS = [
  { label: "Summarize data", prompt: "Give me a concise summary of this dataset: key statistics, notable patterns, and any anomalies." },
  { label: "Find patterns", prompt: "What patterns or trends can you identify in this data?" },
  { label: "Data quality", prompt: "Analyze the data quality: are there missing values, outliers, or inconsistencies?" },
  { label: "Key insights", prompt: "What are the top 3 most interesting insights from this data?" },
];

export function DataChat({ table }: DataChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleCopy = useCallback((content: string) => {
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

    const columnTypes = inferColumnTypes(table.columns, table.rows);

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
        table,
        columnTypes,
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
        history,
        controller.signal
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
  }, [input, isLoading, messages, table]);

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !streamingText && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">Ask anything about your data</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {table.name}: {table.rows.length} rows, {table.columns.length} columns
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  className="rounded-lg border border-border bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/10"
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
                ? "ml-8 bg-indigo-500/20 text-foreground"
                : "mr-8 bg-accent text-foreground"
            }`}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
            {msg.role === "assistant" && (
              <button
                onClick={() => handleCopy(msg.content)}
                className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                title="Copy message"
                aria-label="Copy message"
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
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend()}
            placeholder={`Ask about ${table.name}...`}
            className="flex-1 rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              onClick={handleStop}
              className="rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-500"
              title="Stop generating"
              aria-label="Stop generating"
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
