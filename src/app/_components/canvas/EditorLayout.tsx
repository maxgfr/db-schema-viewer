"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Share2,
  Download,
  Brain,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Monitor,
  GitCompareArrows,
  Github,
  FileCode,
  StickyNote,
} from "lucide-react";
import type { Diagram } from "@/lib/domain";
import { DATABASE_TYPE_LABELS } from "@/lib/domain";
import { generateShareUrl, estimateUrlSize } from "@/lib/sharing/encode-state";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { Theme, ThemeMode } from "@/hooks/use-theme";
import { SchemaCanvas, type Annotation } from "./SchemaCanvas";
import type { ERDNotation } from "./RelationshipEdge";
import { SchemaSidebar } from "../schema/SchemaSidebar";
import { SchemaUpload } from "../schema/SchemaUpload";
import { ExportDialog } from "../export/ExportDialog";
import { AIPanel } from "../ai/AIPanel";
import { DataExplorer } from "../data/DataExplorer";
import { APIKeySettings } from "../settings/APIKeySettings";
import { SchemaDiffPanel } from "../analysis/SchemaDiffPanel";
import { SourceViewer } from "../source/SourceViewer";
import { parseSchemaFile } from "@/lib/parsing/parse-schema-file";
import { useTranslation } from "@/lib/i18n/context";
import { LanguageToggle } from "../I18nWrapper";

interface EditorLayoutProps {
  diagram: Diagram;
  onDiagramUpdate: (diagram: Diagram) => void;
  onBack: () => void;
  theme: Theme;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  initialAnnotations?: Annotation[];
  onAnnotationsChange?: (annotations: Annotation[]) => void;
}

export function EditorLayout({
  diagram,
  onDiagramUpdate,
  onBack,
  theme,
  themeMode,
  onToggleTheme,
  initialAnnotations = [],
  onAnnotationsChange,
}: EditorLayoutProps) {
  const { t } = useTranslation();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [erdNotation, setErdNotation] = useState<ERDNotation>("crowsfoot");
  const [zoomTarget, setZoomTarget] = useState<{ id: string; key: number } | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const zoomCounter = useRef(0);
  const annotationCounter = useRef(0);
  const canvasRef = { current: null as HTMLDivElement | null };

  const handleZoomToTable = useCallback((tableId: string) => {
    zoomCounter.current++;
    setZoomTarget({ id: tableId, key: zoomCounter.current });
  }, []);

  const handleAddAnnotation = useCallback(() => {
    annotationCounter.current++;
    const id = `note-${annotationCounter.current}-${Date.now()}`;
    setAnnotations((prev) => [
      ...prev,
      { id, text: "", x: 100 + Math.random() * 200, y: 100 + Math.random() * 200, color: String(annotationCounter.current % 4) },
    ]);
  }, []);

  const handleAnnotationUpdate = useCallback((id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const handleAnnotationDelete = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Notify parent when annotations change so URL sync includes them
  useEffect(() => {
    onAnnotationsChange?.(annotations);
  }, [annotations, onAnnotationsChange]);

  const closeAll = useCallback(() => {
    setShowUpload(false);
    setShowExport(false);
    setShowAI(false);
    setShowData(false);
    setShowSettings(false);
    setShowDiff(false);
    setShowSource(false);
  }, []);

  const handleShare = useCallback(() => {
    const size = estimateUrlSize(diagram);
    if (size > 100_000) {
      toast.warning(t("editor.schemaVeryLarge"), {
        description: t("editor.urlLargeDesc", { size: Math.round(size / 1024) }),
      });
    }
    const url = generateShareUrl(diagram, annotations);
    navigator.clipboard.writeText(url).then(() => {
      toast.success(t("editor.shareUrlCopied"));
    });
  }, [diagram, t]);

  const shortcutHandlers = useMemo(
    () => ({
      onImport: () => { closeAll(); setShowUpload(true); },
      onExport: () => { closeAll(); setShowExport(true); },
      onAI: () => { closeAll(); setShowAI(true); },
      onEscape: closeAll,
      onShare: handleShare,
    }),
    [closeAll, handleShare]
  );

  useKeyboardShortcuts(shortcutHandlers);

  const handleTablePositionUpdate = useCallback(
    (tableId: string, x: number, y: number) => {
      const updated = {
        ...diagram,
        tables: diagram.tables.map((t) =>
          t.id === tableId ? { ...t, x, y } : t
        ),
      };
      onDiagramUpdate(updated);
    },
    [diagram, onDiagramUpdate]
  );

  const handleNewSQL = useCallback(
    (sql: string, fileName?: string) => {
      try {
        const newDiagram = parseSchemaFile(sql, fileName);
        onDiagramUpdate({ ...newDiagram, sourceContent: sql });
        toast.success(
          t("common.loadedTables", { tables: newDiagram.tables.length, rels: newDiagram.relationships.length })
        );
      } catch (err) {
        toast.error(t("common.failedToParseSchema"), {
          description: err instanceof Error ? err.message : t("common.unknownError"),
        });
      }
    },
    [onDiagramUpdate, t]
  );

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <button
          onClick={() => {
            if (window.confirm(t("editor.confirmBackHome"))) {
              onBack();
            }
          }}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={t("editor.backToHome")}
          aria-label={t("editor.backToHome")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground">{diagram.name}</h1>
          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-300">
            {DATABASE_TYPE_LABELS[diagram.databaseType]}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Upload className="h-4 w-4" />
            {t("editor.import")}
          </button>
          {diagram.sourceContent && (
            <button
              onClick={() => setShowSource(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t("editor.viewSourceCode")}
            >
              <FileCode className="h-4 w-4" />
              {t("editor.source")}
            </button>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
            {t("editor.share")}
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            {t("editor.export")}
          </button>
          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Brain className="h-4 w-4" />
            {t("editor.ai")}
          </button>
          <button
            onClick={() => setShowData(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("editor.uploadDumpDesc")}
          >
            <BarChart3 className="h-4 w-4" />
            {t("editor.dataExplorer")}
          </button>
          <button
            onClick={() => setShowDiff(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <GitCompareArrows className="h-4 w-4" />
            {t("editor.diff")}
          </button>

          <button
            onClick={handleAddAnnotation}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("editor.addStickyNote")}
          >
            <StickyNote className="h-4 w-4" />
            {t("editor.note")}
          </button>

          <div className="mx-1 h-6 w-px bg-border" />

          <button
            onClick={() => {
              const cycle: Record<ERDNotation, ERDNotation> = { crowsfoot: "uml", uml: "chen", chen: "crowsfoot" };
              setErdNotation(cycle[erdNotation]);
            }}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("editor.notationCycle", { name: t(`editor.notation.${erdNotation}`) })}
            aria-label={t("editor.toggleNotation")}
          >
            {t(`editor.notation.${erdNotation}`)}
          </button>

          <div className="mx-1 h-6 w-px bg-border" />

          <LanguageToggle />

          <button
            onClick={onToggleTheme}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("common.themeMode", { mode: themeMode })}
            aria-label={t("common.themeMode", { mode: themeMode })}
          >
            {themeMode === "system" ? <Monitor className="h-4 w-4" /> : theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("editor.aiSettings")}
            aria-label={t("editor.aiSettings")}
          >
            <Settings className="h-4 w-4" />
          </button>
          <a
            href="https://github.com/maxgfr/db-schema-viewer"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("editor.githubRepo")}
            aria-label={t("editor.githubRepo")}
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <SchemaSidebar
          diagram={diagram}
          selectedTableId={selectedTableId}
          onTableSelect={setSelectedTableId}
          onTableZoom={handleZoomToTable}
        />
        <div className="flex-1" ref={(el) => { canvasRef.current = el; }}>
          <SchemaCanvas
            key={`${diagram.id}-${erdNotation}`}
            diagram={diagram}
            selectedTableId={selectedTableId}
            onTableSelect={setSelectedTableId}
            onTablePositionUpdate={handleTablePositionUpdate}
            notation={erdNotation}
            zoomTarget={zoomTarget}
            annotations={annotations}
            onAnnotationUpdate={handleAnnotationUpdate}
            onAnnotationDelete={handleAnnotationDelete}
          />
        </div>
      </div>

      {/* Modals */}
      {showUpload && (
        <SchemaUpload
          onClose={() => setShowUpload(false)}
          onSQLParsed={handleNewSQL}
        />
      )}
      {showExport && (
        <ExportDialog
          diagram={diagram}
          onClose={() => setShowExport(false)}
        />
      )}
      <AIPanel
        diagram={diagram}
        onClose={() => setShowAI(false)}
        visible={showAI}
      />
      <DataExplorer
        onClose={() => setShowData(false)}
        diagram={diagram}
        visible={showData}
      />
      {showSettings && (
        <APIKeySettings onClose={() => setShowSettings(false)} />
      )}
      {showDiff && (
        <SchemaDiffPanel
          currentDiagram={diagram}
          onClose={() => setShowDiff(false)}
        />
      )}
      {showSource && diagram.sourceContent && (
        <SourceViewer
          sourceContent={diagram.sourceContent}
          diagramName={diagram.name}
          onClose={() => setShowSource(false)}
        />
      )}
    </div>
  );
}
