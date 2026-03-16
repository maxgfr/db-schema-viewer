"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Image, FileText, Code, Download, Copy, Braces, Database, Layers, Loader2 } from "lucide-react";
import type { Diagram, DatabaseType } from "@/lib/domain";
import { DATABASE_TYPE_LABELS } from "@/lib/domain";
import { exportToPng, exportToSvg, downloadDataUrl } from "@/lib/export/image-export";
import { exportToPdf } from "@/lib/export/pdf-export";
import { exportDiagramToSQL } from "@/lib/sql-export";
import { exportDiagramToMarkdown } from "@/lib/export/markdown-export";
import { exportDiagramToMermaid } from "@/lib/export/mermaid-export";
import { exportDiagramToPrisma } from "@/lib/export/prisma-export";
import { exportDiagramToDrizzle } from "@/lib/export/drizzle-export";

interface ExportDialogProps {
  diagram: Diagram;
  onClose: () => void;
}

type ExportTab = "image" | "pdf" | "sql" | "markdown" | "mermaid" | "prisma" | "drizzle";

export function ExportDialog({ diagram, onClose }: ExportDialogProps) {
  const [tab, setTab] = useState<ExportTab>("image");
  const [imageScale, setImageScale] = useState(2);
  const [imageFormat, setImageFormat] = useState<"png" | "svg">("png");
  const [transparent, setTransparent] = useState(false);
  const [targetDb, setTargetDb] = useState<DatabaseType>(diagram.databaseType);
  const [isExporting, setIsExporting] = useState(false);
  const [mermaidOutput, setMermaidOutput] = useState("");

  const handleImageExport = useCallback(async () => {
    const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewport) {
      toast.error("Canvas not found");
      return;
    }

    setIsExporting(true);
    try {
      if (imageFormat === "png") {
        const dataUrl = await exportToPng(viewport, { scale: imageScale, transparent });
        downloadDataUrl(dataUrl, `${diagram.name}.png`);
      } else {
        const dataUrl = await exportToSvg(viewport, { transparent });
        downloadDataUrl(dataUrl, `${diagram.name}.svg`);
      }
      toast.success(`Exported as ${imageFormat.toUpperCase()}`);
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsExporting(false);
    }
  }, [diagram.name, imageFormat, imageScale, transparent]);

  const handlePdfExport = useCallback(async () => {
    const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewport) {
      toast.error("Canvas not found");
      return;
    }

    setIsExporting(true);
    try {
      await exportToPdf(viewport, diagram);
      toast.success("Exported as PDF");
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsExporting(false);
    }
  }, [diagram]);

  const handleSQLExport = useCallback(() => {
    const sql = exportDiagramToSQL(diagram, targetDb);
    const blob = new Blob([sql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.sql`);
    URL.revokeObjectURL(url);
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
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.md`);
    URL.revokeObjectURL(url);
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

  const handlePrismaExport = useCallback(() => {
    const prisma = exportDiagramToPrisma(diagram);
    const blob = new Blob([prisma], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.prisma`);
    URL.revokeObjectURL(url);
    toast.success("Exported as Prisma schema");
  }, [diagram]);

  const handlePrismaCopy = useCallback(() => {
    const prisma = exportDiagramToPrisma(diagram);
    navigator.clipboard.writeText(prisma).then(() => {
      toast.success("Prisma schema copied to clipboard");
    });
  }, [diagram]);

  const handleDrizzleExport = useCallback(() => {
    const drizzle = exportDiagramToDrizzle(diagram);
    const blob = new Blob([drizzle], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.ts`);
    URL.revokeObjectURL(url);
    toast.success("Exported as Drizzle schema");
  }, [diagram]);

  const handleDrizzleCopy = useCallback(() => {
    const drizzle = exportDiagramToDrizzle(diagram);
    navigator.clipboard.writeText(drizzle).then(() => {
      toast.success("Drizzle schema copied to clipboard");
    });
  }, [diagram]);

  const TAB_ITEMS: Array<{ id: ExportTab; label: string; icon: typeof Image }> = [
    { id: "image", label: "Image", icon: Image },
    { id: "pdf", label: "PDF", icon: FileText },
    { id: "sql", label: "SQL", icon: Code },
    { id: "markdown", label: "Markdown", icon: FileText },
    { id: "mermaid", label: "Mermaid", icon: Braces },
    { id: "prisma", label: "Prisma", icon: Database },
    { id: "drizzle", label: "Drizzle", icon: Layers },
  ];

  const modalContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-bold text-foreground">Export Diagram</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent" aria-label="Close export dialog">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-border">
            {TAB_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex shrink-0 items-center justify-center gap-1 px-3 py-3 text-xs font-medium transition-colors ${
                  tab === id
                    ? "border-b-2 border-indigo-500 text-indigo-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-4 p-6">
            {tab === "image" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Format</label>
                  <div className="flex gap-2">
                    {(["png", "svg"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setImageFormat(fmt)}
                        className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                          imageFormat === fmt
                            ? "border-indigo-500 bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                            : "border-border text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {imageFormat === "png" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Scale</label>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((s) => (
                        <button
                          key={s}
                          onClick={() => setImageScale(s)}
                          className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                            imageScale === s
                              ? "border-indigo-500 bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                              : "border-border text-muted-foreground hover:border-border/80"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(e) => setTransparent(e.target.checked)}
                    className="rounded border-border"
                  />
                  Transparent background
                </label>

                <button
                  onClick={handleImageExport}
                  disabled={isExporting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {isExporting ? "Exporting..." : `Export ${imageFormat.toUpperCase()}`}
                </button>
              </>
            )}

            {tab === "pdf" && (
              <button
                onClick={handlePdfExport}
                disabled={isExporting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExporting ? "Generating PDF..." : "Export PDF"}
              </button>
            )}

            {tab === "sql" && (
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
                    title="Copy SQL to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {tab === "markdown" && (
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
            )}

            {tab === "mermaid" && (
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
            )}

            {tab === "prisma" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Export your schema as a Prisma schema file with models, relations, and field attributes.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrismaExport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    Download .prisma
                  </button>
                  <button
                    onClick={handlePrismaCopy}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
                    aria-label="Copy Prisma schema to clipboard"
                    title="Copy Prisma schema to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {tab === "drizzle" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Export your schema as Drizzle ORM TypeScript code with table definitions and column builders.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDrizzleExport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    Download .ts
                  </button>
                  <button
                    onClick={handleDrizzleCopy}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
                    aria-label="Copy Drizzle schema to clipboard"
                    title="Copy Drizzle schema to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
