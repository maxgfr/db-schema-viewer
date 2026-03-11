"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  X,
  Send,
  Loader2,
  MessageSquare,
  Shield,
  AlertTriangle,
  Info,
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

export function AIPanel({ diagram, onClose }: AIPanelProps) {
  const [tab, setTab] = useState<"chat" | "challenge">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [challengeResult, setChallengeResult] = useState<ChallengeResponse | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const settings = loadAISettings();
    if (!settings) {
      toast.error("Please configure your AI API key first");
      return;
    }

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);
    setStreamingText("");

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
        (chunk) => setStreamingText((prev) => prev + chunk),
        (fullText) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullText },
          ]);
          setStreamingText("");
        },
        history
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, diagram]);

  const handleChallenge = useCallback(async () => {
    const settings = loadAISettings();
    if (!settings) {
      toast.error("Please configure your AI API key first");
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

  const severityIcon = (severity: SchemaIssue["severity"]) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case "info": return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const modalContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-950/70"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full max-w-lg">
        <div
          className="pointer-events-auto flex w-full flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <h2 className="text-lg font-bold text-white">AI Assistant</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-800">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setTab("chat")}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium ${
                tab === "chat"
                  ? "border-b-2 border-indigo-500 text-indigo-400"
                  : "text-slate-400 hover:text-white"
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
                  : "text-slate-400 hover:text-white"
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
                  <div className="py-8 text-center text-sm text-slate-500">
                    <p className="mb-2">Ask questions about your schema:</p>
                    <div className="space-y-1 text-xs">
                      <p>&quot;What indexes should I add?&quot;</p>
                      <p>&quot;Are there any normalization issues?&quot;</p>
                      <p>&quot;Explain the relationships&quot;</p>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "ml-8 bg-indigo-500/20 text-indigo-100"
                        : "mr-8 bg-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ))}
                {streamingText && (
                  <div className="mr-8 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200">
                    <div className="whitespace-pre-wrap">{streamingText}</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-slate-700 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Ask about your schema..."
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {!challengeResult && !isLoading && (
                <div className="flex flex-col items-center py-8">
                  <Shield className="mb-4 h-12 w-12 text-slate-600" />
                  <p className="mb-4 text-center text-sm text-slate-400">
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
                  <p className="text-sm text-slate-400">Analyzing your schema...</p>
                </div>
              )}

              {challengeResult && (
                <div className="space-y-4">
                  {/* Score */}
                  <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-center">
                    <div className="mb-1 text-3xl font-bold text-white">
                      {challengeResult.overallScore}/100
                    </div>
                    <p className="text-sm text-slate-400">
                      {challengeResult.summary}
                    </p>
                  </div>

                  {/* Issues */}
                  <div className="space-y-3">
                    {challengeResult.issues.map((issue, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          {severityIcon(issue.severity)}
                          <span className="text-xs font-medium uppercase text-slate-500">
                            {issue.category}
                          </span>
                          {issue.table && (
                            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                              {issue.table}
                              {issue.field ? `.${issue.field}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="mb-1 text-sm text-slate-300">
                          {issue.description}
                        </p>
                        <p className="text-xs text-indigo-300">
                          {issue.suggestion}
                        </p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleChallenge}
                    className="w-full rounded-xl border border-slate-600 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
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
