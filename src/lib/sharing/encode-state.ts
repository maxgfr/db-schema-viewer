import lzString from "lz-string";
import { Diagram } from "@/lib/domain";

export function encodeState(diagram: Diagram): string {
  // Strip sourceContent and default/falsy values to minimize URL size (~33% smaller)
  const { sourceContent: _, ...shareable } = diagram;
  void _;
  const minimal = {
    ...shareable,
    updatedAt: undefined,
    tables: shareable.tables.map((t) => ({
      id: t.id,
      name: t.name,
      ...(t.schema ? { schema: t.schema } : {}),
      fields: t.fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        ...(f.primaryKey ? { primaryKey: true } : {}),
        ...(f.unique ? { unique: true } : {}),
        ...(f.nullable === false ? { nullable: false } : {}),
        ...(f.isForeignKey ? { isForeignKey: true } : {}),
        ...(f.default ? { default: f.default } : {}),
        ...(f.comment ? { comment: f.comment } : {}),
        ...(f.references ? { references: f.references } : {}),
      })),
      ...(t.indexes.length ? { indexes: t.indexes } : {}),
      x: t.x,
      y: t.y,
      ...(t.color ? { color: t.color } : {}),
      ...(t.isView ? { isView: true } : {}),
      ...(t.comment ? { comment: t.comment } : {}),
    })),
  };
  const json = JSON.stringify(minimal);
  return lzString.compressToEncodedURIComponent(json);
}

export function decodeState(encoded: string): Diagram | null {
  try {
    const json = lzString.decompressFromEncodedURIComponent(encoded);
    if (!json) {
      console.warn("[db-schema-viewer] lz-string decompression returned null (data may be corrupted or truncated)");
      return null;
    }
    const parsed = JSON.parse(json);
    return Diagram.parse(parsed);
  } catch (err) {
    console.warn("[db-schema-viewer] Primary decode failed:", err);
    // Try base64 fallback
    try {
      const json = atob(encoded);
      const parsed = JSON.parse(json);
      return Diagram.parse(parsed);
    } catch {
      return null;
    }
  }
}

/**
 * Build a shareable URL with the diagram compressed in the `?d=` param.
 * Uses encodeURIComponent (not URLSearchParams) to avoid `+` → space issues.
 */
export function generateShareUrl(diagram: Diagram): string {
  const compressed = encodeState(diagram);
  const base = typeof window !== "undefined"
    ? window.location.origin + window.location.pathname
    : "";
  return `${base}?d=${encodeURIComponent(compressed)}`;
}

/**
 * Read diagram from the `?d=` query param.
 * Uses regex + decodeURIComponent (not URLSearchParams) because
 * URLSearchParams decodes `+` as space, corrupting lz-string data.
 */
export function getStateFromUrl(): Diagram | null {
  if (typeof window === "undefined") return null;
  const match = window.location.search.match(/[?&]d=([^&]*)/);
  if (!match?.[1]) return null;
  const encoded = decodeURIComponent(match[1]);
  return decodeState(encoded);
}

export function estimateUrlSize(diagram: Diagram): number {
  return generateShareUrl(diagram).length;
}
