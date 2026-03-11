import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveAISettings, loadAISettings, clearAISettings, type AISettings } from "@/lib/storage/cookie-storage";
import Cookies from "js-cookie";

vi.mock("js-cookie", () => {
  const store: Record<string, string> = {};
  return {
    default: {
      set: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      get: vi.fn((key: string) => store[key]),
      remove: vi.fn((key: string) => {
        delete store[key];
      }),
      _store: store,
    },
  };
});

function clearStore() {
  const store = (Cookies as unknown as { _store: Record<string, string> })._store;
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}

const testSettings: AISettings = {
  apiKey: "sk-test-key-123",
  model: "gpt-4o",
  providerId: "openai",
  providerName: "OpenAI",
  providerNpm: "@ai-sdk/openai",
  providerApi: "https://api.openai.com/v1",
  customEndpoint: undefined,
  customModel: undefined,
};

describe("cookie-storage", () => {
  beforeEach(() => {
    clearStore();
    vi.clearAllMocks();
  });

  it("saves and loads AI settings", () => {
    saveAISettings(testSettings);
    const loaded = loadAISettings();
    expect(loaded).not.toBeNull();
    expect(loaded!.apiKey).toBe("sk-test-key-123");
    expect(loaded!.model).toBe("gpt-4o");
    expect(loaded!.providerId).toBe("openai");
  });

  it("returns null when no settings saved", () => {
    const loaded = loadAISettings();
    expect(loaded).toBeNull();
  });

  it("clears all settings", () => {
    saveAISettings(testSettings);
    clearAISettings();
    const loaded = loadAISettings();
    expect(loaded).toBeNull();
  });

  it("uses prefix for all cookie keys", () => {
    saveAISettings(testSettings);
    expect(Cookies.set).toHaveBeenCalledWith(
      "db-sv-api-key",
      "sk-test-key-123",
      expect.any(Object)
    );
    expect(Cookies.set).toHaveBeenCalledWith(
      "db-sv-model",
      "gpt-4o",
      expect.any(Object)
    );
  });

  it("saves custom endpoint when provided", () => {
    const custom: AISettings = {
      ...testSettings,
      customEndpoint: "http://localhost:11434/v1",
      customModel: "llama3",
    };
    saveAISettings(custom);
    expect(Cookies.set).toHaveBeenCalledWith(
      "db-sv-custom-endpoint",
      "http://localhost:11434/v1",
      expect.any(Object)
    );
    expect(Cookies.set).toHaveBeenCalledWith(
      "db-sv-custom-model",
      "llama3",
      expect.any(Object)
    );
  });

  it("does not save optional fields when undefined", () => {
    const minimal: AISettings = {
      apiKey: "key",
      model: "gpt-4o",
      providerId: "openai",
    };
    saveAISettings(minimal);
    // Should NOT have called set for optional keys
    const setCalls = (Cookies.set as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(setCalls).not.toContain("db-sv-custom-endpoint");
    expect(setCalls).not.toContain("db-sv-custom-model");
  });

  it("defaults model and provider when loading partial data", () => {
    (Cookies as unknown as { _store: Record<string, string> })._store["db-sv-api-key"] = "my-key";
    const loaded = loadAISettings();
    expect(loaded).not.toBeNull();
    expect(loaded!.apiKey).toBe("my-key");
    expect(loaded!.model).toBe("gpt-4o");
    expect(loaded!.providerId).toBe("openai");
  });
});
