import { parseSchemaFile } from "db-schema-toolkit";

self.onmessage = (event: MessageEvent<{ content: string; fileName?: string }>) => {
  try {
    const { content, fileName } = event.data;
    const diagram = parseSchemaFile(content, fileName);
    if (!diagram.tables.length) throw new Error("No tables found. Check the file format and schema syntax.");
    self.postMessage({ result: { ...diagram, sourceContent: content } });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
