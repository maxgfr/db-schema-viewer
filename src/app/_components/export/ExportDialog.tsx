"use client";

import { useState, useCallback, useMemo } from "react";
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

const TEXT_TABS: Set<ExportTab> = new Set(["sql", "markdown", "mermaid", "dbml", "plantuml", "prisma", "drizzle"]);

export function ExportDialog({ diagram, onClose }: ExportDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ExportTab>("image");
  const [imageScale, setImageScale] = useState(2);
  const [imageFormat, setImageFormat] = useState<"png" | "svg">("png");
  const [transparent, setTransparent] = useState(false);
  const [targetDb, setTargetDb] = useState<DatabaseType>(diagram.databaseType);
  const [isExporting, setIsExporting] = useState(false);
  const [embedSnippet, setEmbedSnippet] = useState("");

  // Generate text output for the active text tab
  const textOutput = useMemo(() => {
    switch (tab) {
      case "sql": return exportDiagramToSQL(diagram, targetDb);
      case "markdown": return exportDiagramToMarkdown(diagram);
      case "mermaid": return exportDiagramToMermaid(diagram);
      case "dbml": return exportDiagramToDBML(diagram);
      case "plantuml": return exportDiagramToPlantUML(diagram);
      case "prisma": return exportDiagramToPrisma(diagram);
      case "drizzle": return exportDiagramToDrizzle(diagram);
      default: return "";
    }
  }, [tab, diagram, targetDb]);

  const handleCopyText = useCallback(() => {
    if (!textOutput) return;
    navigator.clipboard.writeText(textOutput).then(() => {
      const msg: Partial<Record<ExportTab, string>> = {
        sql: t("export.sqlCopied"),
        markdown: t("export.markdownCopied"),
        mermaid: t("export.mermaidCopied"),
        dbml: t("export.dbmlCopied"),
        plantuml: t("export.plantumlCopied"),
        prisma: t("export.prismaCopied"),
        drizzle: t("export.drizzleCopied"),
      };
      toast.success(msg[tab] ?? t("export.copyToClipboard"));
    });
  }, [textOutput, tab, t]);

  const handleTextDownload = useCallback(() => {
    if (!textOutput) return;
    const configs: Partial<Record<ExportTab, { ext: string; mime: string }>> = {
      sql: { ext: "sql", mime: "text/sql" },
      markdown: { ext: "md", mime: "text/markdown" },
      mermaid: { ext: "mmd", mime: "text/plain" },
      dbml: { ext: "dbml", mime: "text/plain" },
      plantuml: { ext: "puml", mime: "text/plain" },
      prisma: { ext: "prisma", mime: "text/plain" },
      drizzle: { ext: "ts", mime: "text/typescript" },
    };
    const c = configs[tab];
    if (!c) return;
    const blob = new Blob([textOutput], { type: c.mime });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${diagram.name}.${c.ext}`);
    URL.revokeObjectURL(url);
    const successMsg: Partial<Record<ExportTab, string>> = {
      sql: t("export.exportedAs", { format: DATABASE_TYPE_LABELS[targetDb] + " SQL" }),
      markdown: t("export.exportedAsMarkdown"),
      mermaid: t("export.exportedAs", { format: "Mermaid" }),
      dbml: t("export.exportedAsDbml"),
      plantuml: t("export.exportedAsPlantuml"),
      prisma: t("export.exportedAsPrisma"),
      drizzle: t("export.exportedAsDrizzle"),
    };
    toast.success(successMsg[tab] ?? t("export.exportedAs", { format: tab }));
  }, [textOutput, tab, diagram.name, targetDb, t]);

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

  const textTabDescriptions: Partial<Record<ExportTab, string>> = {
    markdown: t("export.markdownDescription"),
    mermaid: t("export.mermaidDescription"),
    dbml: t("export.dbmlDescription"),
    plantuml: t("export.plantumlDescription"),
    prisma: t("export.prismaDescription"),
    drizzle: t("export.drizzleDescription"),
  };

  const downloadLabels: Partial<Record<ExportTab, string>> = {
    sql: t("export.downloadSql"),
    markdown: t("export.downloadMd"),
    mermaid: t("export.downloadMmd"),
    dbml: t("export.downloadDbml"),
    plantuml: t("export.downloadPuml"),
    prisma: t("export.downloadPrisma"),
    drizzle: t("export.downloadTs"),
  };

  const modalContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-bold text-foreground">{t("export.title")}</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent" aria-label={t("export.closeDialog")}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 overflow-x-auto border-b border-border">
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
          <div className="space-y-4 overflow-y-auto p-6">
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

            {TEXT_TABS.has(tab) && (
              <>
                {/* SQL-specific: database selector */}
                {tab === "sql" && (
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
                )}

                {/* Description */}
                {textTabDescriptions[tab] && (
                  <p className="text-sm text-muted-foreground">{textTabDescriptions[tab]}</p>
                )}

                {/* Preview */}
                <textarea
                  readOnly
                  value={textOutput}
                  className="h-48 w-full rounded-lg border border-border bg-accent p-3 font-mono text-xs text-foreground focus:outline-none"
                />

                {/* Download + Copy */}
                <div className="flex gap-2">
                  <button
                    onClick={handleTextDownload}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    {downloadLabels[tab]}
                  </button>
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-accent"
                    aria-label={t("export.copyToClipboard")}
                    title={t("export.copyToClipboard")}
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
