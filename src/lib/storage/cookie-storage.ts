import Cookies from "js-cookie";

export interface AISettings {
  apiKey: string;
  model: string;
  providerId: string;
  providerName?: string;
  providerNpm?: string;
  providerApi?: string;
  customEndpoint?: string;
  customModel?: string;
}

const PREFIX = "db-sv-";
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  expires: 30,
  secure: !isLocalhost,
  sameSite: "strict",
};

export function saveAISettings(settings: AISettings): void {
  if (typeof window === "undefined") return;
  Cookies.set(`${PREFIX}api-key`, settings.apiKey, COOKIE_OPTIONS);
  Cookies.set(`${PREFIX}model`, settings.model, COOKIE_OPTIONS);
  Cookies.set(`${PREFIX}provider-id`, settings.providerId, COOKIE_OPTIONS);
  if (settings.providerName) {
    Cookies.set(`${PREFIX}provider-name`, settings.providerName, COOKIE_OPTIONS);
  }
  if (settings.providerNpm) {
    Cookies.set(`${PREFIX}provider-npm`, settings.providerNpm, COOKIE_OPTIONS);
  }
  if (settings.providerApi) {
    Cookies.set(`${PREFIX}provider-api`, settings.providerApi, COOKIE_OPTIONS);
  }
  if (settings.customEndpoint) {
    Cookies.set(`${PREFIX}custom-endpoint`, settings.customEndpoint, COOKIE_OPTIONS);
  }
  if (settings.customModel) {
    Cookies.set(`${PREFIX}custom-model`, settings.customModel, COOKIE_OPTIONS);
  }
}

export function loadAISettings(): AISettings | null {
  if (typeof window === "undefined") return null;
  const apiKey = Cookies.get(`${PREFIX}api-key`);
  if (!apiKey) return null;
  return {
    apiKey,
    model: Cookies.get(`${PREFIX}model`) ?? "gpt-4o",
    providerId: Cookies.get(`${PREFIX}provider-id`) ?? "openai",
    providerName: Cookies.get(`${PREFIX}provider-name`),
    providerNpm: Cookies.get(`${PREFIX}provider-npm`),
    providerApi: Cookies.get(`${PREFIX}provider-api`),
    customEndpoint: Cookies.get(`${PREFIX}custom-endpoint`),
    customModel: Cookies.get(`${PREFIX}custom-model`),
  };
}

export function clearAISettings(): void {
  if (typeof window === "undefined") return;
  const keys = [
    "api-key", "model", "provider-id", "provider-name",
    "provider-npm", "provider-api", "custom-endpoint", "custom-model",
  ];
  for (const key of keys) {
    Cookies.remove(`${PREFIX}${key}`);
  }
}
