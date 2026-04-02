import lzString from "lz-string";
import { Diagram } from "../domain";

export interface SharedAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

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

