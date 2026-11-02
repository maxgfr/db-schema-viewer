"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Key, Eye, EyeOff, Server, Loader2, Zap, Check, AlertTriangle, Search, Globe } from "lucide-react";
import { ENDPOINT_PRESETS, liveCatalog, RESPONSE_LANGUAGES } from "llm-connect";
import { useLlmStore } from "llm-connect/react";
import { useTranslation } from "@/lib/i18n/context";
import { aiSettingsStorage, wereAISettingsKept } from "@/lib/storage/ai-settings";

const OLLAMA = ENDPOINT_PRESETS.ollama;
const LM_STUDIO = ENDPOINT_PRESETS.lmstudio;

// Built in the browser from models.dev on first open, shared by every dialog;
// the models.json written at build time is the fallback.
const catalog = liveCatalog({ fallbackUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models.json` });

const SAVE_ERRORS = {
  incomplete: "settings.fillEndpointAndModel",
  "invalid-endpoint": "settings.invalidEndpoint",
  "insecure-endpoint": "settings.insecureEndpoint",
} as const;

/* ---------- Component ---------- */

interface APIKeySettingsProps {
  onClose: () => void;
}

export function APIKeySettings({ onClose }: APIKeySettingsProps) {
  const { t } = useTranslation();
  const { state, store } = useLlmStore({ catalog, storage: aiSettingsStorage });
  const [showKey, setShowKey] = useState(false);

  const { draft, search: searchTerm, recommendedModel } = state;
  const useCustomEndpoint = draft.custom;
  const { customEndpoint, customModel, model, providerId, rememberKey, language } = draft;
  const apiKey = state.apiKey;
  const isLoadingCatalog = state.catalogStatus === "idle" || state.catalogStatus === "loading";
  const catalogError = state.catalogStatus === "error";
  const modelOptions = state.models;
  const providerModelCount = state.provider ? Object.keys(state.provider.models).length : 0;

  // Download the catalog and load the saved settings
  useEffect(() => {
    store.open();
    store.load().catch((err) => {
      console.error("Failed to load AI settings:", err);
    });
  }, [store]);

  const handleSave = async () => {
    try {
      const result = await store.save();
      if (!result.ok) {
        toast.error(t(SAVE_ERRORS[result.reason]));
        return;
      }
    } catch (err) {
      console.error("Failed to save AI settings:", err);
      toast.error(err instanceof Error ? err.message : String(err));
      return;
    }
    // They apply to this page either way; say so when the browser did not keep them.
    if (wereAISettingsKept()) toast.success(t("settings.saved"));
    else toast.warning(t("settings.notKept"));
    onClose();
  };

  const handleClear = async () => {
    try {
      await store.clear();
    } catch (err) {
      console.error("Failed to clear AI settings:", err);
      toast.error(err instanceof Error ? err.message : String(err));
      return;
    }
    toast.success(t("settings.cleared"));
  };

  const handleTestConnection = async () => {
    if (!apiKey && !useCustomEndpoint) {
      toast.error(t("settings.enterApiKeyFirst"));
      return;
    }
    if (useCustomEndpoint && (!customEndpoint.trim() || !customModel.trim())) {
      toast.error(t("settings.fillEndpointAndModel"));
      return;
    }

    const result = await store.test();
    if (result.ok) {
      toast.success(t("settings.connectionSuccessful"));
    } else if (result.reason === "cors") {
      toast.error(t("settings.connectionFailed"), {
        description: t("settings.connectionFailedCors"),
      });
    } else if (result.reason === "insecure") {
      toast.error(t("settings.insecureEndpoint"));
    } else {
      toast.error(result.message ?? t("settings.connectionFailed"));
    }
  };

  const modalContent = (
    <>
      <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          // Fixed height: only the content scrolls, so the footer buttons never
          // move when the model list arrives
          className="animate-scale-in pointer-events-auto flex h-[min(90vh,52rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/20 p-2">
                <Key className="h-5 w-5 text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">{t("settings.title")}</h2>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            {/* Security notice */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              {t("settings.securityNotice")}
            </div>

            {/* Custom endpoint toggle */}
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={useCustomEndpoint}
                onChange={(e) => store.toggleCustom(e.target.checked)}
                className="rounded border-border"
              />
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{t("settings.useCustomEndpoint")}</span>
            </label>

            {useCustomEndpoint ? (
              <div className="space-y-3">
                {/* Preset buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => store.applyPreset(OLLAMA)}
                    className={`flex-1 rounded-lg border p-2 text-center text-sm font-medium transition-all ${
                      customEndpoint === OLLAMA.endpoint
                        ? "border-emerald-500 bg-emerald-500/15 text-foreground"
                        : "border-border bg-accent text-foreground hover:border-emerald-500/50"
                    }`}
                  >
                    <Server className="mx-auto mb-1 h-4 w-4" />
                    Ollama
                  </button>
                  <button
                    type="button"
                    onClick={() => store.applyPreset(LM_STUDIO)}
                    className={`flex-1 rounded-lg border p-2 text-center text-sm font-medium transition-all ${
                      customEndpoint === LM_STUDIO.endpoint
                        ? "border-emerald-500 bg-emerald-500/15 text-foreground"
                        : "border-border bg-accent text-foreground hover:border-emerald-500/50"
                    }`}
                  >
                    <Server className="mx-auto mb-1 h-4 w-4" />
                    LM Studio
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-foreground">{t("settings.apiBaseUrl")}</label>
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => store.setEndpoint(e.target.value)}
                    placeholder={t("settings.apiBaseUrlPlaceholder")}
                    className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("settings.apiBaseUrlHint")}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-foreground">{t("settings.modelName")}</label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => store.setCustomModel(e.target.value)}
                    placeholder={t("settings.modelNamePlaceholder")}
                    className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Provider */}
                <div>
                  <label className="mb-1 block text-sm text-foreground">{t("settings.provider")}</label>
                  {isLoadingCatalog ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-accent px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("settings.loadingProviders")}
                    </div>
                  ) : catalogError ? (
                    <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                      <span>{t("settings.catalogError")}</span>
                      <button
                        type="button"
                        onClick={store.retryCatalog}
                        className="rounded-md border border-amber-500/40 px-2 py-1 text-xs font-medium hover:bg-amber-500/10"
                      >
                        {t("settings.retry")}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={providerId}
                      // Switches to the provider's recommended model, or its first one
                      onChange={(e) => store.selectProvider(e.target.value)}
                      className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground focus:outline-none"
                    >
                      {state.providers.recommended.length > 0 && (
                        <optgroup label={t("settings.recommended")}>
                          {state.providers.recommended.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {state.providers.others.length > 0 && (
                        <optgroup label={t("settings.otherProviders")}>
                          {state.providers.others.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                  {state.provider && !state.isRecommendedProvider && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <p className="text-xs text-amber-400">
                        {t("settings.openAiCompatibleWarning")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Model */}
                <div>
                  <label className="mb-1 block text-sm text-foreground">{t("settings.model")}</label>

                  {/* Recommended model badge */}
                  {recommendedModel && (
                    <div className="mb-2">
                      <div className="mb-1 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        <span className="text-[10px] font-semibold tracking-wide text-emerald-400 uppercase">{t("settings.recommended")}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => store.selectModel(recommendedModel.id)}
                        className={`w-full rounded-lg border p-2.5 text-left text-sm transition-all ${
                          model === recommendedModel.id
                            ? "border-emerald-500 bg-emerald-500/15 text-foreground"
                            : "border-emerald-500/40 bg-emerald-500/5 text-foreground hover:border-emerald-500 hover:bg-emerald-500/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{recommendedModel.name}</span>
                          {model === recommendedModel.id && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Model search */}
                  {providerModelCount > 5 && (
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => store.setSearch(e.target.value)}
                        placeholder={t("settings.searchModels")}
                        className="w-full rounded-lg border border-border bg-accent pl-8 pr-3 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Model list */}
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {modelOptions.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => store.selectModel(m.id)}
                        className={`w-full rounded-lg border p-2.5 text-left text-sm transition-all ${
                          model === m.id
                            ? "border-indigo-500 bg-indigo-500/15 text-foreground"
                            : "border-border bg-accent text-foreground hover:border-indigo-500/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{m.name}</span>
                          {model === m.id && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
                        </div>
                        <div className="mt-1 flex gap-1.5 text-[10px] text-muted-foreground">
                          {m.tool_call && (
                            <span className="rounded bg-accent px-1.5 py-0.5 border border-border">Tools</span>
                          )}
                          {m.reasoning && (
                            <span className="rounded bg-accent px-1.5 py-0.5 border border-border">Reasoning</span>
                          )}
                        </div>
                      </button>
                    ))}
                    {modelOptions.length === 0 && !isLoadingCatalog && (
                      <p className="py-2 text-center text-xs text-muted-foreground">
                        {searchTerm ? t("settings.noModelsMatchSearch") : t("settings.noModelsAvailable")}
                      </p>
                    )}
                    {isLoadingCatalog && (
                      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("settings.loadingModels")}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* API Key */}
            <div>
              <label className="mb-1 block text-sm text-foreground">
                {useCustomEndpoint ? t("settings.apiKeyOptional") : t("settings.apiKey")}
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => store.setApiKey(e.target.value)}
                  placeholder={t("settings.apiKeyPlaceholder")}
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
                {t("settings.keyStorageInfo")}
              </p>
              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={rememberKey}
                  onChange={(e) => store.setRememberKey(e.target.checked)}
                  className="mt-0.5 rounded border-border"
                />
                <span>
                  <span className="block text-sm text-foreground">{t("settings.rememberKey")}</span>
                  <span className="block text-xs text-muted-foreground">{t("settings.rememberKeyHint")}</span>
                </span>
              </label>
            </div>

            {/* Language */}
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-foreground">
                <Globe className="h-4 w-4 text-muted-foreground" />
                {t("settings.language")}
              </label>
              <select
                value={language}
                onChange={(e) => store.setLanguage(e.target.value)}
                className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground focus:outline-none"
              >
                {RESPONSE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("settings.languageHint")}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 gap-3 border-t border-border px-6 py-4">
            <button
              onClick={handleClear}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              {t("common.clear")}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleTestConnection}
              disabled={state.testing}
              className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              {state.testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {t("settings.test")}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={!state.canSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
