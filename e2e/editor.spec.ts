import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const sql = `CREATE TABLE users (id INT PRIMARY KEY, name TEXT);
CREATE TABLE posts (id INT PRIMARY KEY, user_id INT REFERENCES users(id), title TEXT);
CREATE TABLE other (id INT PRIMARY KEY);`;
async function upload(page: Page, content: string, name = "test.sql") {
  await page.getByRole("button", { name: /Import Schema|^Import$/i }).click();
  await page.getByRole("button", { name: /Auto-Detect/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(content) });
}
async function start(page: Page) {
  await page.goto("./");
  await upload(page, sql);
  await expect(page.locator(".react-flow__node-table")).toHaveCount(3);
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
}

test("import, filter, isolate, save, reload and reopen recent project", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await page.getByRole("textbox", { name: "Search tables and fields" }).fill("other");
  await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await page.locator(".react-flow__node-table").filter({ hasText: "users" }).click();
  await page.getByRole("button", { name: "Isolate selection", exact: true }).click();
  await expect(page.locator(".react-flow__node-table")).toHaveCount(2);
  await page.getByRole("button", { name: "Fit results", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("db-schema-viewer-diagram-")).some((key) => JSON.parse(localStorage.getItem(key)!).viewSettings.filters?.focusTableId))).toBeTruthy();
  await page.reload();
  await expect(page.locator(".react-flow__node-table")).toHaveCount(2);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("region", { name: "Recent projects" }).getByRole("button", { name: /^test / }).click();
  await expect(page.locator(".react-flow__node-table")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("project file preserves notes and exports the full schema through filters", async ({ page }, testInfo) => {
  await start(page);
  await page.getByRole("button", { name: "Add a sticky note to the canvas" }).click();
  const note = page.locator(".react-flow__node-stickyNote");
  await note.getByTitle("Double-click to edit").dblclick();
  await note.locator("textarea").fill("Keep this note");
  // Reload with the editor still focused: autosave must not depend on blur.
  await page.reload();
  await expect(page.locator(".react-flow__node-stickyNote")).toContainText("Keep this note");
  await page.getByRole("textbox", { name: "Search tables and fields" }).fill("other");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Project file", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download project", exact: true }).click();
  const download = await downloaded;
  const content = await readFile((await download.path())!, "utf8");
  const project = JSON.parse(content);
  expect(project.diagram.tables).toHaveLength(3);
  expect(project.annotations[0].text).toBe("Keep this note");
  expect(project.viewSettings.filters.search).toBe("other");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: testInfo.outputPath("editor.png") });
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await upload(page, content, "backup.dbschema.json");
  await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
  await expect(page.locator(".react-flow__node-stickyNote")).toContainText("Keep this note");
});

test("invalid import preserves the open project; changing language preserves filters", async ({ page }) => {
  await start(page);
  await page.getByRole("textbox", { name: "Search tables and fields" }).fill("other");
  await upload(page, '{"format":"db-schema-viewer","version":999}', "bad.json");
  await expect(page.getByText("Failed to parse schema", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Language" }).selectOption("fr");
  await expect(page.getByRole("button", { name: "Tout afficher", exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
});

test("text exports and image exports work with filtered tables", async ({ page }, testInfo) => {
  await start(page);
  await page.getByRole("textbox", { name: "Search tables and fields" }).fill("other");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  for (const format of ["SQL", "Markdown", "Mermaid", "DBML", "PlantUML", "Prisma", "Drizzle"]) {
    await page.getByRole("button", { name: format, exact: true }).click();
    await expect(page.locator("textarea[readonly]")).not.toHaveValue("");
  }
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await page.getByRole("button", { name: "SVG", exact: true }).click();
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG", exact: true }).click();
  const svg = await readFile((await (await svgDownload).path())!, "utf8");
  expect(svg).toContain("users");
  expect(svg).toContain("posts");
  expect(svg.includes("react-flow__edge-path"), "export includes the relationship path").toBe(true);
  expect(svg.includes('id="cf-many"'), "export includes cardinality markers").toBe(true);
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const png = await pngDownload;
  await png.saveAs(testInfo.outputPath("diagram.png"));
  expect((await readFile((await png.path())!)).subarray(1, 4).toString()).toBe("PNG");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const pdf = await pdfDownload;
  await pdf.saveAs(testInfo.outputPath("diagram.pdf"));
  expect((await readFile((await pdf.path())!)).subarray(0, 5).toString()).toBe("%PDF-");
  await page.keyboard.press("Escape");
  await expect(page.locator(".react-flow__node-table")).toHaveCount(1);
});

test("malformed link stays usable and offline reload restores the project", async ({ page, context, browserName, baseURL }) => {
  await page.goto("./#d=%ZZ");
  await expect(page.getByRole("button", { name: "Import Schema", exact: true })).toBeVisible();
  await upload(page, sql);
  await expect(page.locator(".react-flow__node-table")).toHaveCount(3);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  // WebKit's protocol-level offline emulation fails before dispatching to the SW.
  // Cut server connections for this browser context to exercise a real fetch failure.
  if (browserName === "webkit") await context.addCookies([{ name: "test-offline", value: "yes", url: baseURL! }]);
  else await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".react-flow__node-table")).toHaveCount(3);
  await context.setOffline(false);
});
