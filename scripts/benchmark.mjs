import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { parseSchemaFile, encodeState } from "db-schema-toolkit";
import { indexRelationships } from "../src/lib/graph/navigation.ts";

async function moduleUrl(path, aliases = {}) {
  let code = ts.transpileModule(await readFile(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const name of ["db-schema-toolkit", "lz-string", "zod"]) code = code.replaceAll('"' + name + '"', JSON.stringify(import.meta.resolve(name)));
  for (const [name, url] of Object.entries(aliases)) code = code.replaceAll('"' + name + '"', JSON.stringify(url));
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const project = await moduleUrl("src/lib/project/project.ts");
const { generateShareUrl } = await import(await moduleUrl("src/lib/sharing/encode-state.ts", { "@/lib/project/project": project }));
function measure(fn, count = 15) {
  for (let i = 0; i < 3; i++) fn();
  const samples = [];
  for (let i = 0; i < count; i++) { const start = performance.now(); fn(); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  return { medianMs: +samples[Math.floor(samples.length / 2)].toFixed(3), p95Ms: +samples[Math.floor(samples.length * 0.95)].toFixed(3) };
}
const results = [];
for (const count of [100, 500, 1000]) {
  const sql = Array.from({ length: count }, (_, i) => `CREATE TABLE t_${i} (id INT PRIMARY KEY, name VARCHAR(255), value INT${i ? `, parent_id INT REFERENCES t_${i - 1}(id)` : ""});`).join("\n");
  const diagram = parseSchemaFile(sql);
  assert.equal(diagram.tables.length, count);
  assert.equal(diagram.relationships.length, count - 1);
  const nodes = diagram.tables.map((table) => ({ id: table.id }));
  // Reference operations copied from the original canvas synchronization loop.
  const previous = () => diagram.tables.map((table) => ({ node: nodes.find((node) => node.id === table.id), relationships: diagram.relationships.filter((r) => r.sourceTableId === table.id || r.targetTableId === table.id) }));
  const indexed = () => {
    const nodeIndex = new Map(nodes.map((node) => [node.id, node]));
    const relations = indexRelationships(diagram.relationships);
    return diagram.tables.map((table) => ({ node: nodeIndex.get(table.id), relationships: relations.get(table.id) ?? [] }));
  };
  assert.deepEqual(indexed(), previous());
  assert.equal(generateShareUrl(diagram), `#d=${encodeState(diagram)}`);
  results.push({ tables: count, relationships: diagram.relationships.length,
    parseAndLayout: measure(() => parseSchemaFile(sql)),
    graphBefore: measure(previous), graphAfter: measure(indexed),
    viewUrlBefore: measure(() => encodeState(diagram)),
    viewUrlAfter: measure(() => generateShareUrl(diagram, [], { viewport: { x: 1, y: 1, zoom: 1 } })),
  });
}
console.log(JSON.stringify({ node: process.version, platform: `${process.platform}/${process.arch}`, rounds: 15, results }, null, 2));
