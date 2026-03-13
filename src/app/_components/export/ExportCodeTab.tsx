"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Download, Copy, Code } from "lucide-react";
import type { Diagram, DatabaseType } from "@/lib/domain";
import { DATABASE_TYPE_LABELS } from "@/lib/domain";
import { exportDiagramToSQL } from "@/lib/sql-export";
import { exportDiagramToMarkdown } from "@/lib/export/markdown-export";
import { exportDiagramToMermaid } from "@/lib/export/mermaid-export";
import { exportDiagramToPrisma } from "@/lib/export/prisma-export";
import { exportDiagramToDrizzle } from "@/lib/export/drizzle-export";
import { downloadBlob } from "@/lib/export/image-export";

type CodeTab = "sql" | "markdown" | "mermaid" | "prisma" | "drizzle";

interface ExportCodeTabProps {
  diagram: Diagram;
  tab: CodeTab;
}

export function ExportCodeTab({ diagram, tab }: ExportCodeTabProps) {
  const [targetDb, setTargetDb] = useState<DatabaseType>(diagram.databaseType);
  const [mermaidOutput, setMermaidOutput] = useState("");

  const handleSQLExport = useCallback(() => {
    const sql = exportDiagramToSQL(diagram, targetDb);
    downloadBlob(sql, `${diagram.name}.sql`, "text/sql");
    toast.success(`Exported as ${DATABASE_TYPE_LABELS[targetDb]} SQL`);
  }, [diagram, targetDb]);

  const handleSQLCopy = useCallback(() => {
    const sql = exportDiagramToSQL(diagram, targetDb);
    navigator.clipboard.writeText(sql).then(() => {
      toast.success("SQL copied to clipboard");
    });
  }, [diagram, targetDb]);

  const handleMarkdownExport = useCallback(() => {
    const md = exportDiagramToMarkdown(diagram);
    downloadBlob(md, `${diagram.name}.md`, "text/markdown");
    toast.success("Exported as Markdown");
  }, [diagram]);

  const handleGenerateMermaid = useCallback(() => {
    const mermaid = exportDiagramToMermaid(diagram);
    setMermaidOutput(mermaid);
  }, [diagram]);

  const handleMermaidCopy = useCallback(() => {
    if (!mermaidOutput) return;
    navigator.clipboard.writeText(mermaidOutput).then(() => {
      toast.success("Mermaid diagram copied to clipboard");
    });
  }, [mermaidOutput]);

  const handleFormatExport = useCallback((format: "prisma" | "drizzle") => {
    const content = format === "prisma"
      ? exportDiagramToPrisma(diagram)
      : exportDiagramToDrizzle(diagram);
    const ext = format === "prisma" ? ".prisma" : ".ts";
    downloadBlob(content, `${diagram.name}${ext}`, "text/plain");
    toast.success(`Exported as ${format === "prisma" ? "Prisma" : "Drizzle"} schema`);
  }, [diagram]);

  const handleFormatCopy = useCallback((format: "prisma" | "drizzle") => {
    const content = format === "prisma"
      ? exportDiagramToPrisma(diagram)
      : exportDiagramToDrizzle(diagram);
    navigator.clipboard.writeText(content).then(() => {
      toast.success(`${format === "prisma" ? "Prisma" : "Drizzle"} schema copied to clipboard`);
    });
  }, [diagram]);

  if (tab === "sql") {
    return (
      <>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Target Database
          </label>
          <select
            value={targetDb}
            onChange={(e) => setTargetDb(e.target.value as DatabaseType)}
            className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground focus:border-indigo-500 focus:outline-none"
          >
            {Object.entries(DATABASE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSQLExport}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
          >
            <Download className="h-4 w-4" />
            Download .sql
          </button>
          <button
            onClick={handleSQLCopy}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
            aria-label="Copy SQL to clipboard"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </>
    );
  }

  if (tab === "markdown") {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          Export your schema documentation as a Markdown file with tables, columns, indexes, and relationships.
        </p>
        <button
          onClick={handleMarkdownExport}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
        >
          <Download className="h-4 w-4" />
          Download .md
        </button>
      </>
    );
  }

  if (tab === "mermaid") {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          Generate a Mermaid ERD diagram that can be embedded in Markdown, GitHub, or any Mermaid-compatible renderer.
        </p>
        {!mermaidOutput ? (
          <button
            onClick={handleGenerateMermaid}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
          >
            <Code className="h-4 w-4" />
            Generate Mermaid ERD
          </button>
        ) : (
          <>
            <textarea
              readOnly
              value={mermaidOutput}
              className="h-48 w-full rounded-lg border border-border bg-accent p-3 font-mono text-xs text-foreground focus:outline-none"
            />
            <button
              onClick={handleMermaidCopy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 font-semibold text-foreground hover:bg-accent"
            >
              <Copy className="h-4 w-4" />
              Copy to Clipboard
            </button>
          </>
        )}
      </>
    );
  }

  // prisma or drizzle
  const format = tab as "prisma" | "drizzle";
  const label = format === "prisma" ? "Prisma" : "Drizzle ORM";
  const ext = format === "prisma" ? ".prisma" : ".ts";

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Export your schema as {label} {format === "prisma" ? "schema file with models, relations, and field attributes" : "TypeScript code with table definitions and column builders"}.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => handleFormatExport(format)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
        >
          <Download className="h-4 w-4" />
          Download {ext}
        </button>
        <button
          onClick={() => handleFormatCopy(format)}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
          aria-label="Copy to clipboard"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
