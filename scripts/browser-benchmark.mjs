import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const port = 43872;
const base = `http://127.0.0.1:${port}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
const server = spawn(process.execPath, ["scripts/serve-export.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
let browser;
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (i >= 50) throw new Error("Benchmark server unavailable");
    await delay(100);
  }
  browser = await chromium.launch();
  const results = [];
  async function open(sql) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
    const page = await context.newPage();
    await page.goto(base);
    await page.getByRole("button", { name: "Import Schema", exact: true }).click();
    await page.getByRole("button", { name: /Auto-Detect/ }).click();
    const start = performance.now();
    await page.locator('input[type="file"]').setInputFiles({ name: "benchmark.sql", mimeType: "text/plain", buffer: Buffer.from(sql) });
    return { context, page, start };
  }
  for (const tables of [100, 500, 1000]) {
    const samples = [];
    for (let round = 0; round < 3; round++) {
      const sql = Array.from({ length: tables }, (_, i) => `CREATE TABLE t_${i} (id INT PRIMARY KEY, name TEXT, amount INT${i ? `, parent_id INT REFERENCES t_${i - 1}(id)` : ""});`).join("\n");
      const { context, page, start } = await open(sql);
      await expect(page.getByRole("status").filter({ hasText: `${tables} / ${tables} tables visible` })).toBeVisible({ timeout: 30000 });
      await expect(page.locator(".react-flow__node-table")).toHaveCount(tables, { timeout: 30000 });
      const displayMs = performance.now() - start;
      const filterStart = performance.now();
      await page.getByRole("textbox", { name: "Search tables and fields" }).fill(`t_${tables - 1}`);
      await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
      const filterMs = performance.now() - filterStart;
      samples.push({ displayMs: Math.round(displayMs), filterMs: Math.round(filterMs) });
      await context.close();
    }
    results.push({ tables, samples });
  }
  const { context, page } = await open("CREATE TABLE metrics (value INT, name TEXT);");
  await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
  await page.getByRole("button", { name: "Data Explorer", exact: true }).click();
  const rowCount = 40000;
  const dump = "INSERT INTO metrics (value,name) VALUES " + Array.from({ length: rowCount }, (_, i) => `(${i},'row_${i}_${"x".repeat(100)}')`).join(",") + ";";
  if (Buffer.byteLength(dump) > 5 * 1024 * 1024) throw new Error("Fixture exceeds 5 MB");
  const start = performance.now();
  await page.locator('input[type="file"]').setInputFiles({ name: "large.sql", mimeType: "text/plain", buffer: Buffer.from(dump) });
  await expect(page.getByText(`${rowCount} rows`, { exact: true })).toBeVisible({ timeout: 30000 });
  const dumpResult = { bytes: Buffer.byteLength(dump), rows: rowCount, displayMs: Math.round(performance.now() - start) };
  await context.close();
  const report = { browser: await browser.version(), viewport: "1440x900", rounds: 3, results, dump: dumpResult };
  await writeFile("docs/quality/browser-performance.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); server.kill(); }
