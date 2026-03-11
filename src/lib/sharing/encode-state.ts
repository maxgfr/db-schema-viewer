import lzString from "lz-string";
import type { Diagram } from "@/lib/domain";

export function encodeState(diagram: Diagram): string {
  const json = JSON.stringify(diagram);
  const compressed = lzString.compressToEncodedURIComponent(json);
  return compressed;
}

export function decodeState(encoded: string): Diagram | null {
  try {
    const json = lzString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as Diagram;
  } catch {
    // Try base64 fallback
    try {
      const json = atob(encoded);
      return JSON.parse(json) as Diagram;
    } catch {
      return null;
    }
  }
}

export function generateShareUrl(diagram: Diagram): string {
  const encoded = encodeState(diagram);
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${base}?d=${encoded}`;
}

export function getStateFromUrl(): Diagram | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("d");
  if (!encoded) return null;
  return decodeState(encoded);
}

export function estimateUrlSize(diagram: Diagram): number {
  const encoded = encodeState(diagram);
  return encoded.length;
}
