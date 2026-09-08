import { parseSQLDump, generateFakeData } from "db-schema-toolkit/data";
import type { Diagram } from "db-schema-toolkit";
export type DataRequest = { kind: "dump"; content: string } | { kind: "generate"; diagram: Diagram; seed: number };
self.onmessage = (event: MessageEvent<DataRequest>) => {
  try {
    const request = event.data;
    const result = request.kind === "dump" ? parseSQLDump(request.content)
      : generateFakeData(request.diagram.tables, request.diagram.relationships, { seed: request.seed });
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
