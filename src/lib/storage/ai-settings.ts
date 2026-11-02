import type { AISettings } from "db-schema-toolkit/ai";
import { secureStorage, toLanguageCode, type SettingsStorage } from "llm-connect";

export type { AISettings } from "db-schema-toolkit/ai";

/**
 * AI settings storage, on llm-connect's secureStorage.
 *
 * Non-secret settings live in localStorage. The API key is never stored in
 * clear text: it is encrypted with AES-GCM under a non-extractable CryptoKey
 * kept in IndexedDB. When "remember" is on, the ciphertext goes to IndexedDB;
 * otherwise to sessionStorage, so the key survives a reload and is gone with
 * the tab. A dump of browser storage therefore only yields opaque bytes.
 *
 * Code running inside the page (an active XSS) can still ask the browser to
 * decrypt; the Content-Security-Policy is what protects against that case.
 *
 * Every name carries the app's name: maxgfr.github.io is one origin for all
 * the account's project pages, so their storage is shared.
 */

export interface StoredAISettings extends AISettings {
  rememberKey: boolean;
}

interface SaveOptions {
  rememberKey: boolean;
}

const SETTINGS_KEY = "db-schema-viewer:ai-settings";
const DB_NAME = "db-schema-viewer-secrets";
/** Names older versions used, moved once to the ones above. */
const LEGACY_SETTINGS_KEY = "db-sv-ai-settings";
const LEGACY_DB_NAME = "db-sv-secrets";
const LEGACY_COOKIE_PREFIX = "db-sv-";
const LEGACY_COOKIE_KEYS = [
  "api-key", "model", "provider-id", "provider-name",
  "provider-npm", "provider-api", "custom-endpoint", "custom-model",
  "language",
];

const createStorage = () => secureStorage({ prefsKey: SETTINGS_KEY, dbName: DB_NAME });
let storage = createStorage();
/** Whether the last save could be read back from storage. */
let lastSaveKept = true;

/** Drops the decrypted key kept in memory, as a page reload would. */
export function resetAISettingsCacheForTests(): void {
  storage = createStorage();
  lastSaveKept = true;
}

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/* ---------- Older names ---------- */

const legacyStorage = () => secureStorage({ prefsKey: LEGACY_SETTINGS_KEY, dbName: LEGACY_DB_NAME });

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Moves settings saved under the old `db-sv-*` names: decrypted with the old
 * key, saved again (encrypted) under the new names, and the old copy erased
 * once the new one reads back. Runs again harmlessly until it succeeds.
 */
async function migrateLegacyNames(): Promise<void> {
  if (readItem(SETTINGS_KEY) !== null || readItem(LEGACY_SETTINGS_KEY) === null) return;
  const legacy = legacyStorage();
  const saved = await legacy.loadDraft?.();
  if (!saved) return;
  const { rememberKey, ...settings } = saved as AISettings & { rememberKey?: boolean };
  if (!(await saveAISettings(settings, { rememberKey: rememberKey === true }))) return;
  await legacy.clear();
  await deleteDatabase(LEGACY_DB_NAME);
}

/* ---------- Legacy cookies ---------- */

function readLegacyCookies(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const entry of document.cookie.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    if (!name.startsWith(LEGACY_COOKIE_PREFIX)) continue;
    values[name.slice(LEGACY_COOKIE_PREFIX.length)] = decodeURIComponent(entry.slice(separator + 1).trim());
  }
  return values;
}

function deleteLegacyCookies(): void {
  for (const key of LEGACY_COOKIE_KEYS) {
    document.cookie = `${LEGACY_COOKIE_PREFIX}${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
  }
}

async function migrateLegacyCookies(): Promise<void> {
  const legacy = readLegacyCookies();
  if (Object.keys(legacy).length === 0) return;
  const apiKey = legacy["api-key"] ?? "";
  if (apiKey || legacy["custom-endpoint"]) {
    await saveAISettings(
      {
        apiKey,
        model: legacy.model ?? "",
        providerId: legacy["provider-id"] ?? "openai",
        providerName: legacy["provider-name"],
        providerNpm: legacy["provider-npm"],
        providerApi: legacy["provider-api"],
        customEndpoint: legacy["custom-endpoint"],
        customModel: legacy["custom-model"],
        language: legacy.language,
      },
      { rememberKey: true },
    );
  }
  deleteLegacyCookies();
}

/* ---------- API ---------- */

/** Saves the settings; false when the browser did not keep them (storage full or blocked). */
export async function saveAISettings(settings: AISettings, { rememberKey }: SaveOptions): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const language = settings.language ? toLanguageCode(settings.language) : undefined;
  const next = { ...settings, language };
  await storage.save(next, { rememberKey });
  // llm-connect 1.x ignores a refused write: read the settings back, the key included.
  const stored = await createStorage().loadDraft?.().catch(() => null);
  const { apiKey, ...prefs } = next;
  lastSaveKept = stored?.apiKey === apiKey
    && readItem(SETTINGS_KEY) === JSON.stringify({ ...prefs, rememberKey });
  return lastSaveKept;
}

/** Whether the last save was kept; when false the settings only last for this page. */
export function wereAISettingsKept(): boolean {
  return lastSaveKept;
}

/** Saved settings that can call a model: a key, or a custom endpoint with its model. */
export async function loadAISettings(): Promise<StoredAISettings | null> {
  if (typeof window === "undefined") return null;
  await migrateLegacyNames();
  await migrateLegacyCookies();
  return withLanguageCode(await storage.load());
}

/** Saved settings even when the key is missing, so the settings form can be prefilled. */
export async function loadAISettingsDraft(): Promise<StoredAISettings | null> {
  if (typeof window === "undefined") return null;
  await migrateLegacyNames();
  await migrateLegacyCookies();
  return withLanguageCode((await storage.loadDraft?.()) ?? null);
}

// Versions before 2.1 stored the language by name ("French")
function withLanguageCode(saved: (AISettings & { rememberKey?: boolean }) | null): StoredAISettings | null {
  if (!saved) return null;
  return {
    ...saved,
    rememberKey: saved.rememberKey === true,
    ...(saved.language ? { language: toLanguageCode(saved.language) } : {}),
  };
}

export async function clearAISettings(): Promise<void> {
  if (typeof window === "undefined") return;
  deleteLegacyCookies();
  await storage.clear();
  // A copy under the older names, if moving it never succeeded.
  if (readItem(LEGACY_SETTINGS_KEY) !== null) {
    await legacyStorage().clear();
    await deleteDatabase(LEGACY_DB_NAME);
  }
}

/** The storage above, for llm-connect's settings store. */
export const aiSettingsStorage: SettingsStorage = {
  load: loadAISettings,
  loadDraft: loadAISettingsDraft,
  save: async (settings, options) => { await saveAISettings(settings, options); },
  clear: clearAISettings,
};
