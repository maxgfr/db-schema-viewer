import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveAISettings,
  loadAISettings,
  loadAISettingsDraft,
  clearAISettings,
  resetAISettingsCacheForTests,
  wereAISettingsKept,
  type AISettings,
} from "@/lib/storage/ai-settings";
import { secureStorage } from "llm-connect";

const testSettings: AISettings = {
  apiKey: "test-key-123",
  model: "gpt-4o",
  providerId: "openai",
  providerName: "OpenAI",
  providerNpm: "@ai-sdk/openai",
  providerApi: "https://api.openai.com/v1",
  customEndpoint: undefined,
  customModel: undefined,
};

function clearCookies() {
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

async function readRawSecrets(dbName = "db-schema-viewer-secrets"): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.close();
        resolve([]);
        return;
      }
      const request = db.transaction("kv", "readonly").objectStore("kv").getAll();
      request.onsuccess = () => {
        db.close();
        resolve(request.result as unknown[]);
      };
      request.onerror = () => reject(request.error);
    };
  });
}

describe("ai-settings storage", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    localStorage.clear();
    sessionStorage.clear();
    clearCookies();
    resetAISettingsCacheForTests();
  });

  it("saves and loads AI settings", async () => {
    await saveAISettings(testSettings, { rememberKey: true });
    resetAISettingsCacheForTests();
    const loaded = await loadAISettings();
    expect(loaded).not.toBeNull();
    expect(loaded!.apiKey).toBe("test-key-123");
    expect(loaded!.model).toBe("gpt-4o");
    expect(loaded!.providerId).toBe("openai");
    expect(loaded!.rememberKey).toBe(true);
  });

  it("returns null when no settings are saved", async () => {
    expect(await loadAISettings()).toBeNull();
  });

  it("never writes the API key in clear text to localStorage, cookies or IndexedDB", async () => {
    await saveAISettings(testSettings, { rememberKey: true });
    expect(document.cookie).not.toContain("test-key-123");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key)).not.toContain("test-key-123");
    }
    const raw = await readRawSecrets();
    expect(raw.length).toBeGreaterThan(0);
    const cryptoKey = raw.find((value) => value instanceof CryptoKey) as CryptoKey | undefined;
    expect(cryptoKey?.extractable).toBe(false);
    expect(JSON.stringify(raw)).not.toContain("test-key-123");
    const blob = raw.find((value) => !(value instanceof CryptoKey)) as { ciphertext: ArrayBuffer };
    expect(new TextDecoder().decode(blob.ciphertext)).not.toContain("test-key-123");
  });

  it("keeps the key encrypted for the tab when rememberKey is false", async () => {
    await saveAISettings(testSettings, { rememberKey: false });
    expect((await loadAISettings())?.apiKey).toBe("test-key-123");
    expect((await readRawSecrets()).some((value) => !(value instanceof CryptoKey))).toBe(false);
    for (let i = 0; i < sessionStorage.length; i++) {
      expect(sessionStorage.getItem(sessionStorage.key(i)!)).not.toContain("test-key-123");
    }
    expect(sessionStorage.getItem("db-schema-viewer:ai-settings-key")).toContain("ciphertext");

    // A reload keeps it, closing the tab loses it
    resetAISettingsCacheForTests();
    expect((await loadAISettings())?.apiKey).toBe("test-key-123");
    sessionStorage.clear();
    resetAISettingsCacheForTests();
    expect(await loadAISettings()).toBeNull();
  });

  it("forgets a previously remembered key when rememberKey is turned off", async () => {
    await saveAISettings(testSettings, { rememberKey: true });
    await saveAISettings(testSettings, { rememberKey: false });
    const raw = await readRawSecrets();
    expect(raw.some((value) => !(value instanceof CryptoKey))).toBe(false);
  });

  it("clears previous provider metadata when switching to a minimal configuration", async () => {
    await saveAISettings(testSettings, { rememberKey: true });
    await saveAISettings({ apiKey: "test", model: "local", providerId: "custom" }, { rememberKey: true });
    const loaded = await loadAISettings();
    expect(loaded?.providerApi).toBeUndefined();
    expect(loaded?.providerNpm).toBeUndefined();
    expect(loaded?.providerName).toBeUndefined();
  });

  it("clears all settings", async () => {
    await saveAISettings(testSettings, { rememberKey: true });
    await clearAISettings();
    expect(await loadAISettings()).toBeNull();
    resetAISettingsCacheForTests();
    expect(await loadAISettings()).toBeNull();
  });

  it("loads a keyless custom endpoint such as a local Ollama", async () => {
    await saveAISettings(
      {
        apiKey: "",
        model: "llama3.2",
        providerId: "openai",
        customEndpoint: "http://localhost:11434/v1",
        customModel: "llama3.2",
        language: "French",
      },
      { rememberKey: true },
    );
    resetAISettingsCacheForTests();
    const loaded = await loadAISettings();
    expect(loaded?.apiKey).toBe("");
    expect(loaded?.customEndpoint).toBe("http://localhost:11434/v1");
    expect(loaded?.customModel).toBe("llama3.2");
    expect(loaded?.language).toBe("fr");
  });

  it("reads the language names stored before 2.1 as codes", async () => {
    localStorage.setItem(
      "db-schema-viewer:ai-settings",
      JSON.stringify({ model: "gpt-4o", providerId: "openai", language: "Japanese", rememberKey: false }),
    );
    expect((await loadAISettingsDraft())?.language).toBe("ja");
  });

  it("migrates legacy db-sv-* cookies once and deletes them", async () => {
    document.cookie = "db-sv-api-key=legacy-key; path=/";
    document.cookie = "db-sv-model=claude-sonnet; path=/";
    document.cookie = "db-sv-provider-id=anthropic; path=/";
    document.cookie = "db-sv-language=German; path=/";

    const loaded = await loadAISettings();
    expect(loaded?.apiKey).toBe("legacy-key");
    expect(loaded?.model).toBe("claude-sonnet");
    expect(loaded?.providerId).toBe("anthropic");
    expect(loaded?.language).toBe("de");
    expect(document.cookie).not.toContain("db-sv-");

    resetAISettingsCacheForTests();
    expect((await loadAISettings())?.apiKey).toBe("legacy-key");
  });

  it("moves settings saved under the db-sv-* names, key included, and erases the old copy", async () => {
    const legacy = secureStorage({ prefsKey: "db-sv-ai-settings", dbName: "db-sv-secrets" });
    await legacy.save({ ...testSettings, language: "fr" }, { rememberKey: true });

    const loaded = await loadAISettings();
    expect(loaded?.apiKey).toBe("test-key-123");
    expect(loaded?.model).toBe("gpt-4o");
    expect(loaded?.rememberKey).toBe(true);
    expect(localStorage.getItem("db-sv-ai-settings")).toBeNull();
    const databases = (await indexedDB.databases()).map((db) => db.name);
    expect(databases).not.toContain("db-sv-secrets");
    expect(await readRawSecrets()).not.toHaveLength(0);

    resetAISettingsCacheForTests();
    expect((await loadAISettings())?.apiKey).toBe("test-key-123");
  });

  it("moves a key kept for the tab only", async () => {
    const legacy = secureStorage({ prefsKey: "db-sv-ai-settings", dbName: "db-sv-secrets" });
    await legacy.save(testSettings, { rememberKey: false });
    expect((await loadAISettings())?.apiKey).toBe("test-key-123");
    expect(sessionStorage.getItem("db-sv-ai-settings-key")).toBeNull();
    expect(sessionStorage.getItem("db-schema-viewer:ai-settings-key")).toContain("ciphertext");
  });

  it("keeps the db-sv-* copy when the new one cannot be stored, and moves it later", async () => {
    const legacy = secureStorage({ prefsKey: "db-sv-ai-settings", dbName: "db-sv-secrets" });
    await legacy.save(testSettings, { rememberKey: true });
    const original = localStorage.setItem.bind(localStorage);
    const full = vi.spyOn(localStorage, "setItem").mockImplementation((key: string, value: string) => {
      if (key === "db-schema-viewer:ai-settings") throw new DOMException("Full", "QuotaExceededError");
      original(key, value);
    });
    try {
      await loadAISettings();
      expect(localStorage.getItem("db-sv-ai-settings")).not.toBeNull();
      expect(localStorage.getItem("db-schema-viewer:ai-settings")).toBeNull();
    } finally {
      full.mockRestore();
    }
    resetAISettingsCacheForTests();
    expect((await loadAISettings())?.apiKey).toBe("test-key-123");
    expect(localStorage.getItem("db-sv-ai-settings")).toBeNull();
  });

  it("reports settings the browser did not keep", async () => {
    expect(await saveAISettings(testSettings, { rememberKey: true })).toBe(true);
    expect(wereAISettingsKept()).toBe(true);
    const full = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    try {
      expect(await saveAISettings({ ...testSettings, model: "gpt-5" }, { rememberKey: true })).toBe(false);
      expect(wereAISettingsKept()).toBe(false);
    } finally {
      full.mockRestore();
    }
  });
});
