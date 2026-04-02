import { describe, it, expect, beforeEach } from "vitest";
import { encodeState, decodeState, estimateUrlSize, generateShareUrl, getStateFromUrl } from "@/lib/sharing/encode-state";
import type { Diagram } from "db-schema-toolkit";

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
    expect(result!.diagram.id).toBe(sampleDiagram.id);
    expect(result!.diagram.name).toBe(sampleDiagram.name);
    expect(result!.annotations).toEqual([]);
    expect(result!.viewSettings).toEqual({});
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

describe("view settings in shared URL", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("round-trips erdNotation and coloredEdges", () => {
    const url = generateShareUrl(sampleDiagram, undefined, { erdNotation: "uml", coloredEdges: true });
    expect(url).toContain("&v=");

    // Parse the hash to simulate getStateFromUrl
    const hash = url.substring(url.indexOf("#"));
    window.location.hash = hash;
    const result = getStateFromUrl();
    expect(result).not.toBeNull();
    expect(result!.viewSettings.erdNotation).toBe("uml");
    expect(result!.viewSettings.coloredEdges).toBe(true);
  });

  it("omits &v= when using default settings", () => {
    const url = generateShareUrl(sampleDiagram, undefined, { erdNotation: "crowsfoot", coloredEdges: false });
    expect(url).not.toContain("&v=");
  });

  it("includes &v= when only coloredEdges is true", () => {
    const url = generateShareUrl(sampleDiagram, undefined, { erdNotation: "crowsfoot", coloredEdges: true });
    expect(url).toContain("&v=");

    const hash = url.substring(url.indexOf("#"));
    window.location.hash = hash;
    const result = getStateFromUrl();
    expect(result).not.toBeNull();
    expect(result!.viewSettings.coloredEdges).toBe(true);
  });

  it("includes &v= when erdNotation is chen", () => {
    const url = generateShareUrl(sampleDiagram, undefined, { erdNotation: "chen", coloredEdges: false });
    expect(url).toContain("&v=");

    const hash = url.substring(url.indexOf("#"));
    window.location.hash = hash;
    const result = getStateFromUrl();
    expect(result).not.toBeNull();
    expect(result!.viewSettings.erdNotation).toBe("chen");
  });
});

describe("annotations in shared URL", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("round-trips annotations", () => {
    const annotations = [
      { id: "n1", text: "Important table", x: 100, y: 200, color: "0" },
      { id: "n2", text: "TODO: add index", x: 300, y: 400, color: "2" },
    ];
    const url = generateShareUrl(sampleDiagram, annotations);
    expect(url).toContain("&n=");

    const hash = url.substring(url.indexOf("#"));
    window.location.hash = hash;
    const result = getStateFromUrl();
    expect(result).not.toBeNull();
    expect(result!.annotations).toHaveLength(2);
    expect(result!.annotations[0]!.text).toBe("Important table");
    expect(result!.annotations[0]!.x).toBe(100);
    expect(result!.annotations[0]!.y).toBe(200);
    expect(result!.annotations[1]!.color).toBe("2");
  });

  it("omits &n= when no annotations", () => {
    const url = generateShareUrl(sampleDiagram, []);
    expect(url).not.toContain("&n=");
  });

  it("omits &n= when annotations is undefined", () => {
    const url = generateShareUrl(sampleDiagram, undefined);
    expect(url).not.toContain("&n=");
  });

  it("round-trips all three: diagram + annotations + viewSettings", () => {
    const annotations = [
      { id: "n1", text: "Note", x: 50, y: 75, color: "1" },
    ];
    const viewSettings = { erdNotation: "chen" as const, coloredEdges: true };
    const url = generateShareUrl(sampleDiagram, annotations, viewSettings);
    expect(url).toContain("#d=");
    expect(url).toContain("&n=");
    expect(url).toContain("&v=");

    const hash = url.substring(url.indexOf("#"));
    window.location.hash = hash;
    const result = getStateFromUrl();
    expect(result).not.toBeNull();
    expect(result!.diagram.id).toBe(sampleDiagram.id);
    expect(result!.annotations).toHaveLength(1);
    expect(result!.annotations[0]!.text).toBe("Note");
    expect(result!.viewSettings.erdNotation).toBe("chen");
    expect(result!.viewSettings.coloredEdges).toBe(true);
  });
});

describe("table positions in shared URL", () => {
  it("preserves custom table positions after drag", () => {
    const diagramWithPositions: Diagram = {
      ...sampleDiagram,
      tables: sampleDiagram.tables.map((t) => ({ ...t, x: 500, y: 300 })),
    };
    const url = generateShareUrl(diagramWithPositions);
    const hash = url.substring(url.indexOf("#"));
    const match = hash.match(/^#d=(.+)/);
    const decoded = decodeState(decodeURIComponent(match![1]!));
    expect(decoded).not.toBeNull();
    expect(decoded!.tables[0]!.x).toBe(500);
    expect(decoded!.tables[0]!.y).toBe(300);
  });

  it("preserves table colors in shared URL", () => {
    const diagramWithColors: Diagram = {
      ...sampleDiagram,
      tables: sampleDiagram.tables.map((t) => ({ ...t, color: "#ec4899" })),
    };
    const url = generateShareUrl(diagramWithColors);
    const hash = url.substring(url.indexOf("#"));
    const match = hash.match(/^#d=(.+)/);
    const decoded = decodeState(decodeURIComponent(match![1]!));
    expect(decoded).not.toBeNull();
    expect(decoded!.tables[0]!.color).toBe("#ec4899");
  });
});
