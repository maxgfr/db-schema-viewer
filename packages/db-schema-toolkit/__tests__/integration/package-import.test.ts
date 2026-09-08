import { mkdtempSync, cpSync, mkdirSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("built package consumed by Node", () => {
  it("loads the AI entry without requiring unused provider SDKs", () => {
    const dir = mkdtempSync(join(tmpdir(), "db-schema-consumer-"));
    try {
      cpSync("dist", join(dir, "dist"), { recursive: true });
      mkdirSync(join(dir, "node_modules"));
      const require = createRequire(import.meta.url);
      for (const pkg of ["ai", "zod"]) {
        symlinkSync(dirname(require.resolve(`${pkg}/package.json`)), join(dir, "node_modules", pkg), "dir");
      }
      expect(execFileSync(process.execPath, ["--input-type=module", "-e", "await import('./dist/ai.js'); console.log('ok')"], { cwd: dir, encoding: "utf8" }).trim()).toBe("ok");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("loads all public entry points and parses SQL without a bundler", () => {
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
      const { parseSchemaFile } = await import('db-schema-toolkit');
      for (const entry of ['export', 'analysis', 'data', 'ai']) {
        await import('db-schema-toolkit/' + entry);
      }
      const diagram = parseSchemaFile('CREATE TABLE users (id INT PRIMARY KEY);');
      if (diagram.tables.length !== 1) throw new Error('Missing table');
      console.log(diagram.tables[0].name);
    `], { encoding: "utf8" });
    expect(output.trim()).toBe("users");
  });
});
