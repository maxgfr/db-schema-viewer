import { describe, it, expect, beforeEach } from "vitest";
import { encodeState, decodeState, estimateUrlSize, generateShareUrl, getStateFromUrl } from "@/lib/sharing/encode-state";
import type { Diagram } from "@/lib/domain";

const sampleDiagram: Diagram = {
  id: "test-123",
  name: "Test Schema",
  databaseType: "postgresql",
  tables: [
    {
      id: "t1",
      name: "users",
      fields: [
        { id: "f1", name: "id", type: "SERIAL", primaryKey: true, unique: false, nullable: false, isForeignKey: false },
        { id: "f2", name: "email", type: "VARCHAR(255)", primaryKey: false, unique: true, nullable: false, isForeignKey: false },
      ],
      indexes: [],
      x: 0,
      y: 0,
      isView: false,
    },
  ],
  relationships: [],
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("encodeState / decodeState", () => {
  it("round-trips a diagram", () => {
    const encoded = encodeState(sampleDiagram);
    const decoded = decodeState(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(sampleDiagram.id);
    expect(decoded!.name).toBe(sampleDiagram.name);
    expect(decoded!.tables).toHaveLength(1);
    expect(decoded!.tables[0]!.name).toBe("users");
  });

  it("produces a compressed string shorter than raw JSON", () => {
    const encoded = encodeState(sampleDiagram);
    const rawJson = JSON.stringify(sampleDiagram);
    expect(encoded.length).toBeLessThan(rawJson.length);
  });

  it("returns null for invalid encoded string", () => {
    expect(decodeState("totally-invalid-data")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeState("")).toBeNull();
  });
});

describe("estimateUrlSize", () => {
  it("returns a positive number", () => {
    const size = estimateUrlSize(sampleDiagram);
    expect(size).toBeGreaterThan(0);
  });
});

describe("generateShareUrl", () => {
  it("uses hash fragment instead of query param", () => {
    const url = generateShareUrl(sampleDiagram);
    expect(url).toContain("#d=");
    expect(url).not.toContain("?d=");
  });

  it("produces a URL that round-trips via decode", () => {
    const url = generateShareUrl(sampleDiagram);
    const hash = url.substring(url.indexOf("#"));
    const match = hash.match(/^#d=(.+)/);
    expect(match).not.toBeNull();
    const decoded = decodeState(decodeURIComponent(match![1]!));
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(sampleDiagram.id);
    expect(decoded!.tables).toHaveLength(1);
  });
});

describe("getStateFromUrl", () => {
  beforeEach(() => {
    // Reset hash between tests
    window.location.hash = "";
  });

  it("reads diagram from hash fragment", () => {
    const compressed = encodeState(sampleDiagram);
    window.location.hash = `#d=${compressed}`;
    const result = getStateFromUrl();
    expect(result).not.toBeNull();
    expect(result!.id).toBe(sampleDiagram.id);
    expect(result!.name).toBe(sampleDiagram.name);
  });

  it("returns null when no hash is present", () => {
    window.location.hash = "";
    expect(getStateFromUrl()).toBeNull();
  });

  it("returns null for corrupted hash data", () => {
    window.location.hash = "#d=garbage-data";
    expect(getStateFromUrl()).toBeNull();
  });
});
