import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      export: "src/export.ts",
      analysis: "src/analysis.ts",
      ai: "src/ai.ts",
      data: "src/data.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    splitting: true,
    sourcemap: true,
    external: [
      "ai",
      "@ai-sdk/openai",
      "@ai-sdk/anthropic",
      "@ai-sdk/google",
      "@ai-sdk/mistral",
      "oxc-parser",
    ],
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    clean: false,
    noExternal: [/.*/],
    banner: { js: "#!/usr/bin/env node" },
  },
]);
