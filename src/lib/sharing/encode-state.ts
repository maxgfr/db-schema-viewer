import lzString from "lz-string";
import type { Diagram } from "db-schema-toolkit";
import { encodeState, decodeState } from "db-schema-toolkit";
import type { SharedAnnotation } from "db-schema-toolkit";

export { encodeState, decodeState };
export type { SharedAnnotation };

export interface SharedViewSettings {
  erdNotation?: "crowsfoot" | "uml" | "chen";
  coloredEdges?: boolean;
}

/**
 * Build a shareable URL with the diagram compressed in the `#d=` hash fragment.
 * Uses hash instead of query param so the data is never sent to the server,
 * avoiding HTTP 414 "URI Too Long" errors on large schemas.
 */
export function generateShareUrl(
  diagram: Diagram,
  annotations?: SharedAnnotation[],
  viewSettings?: SharedViewSettings,
): string {
  const compressed = encodeState(diagram);
  const base = typeof window !== "undefined"
    ? window.location.origin + window.location.pathname
    : "";
  let url = `${base}#d=${compressed}`;
  if (annotations && annotations.length > 0) {
    const notesJson = JSON.stringify(annotations);
    const notesCompressed = lzString.compressToEncodedURIComponent(notesJson);
    url += `&n=${notesCompressed}`;
  }
  if (viewSettings && (viewSettings.erdNotation !== "crowsfoot" || viewSettings.coloredEdges)) {
    const viewJson = JSON.stringify(viewSettings);
    const viewCompressed = lzString.compressToEncodedURIComponent(viewJson);
    url += `&v=${viewCompressed}`;
  }
  return url;
}

/**
 * Read diagram from the `#d=` hash fragment in the URL.
 */
export function getStateFromUrl(): {
  diagram: Diagram;
  annotations: SharedAnnotation[];
  viewSettings: SharedViewSettings;
} | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const dMatch = hash.match(/#d=([^&]+)/);
  if (!dMatch?.[1]) return null;
  const diagram = decodeState(decodeURIComponent(dMatch[1]));
  if (!diagram) return null;

  let annotations: SharedAnnotation[] = [];
  const nMatch = hash.match(/&n=([^&]+)/);
  if (nMatch?.[1]) {
    try {
      const json = lzString.decompressFromEncodedURIComponent(decodeURIComponent(nMatch[1]));
      if (json) annotations = JSON.parse(json);
    } catch {}
  }

  let viewSettings: SharedViewSettings = {};
  const vMatch = hash.match(/&v=([^&]+)/);
  if (vMatch?.[1]) {
    try {
      const json = lzString.decompressFromEncodedURIComponent(decodeURIComponent(vMatch[1]));
      if (json) viewSettings = JSON.parse(json);
    } catch {}
  }

  return { diagram, annotations, viewSettings };
}

export function estimateUrlSize(diagram: Diagram): number {
  return generateShareUrl(diagram).length;
}
