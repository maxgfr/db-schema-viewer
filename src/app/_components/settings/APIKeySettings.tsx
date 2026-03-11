"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Key, Eye, EyeOff, Server } from "lucide-react";
import {
  loadAISettings,
  saveAISettings,
  clearAISettings,
  type AISettings,
} from "@/lib/storage/cookie-storage";

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

  const handleSave = () => {
    const settings: AISettings = {
      apiKey,
      model: useCustomEndpoint ? customModel : model,
      providerId,
      providerName: currentProvider.name,
      providerNpm: currentProvider.npm,
      customEndpoint: useCustomEndpoint ? customEndpoint : undefined,
      customModel: useCustomEndpoint ? customModel : undefined,
    };
    saveAISettings(settings);
    toast.success("AI settings saved");
    onClose();
  };

  const handleClear = () => {
    clearAISettings();
    setApiKey("");
    toast.success("AI settings cleared");
  };

  const modalContent = (
    <>
      <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/20 p-2">
                <Key className="h-5 w-5 text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-white">AI Settings</h2>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-800">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-5 p-6">
            {/* Custom endpoint toggle */}
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={useCustomEndpoint}
                onChange={(e) => setUseCustomEndpoint(e.target.checked)}
                className="rounded border-slate-600"
              />
              <Server className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-200">Use Custom Endpoint</span>
            </label>

            {useCustomEndpoint ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-300">API Base URL</label>
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Model Name</label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="llama3.2, mistral, etc."
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Provider */}
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Provider</label>
                  <select
                    value={providerId}
                    onChange={(e) => {
                      const p = PROVIDERS.find((p) => p.id === e.target.value)!;
                      setProviderId(p.id);
                      setProviderNpm(p.npm);
                      setModel(p.models[0]!);
                    }}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none"
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
              <label className="mb-1 block text-sm text-slate-300">
                API Key {useCustomEndpoint && "(optional)"}
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-slate-700"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-500" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Stored securely in a cookie. Never sent to our servers.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-slate-700 px-6 py-4">
            <button
              onClick={handleClear}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Clear
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
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
