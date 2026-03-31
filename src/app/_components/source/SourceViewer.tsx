"use client";

import { useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Copy, FileCode } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

interface SourceViewerProps {
  sourceContent: string;
  diagramName: string;
  onClose: () => void;
}

export function SourceViewer({ sourceContent, diagramName, onClose }: SourceViewerProps) {
  const { t } = useTranslation();
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(sourceContent).then(() => {
      toast.success(t("source.copied"));
    });
  }, [sourceContent, t]);

  const lineCount = sourceContent.split("\n").length;

  const modalContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto flex w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl"
          style={{ maxHeight: "80vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
                <FileCode className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("source.title")}</h2>
                <p className="text-xs text-muted-foreground">
                  {t("source.lines", { name: diagramName, count: lineCount })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
                {t("common.copy")}
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-2 transition-colors hover:bg-accent"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Source content */}
          <div className="flex-1 overflow-auto p-6">
            <pre className="overflow-x-auto rounded-xl border border-border bg-accent/50 p-4 font-mono text-sm leading-relaxed text-foreground">
              {sourceContent}
            </pre>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
