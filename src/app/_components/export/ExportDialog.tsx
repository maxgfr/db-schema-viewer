"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Image, FileText, Code, Download, Copy, Braces, Database, Layers, Loader2, Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import type { Diagram, DatabaseType } from "@/lib/domain";
import { DATABASE_TYPE_LABELS } from "@/lib/domain";
import { exportFullDiagramToPng, exportToSvg, downloadDataUrl } from "@/lib/export/image-export";
import { exportToPdf } from "@/lib/export/pdf-export";
import { exportDiagramToSQL } from "@/lib/sql-export";
import { exportDiagramToMarkdown } from "@/lib/export/markdown-export";
import { exportDiagramToMermaid } from "@/lib/export/mermaid-export";
import { exportDiagramToPrisma } from "@/lib/export/prisma-export";
import { exportDiagramToDrizzle } from "@/lib/export/drizzle-export";
import { exportDiagramToDBML } from "@/lib/export/dbml-export";
import { exportDiagramToPlantUML } from "@/lib/export/plantuml-export";
import { generateShareUrl } from "@/lib/sharing/encode-state";

interface ExportDialogProps {
  diagram: Diagram;
  onClose: () => void;
}

type ExportTab = "image" | "pdf" | "sql" | "markdown" | "mermaid" | "dbml" | "plantuml" | "prisma" | "drizzle" | "embed";

export function ExportDialog({ diagram, onClose }: ExportDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ExportTab>("image");
  const [imageScale, setImageScale] = useState(2);
  const [imageFormat, setImageFormat] = useState<"png" | "svg">("png");
  const [transparent, setTransparent] = useState(false);
  const [targetDb, setTargetDb] = useState<DatabaseType>(diagram.databaseType);
  const [isExporting, setIsExporting] = useState(false);
  const [mermaidOutput, setMermaidOutput] = useState("");
  const [embedSnippet, setEmbedSnippet] = useState("");

  const handleImageExport = useCallback(async () => {
    setIsExporting(true);
    try {
      if (imageFormat === "png") {
        const { dataUrl } = await exportFullDiagramToPng({ scale: imageScale, transparent });
        downloadDataUrl(dataUrl, `${diagram.name}.png`);
      } else {
        const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
        if (!viewport) {
          toast.error(t("export.canvasNotFound"));
          return;
        }
        const dataUrl = await exportToSvg(viewport, { transparent });
        downloadDataUrl(dataUrl, `${diagram.name}.svg`);
      }
      toast.success(t("export.exportedAs", { format: imageFormat.toUpperCase() }));
    } catch (err) {
      toast.error(t("export.exportFailed"), {
        description: err instanceof Error ? err.message : t("common.unknownError"),
      });
    } finally {
      setIsExporting(false);
    }
  }, [diagram.name, imageFormat, imageScale, transparent, t]);

  const handlePdfExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportToPdf(diagram);
      toast.success(t("export.exportedAsPdf"));
    } catch (err) {
      toast.error(t("export.exportFailed"), {
        description: err instanceof Error ? err.message : t("common.unknownError"),
      });
    } finally {
      setIsExporting(false);
    }
  }, [diagram, t]);

  const handleSQLExport = useCallback(() => {
    const sql = exportDiagramToSQL(diagram, targetDb);
    const blob = new Blob([sql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.sql`);
    URL.revokeObjectURL(url);
    toast.success(t("export.exportedAs", { format: DATABASE_TYPE_LABELS[targetDb] + " SQL" }));
  }, [diagram, targetDb, t]);

  const handleSQLCopy = useCallback(() => {
    const sql = exportDiagramToSQL(diagram, targetDb);
    navigator.clipboard.writeText(sql).then(() => {
      toast.success(t("export.sqlCopied"));
    });
  }, [diagram, targetDb, t]);

  const handleMarkdownExport = useCallback(() => {
    const md = exportDiagramToMarkdown(diagram);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.md`);
    URL.revokeObjectURL(url);
    toast.success(t("export.exportedAsMarkdown"));
  }, [diagram, t]);

  const handleGenerateMermaid = useCallback(() => {
    const mermaid = exportDiagramToMermaid(diagram);
    setMermaidOutput(mermaid);
  }, [diagram]);

  const handleMermaidCopy = useCallback(() => {
    if (!mermaidOutput) return;
    navigator.clipboard.writeText(mermaidOutput).then(() => {
      toast.success(t("export.mermaidCopied"));
    });
  }, [mermaidOutput, t]);

  const handlePrismaExport = useCallback(() => {
    const prisma = exportDiagramToPrisma(diagram);
    const blob = new Blob([prisma], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.prisma`);
    URL.revokeObjectURL(url);
      toast.success(t("export.exportedAsPrisma"));
  }, [diagram, t]);

  const handlePrismaCopy = useCallback(() => {
    const prisma = exportDiagramToPrisma(diagram);
    navigator.clipboard.writeText(prisma).then(() => {
      toast.success(t("export.prismaCopied"));
    });
  }, [diagram, t]);

  const handleDrizzleExport = useCallback(() => {
    const drizzle = exportDiagramToDrizzle(diagram);
    const blob = new Blob([drizzle], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.ts`);
    URL.revokeObjectURL(url);
      toast.success(t("export.exportedAsDrizzle"));
  }, [diagram, t]);

  const handleDBMLExport = useCallback(() => {
    const dbml = exportDiagramToDBML(diagram);
    const blob = new Blob([dbml], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.dbml`);
    URL.revokeObjectURL(url);
      toast.success(t("export.exportedAsDbml"));
  }, [diagram, t]);

  const handleDBMLCopy = useCallback(() => {
    const dbml = exportDiagramToDBML(diagram);
    navigator.clipboard.writeText(dbml).then(() => {
      toast.success(t("export.dbmlCopied"));
    });
  }, [diagram, t]);

  const handlePlantUMLExport = useCallback(() => {
    const puml = exportDiagramToPlantUML(diagram);
    const blob = new Blob([puml], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.puml`);
    URL.revokeObjectURL(url);
      toast.success(t("export.exportedAsPlantuml"));
  }, [diagram, t]);

  const handlePlantUMLCopy = useCallback(() => {
    const puml = exportDiagramToPlantUML(diagram);
    navigator.clipboard.writeText(puml).then(() => {
      toast.success(t("export.plantumlCopied"));
    });
  }, [diagram, t]);

  const handleDrizzleCopy = useCallback(() => {
    const drizzle = exportDiagramToDrizzle(diagram);
    navigator.clipboard.writeText(drizzle).then(() => {
      toast.success(t("export.drizzleCopied"));
    });
  }, [diagram, t]);

  const TAB_ITEMS: Array<{ id: ExportTab; labelKey: string; icon: typeof Image }> = [
    { id: "image", labelKey: "export.tab.image", icon: Image },
    { id: "pdf", labelKey: "export.tab.pdf", icon: FileText },
    { id: "sql", labelKey: "export.tab.sql", icon: Code },
    { id: "markdown", labelKey: "export.tab.markdown", icon: FileText },
    { id: "mermaid", labelKey: "export.tab.mermaid", icon: Braces },
    { id: "dbml", labelKey: "export.tab.dbml", icon: Braces },
    { id: "plantuml", labelKey: "export.tab.plantuml", icon: Braces },
    { id: "prisma", labelKey: "export.tab.prisma", icon: Database },
    { id: "drizzle", labelKey: "export.tab.drizzle", icon: Layers },
    { id: "embed", labelKey: "export.tab.embed", icon: Globe },
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
            <h2 className="text-lg font-bold text-foreground">{t("export.title")}</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent" aria-label={t("export.closeDialog")}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-border">
            {TAB_ITEMS.map(({ id, labelKey, icon: Icon }) => (
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
                {t(labelKey)}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-4 p-6">
            {tab === "image" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">{t("export.format")}</label>
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
                     <label className="mb-2 block text-sm font-medium text-foreground">{t("export.scale")}</label>
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
                   {t("export.transparentBg")}
                 </label>

                 <button
                   onClick={handleImageExport}
                   disabled={isExporting}
                   className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                 >
                   {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                   {isExporting ? t("export.exporting") : t("export.exportImage", { format: imageFormat.toUpperCase() })}
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
                {isExporting ? t("export.generatingPdf") : t("export.exportPdf")}
              </button>
            )}

            {tab === "sql" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("export.targetDatabase")}
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
                    {t("export.downloadSql")}
                  </button>
                  <button
                    onClick={handleSQLCopy}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
                    aria-label={t("export.copySqlToClipboard")}
                    title={t("export.copySqlToClipboard")}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {tab === "markdown" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("export.markdownDescription")}
                </p>
                <button
                  onClick={handleMarkdownExport}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                >
                  <Download className="h-4 w-4" />
                  {t("export.downloadMd")}
                </button>
              </>
            )}

            {tab === "mermaid" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("export.mermaidDescription")}
                </p>
                {!mermaidOutput ? (
                  <button
                    onClick={handleGenerateMermaid}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Code className="h-4 w-4" />
                    {t("export.generateMermaid")}
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
                      {t("export.copyToClipboard")}
                    </button>
                  </>
                )}
              </>
            )}

            {tab === "dbml" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("export.dbmlDescription")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDBMLExport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    {t("export.downloadDbml")}
                  </button>
                  <button
                    onClick={handleDBMLCopy}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
                    aria-label={t("export.copyDbmlToClipboard")}
                    title={t("export.copyDbmlToClipboard")}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {tab === "plantuml" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("export.plantumlDescription")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handlePlantUMLExport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    {t("export.downloadPuml")}
                  </button>
                  <button
                    onClick={handlePlantUMLCopy}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
                    aria-label={t("export.copyPlantumlToClipboard")}
                    title={t("export.copyPlantumlToClipboard")}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {tab === "prisma" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("export.prismaDescription")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrismaExport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    {t("export.downloadPrisma")}
                  </button>
                  <button
                    onClick={handlePrismaCopy}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
                    aria-label={t("export.copyPrismaToClipboard")}
                    title={t("export.copyPrismaToClipboard")}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {tab === "drizzle" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("export.drizzleDescription")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDrizzleExport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    {t("export.downloadTs")}
                  </button>
                  <button
                    onClick={handleDrizzleCopy}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
                    aria-label={t("export.copyDrizzleToClipboard")}
                    title={t("export.copyDrizzleToClipboard")}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {tab === "embed" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("export.embedDescription")}
                </p>
                {!embedSnippet ? (
                  <button
                    onClick={() => {
                      const url = generateShareUrl(diagram);
                      const snippet = `<iframe\n  src="${url}"\n  width="100%"\n  height="600"\n  frameborder="0"\n  style="border: 1px solid #e5e7eb; border-radius: 8px;"\n  title="DB Schema Viewer"\n></iframe>`;
                      setEmbedSnippet(snippet);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Code className="h-4 w-4" />
                    {t("export.generateEmbed")}
                  </button>
                ) : (
                  <>
                    <textarea
                      readOnly
                      value={embedSnippet}
                      className="h-32 w-full rounded-lg border border-border bg-accent p-3 font-mono text-xs text-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(embedSnippet).then(() => {
                          toast.success(t("export.embedCopied"));
                        });
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 font-semibold text-foreground hover:bg-accent"
                    >
                      <Copy className="h-4 w-4" />
                      {t("export.copyToClipboard")}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
