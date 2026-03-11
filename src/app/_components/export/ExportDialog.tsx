"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Image, FileText, Code, Download, Copy } from "lucide-react";
import type { Diagram, DatabaseType } from "@/lib/domain";
import { DATABASE_TYPE_LABELS } from "@/lib/domain";
import { exportToPng, exportToSvg, downloadDataUrl } from "@/lib/export/image-export";
import { exportToPdf } from "@/lib/export/pdf-export";
import { exportDiagramToSQL } from "@/lib/sql-export";

interface ExportDialogProps {
  diagram: Diagram;
  onClose: () => void;
}

type ExportTab = "image" | "pdf" | "sql";

export function ExportDialog({ diagram, onClose }: ExportDialogProps) {
  const [tab, setTab] = useState<ExportTab>("image");
  const [imageScale, setImageScale] = useState(2);
  const [imageFormat, setImageFormat] = useState<"png" | "svg">("png");
  const [transparent, setTransparent] = useState(false);
  const [targetDb, setTargetDb] = useState<DatabaseType>(diagram.databaseType);
  const [isExporting, setIsExporting] = useState(false);

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

  const modalContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
            <h2 className="text-lg font-bold text-white">Export Diagram</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-800">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            {([
              { id: "image" as const, label: "Image", icon: Image },
              { id: "pdf" as const, label: "PDF", icon: FileText },
              { id: "sql" as const, label: "SQL", icon: Code },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  tab === id
                    ? "border-b-2 border-indigo-500 text-indigo-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-4 p-6">
            {tab === "image" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Format</label>
                  <div className="flex gap-2">
                    {(["png", "svg"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setImageFormat(fmt)}
                        className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                          imageFormat === fmt
                            ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                            : "border-slate-600 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {imageFormat === "png" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Scale</label>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((s) => (
                        <button
                          key={s}
                          onClick={() => setImageScale(s)}
                          className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                            imageScale === s
                              ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                              : "border-slate-600 text-slate-400 hover:border-slate-500"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(e) => setTransparent(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  Transparent background
                </label>

                <button
                  onClick={handleImageExport}
                  disabled={isExporting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
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
                <Download className="h-4 w-4" />
                {isExporting ? "Generating PDF..." : "Export PDF"}
              </button>
            )}

            {tab === "sql" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Target Database
                  </label>
                  <select
                    value={targetDb}
                    onChange={(e) => setTargetDb(e.target.value as DatabaseType)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
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
                    className="flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-3 font-semibold text-slate-300 hover:bg-slate-800"
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
