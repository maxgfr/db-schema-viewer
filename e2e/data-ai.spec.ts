import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.use({ serviceWorkers: "block" });
async function openSchema(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Import Schema", exact: true }).click();
  await page.getByRole("button", { name: /Auto-Detect/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "data.sql", mimeType: "text/plain", buffer: Buffer.from("CREATE TABLE users(id INT PRIMARY KEY, name TEXT, amount INT);") });
  await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
}
test("dump sorting, filtering, CSV, replacement and generated charts", async ({ page }) => {
  await openSchema(page);
  await page.getByRole("button", { name: "Data Explorer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data Explorer" })).toBeVisible();
  const upload = (text: string) => page.locator('input[type="file"]').setInputFiles({ name: "dump.sql", mimeType: "text/plain", buffer: Buffer.from(text) });
  const rows = Array.from({ length: 75 }, (_, i) => `(${i}, 'User ${i}', ${i * 10})`).join(",");
  await upload(`INSERT INTO users (id,name,amount) VALUES ${rows};`);
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Search across all columns...").fill("User 74");
  await expect(page.getByRole("cell", { name: "User 74", exact: true })).toBeVisible();
  const csvDownload = page.waitForEvent("download");
  await page.getByTitle("Export current table as CSV").click();
  const csv = await readFile((await (await csvDownload).path())!, "utf8");
  expect(csv).toContain("User 74");
  expect(csv).not.toContain("User 73");
  await upload("INSERT INTO users (id,name,amount) VALUES (1,'Replacement',10);");
  await expect(page.getByRole("cell", { name: "Replacement", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Search across all columns...")).toHaveValue("");
  await page.getByTitle("Clear data and go back").click();
  await page.getByRole("button", { name: "Generate Data", exact: true }).click();
  await expect(page.getByRole("button", { name: "Charts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Charts", exact: true }).click();
  await expect(page.getByText("Chart Type", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Data Explorer", exact: true }).click();
  await expect(page.getByText("Chart Type", { exact: true })).toBeVisible();
});

test("AI streams a mocked response and retains conversation when reopened", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "db-sv-api-key", value: "test-key", url: baseURL! },
    { name: "db-sv-custom-endpoint", value: encodeURIComponent(new URL("/v1", baseURL).href), url: baseURL! },
  ]);
  await page.route("**/v1/chat/completions", async (route) => {
    await route.fulfill({ contentType: "text/event-stream", body:
      'data: {"id":"test","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"The users table has a primary key."},"finish_reason":null}]}\n\n' +
      'data: {"id":"test","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n' +
      'data: [DONE]\n\n' });
  });
  await openSchema(page);
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await page.getByPlaceholder("Ask about your schema...").fill("Explain the keys");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("The users table has a primary key.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close AI panel", exact: true }).click();
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await expect(page.getByText("The users table has a primary key.", { exact: true })).toBeVisible();
});

test("AI challenge renders and exports a mocked structured review", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "db-sv-api-key", value: "test-key", url: baseURL! },
    { name: "db-sv-custom-endpoint", value: encodeURIComponent(new URL("/v1", baseURL).href), url: baseURL! },
  ]);
  const review = { overallScore: 88, summary: "Review completed", issues: [{ severity: "warning", category: "indexing", table: "users", description: "Consider an index on name", suggestion: "Measure query plans" }] };
  await page.route("**/v1/chat/completions", (route) => route.fulfill({ json: {
    id: "test", object: "chat.completion", created: 1, model: "test",
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(review) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  } }));
  await openSchema(page);
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await page.getByRole("button", { name: "Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Challenge My Schema", exact: true }).click();
  await expect(page.getByText("Consider an index on name", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: ".json", exact: true }).click();
  const report = JSON.parse(await readFile((await (await download).path())!, "utf8"));
  expect(report.overallScore).toBe(88);
});

test("schema comparison loads through the worker and shows added tables", async ({ page }) => {
  await openSchema(page);
  await page.getByRole("button", { name: "Diff", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Schema Diff", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "new.sql", mimeType: "text/plain", buffer: Buffer.from("CREATE TABLE users(id INT PRIMARY KEY, name TEXT, amount INT); CREATE TABLE orders(id INT PRIMARY KEY);") });
  await expect(page.getByText("orders", { exact: true })).toBeVisible();
  await expect(page.getByText(/Added Tables/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
});
