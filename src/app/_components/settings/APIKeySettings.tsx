"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Key, Eye, EyeOff, Server, Loader2, Zap } from "lucide-react";
import {
  loadAISettings,
  saveAISettings,
  clearAISettings,
  type AISettings,
} from "@/lib/storage/cookie-storage";
import { querySchema } from "@/lib/ai/ai-service";

interface APIKeySettingsProps {
  onClose: () => void;
}

export function APIKeySettings({ onClose }: APIKeySettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [providerId, setProviderId] = useState("openai");
  const [, setProviderNpm] = useState("@ai-sdk/openai");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [useCustomEndpoint, setUseCustomEndpoint] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const saved = loadAISettings();
    if (saved) {
      setApiKey(saved.apiKey);
      setModel(saved.model);
      setProviderId(saved.providerId);
      setProviderNpm(saved.providerNpm ?? "@ai-sdk/openai");
      setCustomEndpoint(saved.customEndpoint ?? "");
      setCustomModel(saved.customModel ?? "");
      setUseCustomEndpoint(!!saved.customEndpoint);
    }
  }, []);

  const PROVIDERS = [
    { id: "openai", name: "OpenAI", npm: "@ai-sdk/openai", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3-mini"] },
    { id: "anthropic", name: "Anthropic", npm: "@ai-sdk/anthropic", models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-6"] },
    { id: "google", name: "Google", npm: "@ai-sdk/google", models: ["gemini-2.5-pro", "gemini-2.5-flash"] },
    { id: "mistral", name: "Mistral", npm: "@ai-sdk/mistral", models: ["mistral-large-latest", "mistral-medium-latest"] },
  ];

  const currentProvider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0]!;

  const buildSettings = useCallback((): AISettings => {
    return {
      apiKey,
      model: useCustomEndpoint ? customModel : model,
      providerId,
      providerName: currentProvider.name,
      providerNpm: currentProvider.npm,
      customEndpoint: useCustomEndpoint ? customEndpoint : undefined,
      customModel: useCustomEndpoint ? customModel : undefined,
    };
  }, [apiKey, model, providerId, currentProvider, useCustomEndpoint, customEndpoint, customModel]);

  const handleSave = () => {
    const settings = buildSettings();
    saveAISettings(settings);
    toast.success("AI settings saved");
    onClose();
  };

  const handleClear = () => {
    clearAISettings();
    setApiKey("");
    toast.success("AI settings cleared");
  };

  const handleTestConnection = useCallback(async () => {
    const settings = buildSettings();
    if (!settings.apiKey && !useCustomEndpoint) {
      toast.error("Please enter an API key first");
      return;
    }
    if (useCustomEndpoint && (!customEndpoint.trim() || !customModel.trim())) {
      toast.error("Please fill in both the endpoint URL and model name");
      return;
    }

    setIsTesting(true);
    try {
      // Use a minimal diagram with a single table for the ping test
      const testDiagram = {
        id: "test",
        name: "test",
        databaseType: "generic" as const,
        tables: [
          {
            id: "t1",
            name: "test",
            fields: [{ id: "f1", name: "id", type: "integer", primaryKey: true, unique: false, nullable: false, isForeignKey: false }],
            indexes: [],
            x: 0,
            y: 0,
            isView: false,
          },
        ],
        relationships: [],
        createdAt: new Date().toISOString(),
      };

      await querySchema(
        settings,
        testDiagram,
        "Say OK",
        () => {},
        () => {},
        []
      );
      toast.success("Connection successful!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsTesting(false);
    }
  }, [buildSettings, useCustomEndpoint, customEndpoint, customModel]);

  const modalContent = (
    <>
      <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/20 p-2">
                <Key className="h-5 w-5 text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">AI Settings</h2>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-5 p-6">
            {/* Security notice */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              <strong>100% client-side</strong> — your schema data and API keys never leave your browser.
              All AI calls go directly from your browser to the provider. No backend, no proxy, no telemetry.
              For full offline use, configure a local Ollama instance below.
            </div>

            {/* Custom endpoint toggle */}
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={useCustomEndpoint}
                onChange={(e) => setUseCustomEndpoint(e.target.checked)}
                className="rounded border-border"
              />
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Use Custom / Local Endpoint (Ollama, LM Studio, etc.)</span>
            </label>

            {useCustomEndpoint ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-foreground">API Base URL</label>
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ollama: <code className="rounded bg-accent px-1">http://localhost:11434/v1</code> — LM Studio: <code className="rounded bg-accent px-1">http://localhost:1234/v1</code>
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-foreground">Model Name</label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="llama3.2, mistral, qwen2.5, etc."
                    className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Provider */}
                <div>
                  <label className="mb-1 block text-sm text-foreground">Provider</label>
                  <select
                    value={providerId}
                    onChange={(e) => {
                      const p = PROVIDERS.find((p) => p.id === e.target.value)!;
                      setProviderId(p.id);
                      setProviderNpm(p.npm);
                      setModel(p.models[0]!);
                    }}
                    className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground focus:outline-none"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className="mb-1 block text-sm text-foreground">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground focus:outline-none"
                  >
                    {currentProvider.models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* API Key */}
            <div>
              <label className="mb-1 block text-sm text-foreground">
                API Key {useCustomEndpoint && "(optional)"}
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-lg border border-border bg-accent px-3 py-2 pr-10 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-accent"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Stored in a secure cookie (SameSite=Strict). Sent only to the AI provider you chose, directly from your browser.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-border px-6 py-4">
            <button
              onClick={handleClear}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              Clear
            </button>
            <div className="flex-1" />
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Test
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                useCustomEndpoint
                  ? !customEndpoint.trim() || !customModel.trim()
                  : !apiKey.trim()
              }
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
