"use client";

import { useState, useCallback, useMemo, useRef, useEffect, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { flushSync } from "react-dom";
import { DEFAULT_FILTERS, type Project } from "@/lib/project/project";
import { filterDiagram } from "@/lib/graph/navigation";
import { parseSchemaInput } from "@/lib/parsing/parse-input";
import type { SaveStatus } from "@/hooks/use-project-session";
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
  Palette,
  Shuffle,
  PanelLeft,
} from "lucide-react";
import type { Diagram } from "db-schema-toolkit";
import { DATABASE_TYPE_LABELS } from "db-schema-toolkit";
import { generateShareUrl, type SharedViewSettings } from "@/lib/sharing/encode-state";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { Theme, ThemeMode } from "@/hooks/use-theme";
import { SchemaCanvas, type Annotation } from "./SchemaCanvas";
import type { ERDNotation } from "./RelationshipEdge";
import { SchemaSidebar } from "../schema/SchemaSidebar";
import { SchemaUpload } from "../schema/SchemaUpload";
const ExportDialog = dynamic(() => import("../export/ExportDialog").then((m) => m.ExportDialog), { ssr: false });
const AIPanel = dynamic(() => import("../ai/AIPanel").then((m) => m.AIPanel), { ssr: false });
const DataExplorer = dynamic(() => import("../data/DataExplorer").then((m) => m.DataExplorer), { ssr: false });
const APIKeySettings = dynamic(() => import("../settings/APIKeySettings").then((m) => m.APIKeySettings), { ssr: false });
const SchemaDiffPanel = dynamic(() => import("../analysis/SchemaDiffPanel").then((m) => m.SchemaDiffPanel), { ssr: false });
const SourceViewer = dynamic(() => import("../source/SourceViewer").then((m) => m.SourceViewer), { ssr: false });
import { shuffleLayout } from "db-schema-toolkit";
import { useTranslation } from "@/lib/i18n/context";
import { LanguageToggle } from "../I18nWrapper";

interface EditorLayoutProps {
  project: Project;
  onProjectChange: (update: Partial<Project> | ((project: Project) => Partial<Project>)) => void;
  onProjectOpened: (project: Project) => void;
  saveStatus: SaveStatus;
  onSave: () => boolean;
  onBack: () => void;
  theme: Theme;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

export function EditorLayout({ project, onProjectChange, onProjectOpened, saveStatus, onSave, onBack, theme, themeMode, onToggleTheme }: EditorLayoutProps) {
  const { diagram, annotations, viewSettings } = project;
  const erdNotation = viewSettings.erdNotation ?? "crowsfoot";
  const coloredEdges = viewSettings.coloredEdges ?? false;
  const viewport = viewSettings.viewport;
  const filters = viewSettings.filters ?? DEFAULT_FILTERS;
  const visibleDiagram = useMemo(() => filterDiagram(diagram, filters), [diagram, filters]);
  const visibleTableIds = useMemo(() => new Set(visibleDiagram.tables.map((table) => table.id)), [visibleDiagram.tables]);
  const setAnnotations = useCallback((update: SetStateAction<Annotation[]>) => {
    onProjectChange((current) => ({ annotations: typeof update === "function" ? update(current.annotations) : update }));
  }, [onProjectChange]);
  const setViewSettings = useCallback((patch: SharedViewSettings) => {
    onProjectChange((current) => ({ viewSettings: { ...current.viewSettings, ...patch } }));
  }, [onProjectChange]);
  const setViewport = useCallback((next: { x: number; y: number; zoom: number }) => {
    if (next.x === viewport?.x && next.y === viewport?.y && next.zoom === viewport?.zoom) return;
    setViewSettings({ viewport: next });
  }, [viewport, setViewSettings]);
  const setErdNotation = (value: ERDNotation) => setViewSettings({ erdNotation: value });
  const setColoredEdges = (update: SetStateAction<boolean>) => setViewSettings({ coloredEdges: typeof update === "function" ? update(coloredEdges) : update });
  const onDiagramUpdate = useCallback((next: Diagram) => onProjectChange({ diagram: next }), [onProjectChange]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [fitRequest, setFitRequest] = useState(0);
  const [exportAll, setExportAll] = useState(false);
  const captureFullDiagram = useCallback(async <T,>(capture: () => Promise<T>): Promise<T> => {
    flushSync(() => setExportAll(true));
    try {
      // Hidden nodes must be measured again before React Flow can restore edges.
      // Two animation frames can precede ResizeObserver and silently omit links.
      await new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 5000;
        const check = () => {
          const viewport = document.querySelector(".react-flow__viewport");
          if (viewport?.querySelectorAll(".react-flow__node-table").length === diagram.tables.length
            && viewport.querySelectorAll(".react-flow__edge-path").length === diagram.relationships.length) resolve();
          else if (performance.now() >= deadline) reject(new Error("Diagram is not ready for export"));
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
      return await capture();
    } finally { flushSync(() => setExportAll(false)); }
  }, [diagram.tables.length, diagram.relationships.length]);
  const { t } = useTranslation();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<{ id: string; key: number } | null>(null);
  const zoomCounter = useRef(0);
  const annotationCounter = useRef(0);

  const [openedPanels, setOpenedPanels] = useState({ ai: false, data: false });
  useEffect(() => {
    if ((showAI && !openedPanels.ai) || (showData && !openedPanels.data)) {
      setOpenedPanels((prev) => ({ ai: prev.ai || showAI, data: prev.data || showData }));
    }
  }, [showAI, showData, openedPanels]);

  const handleZoomToTable = useCallback((tableId: string) => {
    zoomCounter.current++;
    setZoomTarget({ id: tableId, key: zoomCounter.current });
  }, []);

  const handleShuffle = useCallback(() => {
    const shuffled = shuffleLayout(diagram.tables);
    onDiagramUpdate({ ...diagram, tables: shuffled });
  }, [diagram, onDiagramUpdate]);

  const handleAddAnnotation = useCallback(() => {
    annotationCounter.current++;
    const id = `note-${annotationCounter.current}-${Date.now()}`;
    setAnnotations((prev) => [
      ...prev,
      { id, text: "", x: 100 + Math.random() * 200, y: 100 + Math.random() * 200, color: String(annotationCounter.current % 4) },
    ]);
  }, [setAnnotations]);

  const handleAnnotationUpdate = useCallback((id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, [setAnnotations]);

  const handleAnnotationDelete = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, [setAnnotations]);

  const closeAll = useCallback(() => {
    setShowUpload(false);
    setShowExport(false);
    setShowAI(false);
    setShowData(false);
    setShowSettings(false);
    setShowDiff(false);
    setShowSource(false);
  }, []);

  const handleShare = useCallback(async () => {
    const url = generateShareUrl(diagram, annotations, viewSettings);
    const size = url.length;
    if (size > 100_000) {
      toast.warning(t("editor.schemaVeryLarge"), {
        description: t("editor.urlLargeDesc", { size: Math.round(size / 1024) }),
      });
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("editor.shareUrlCopied"));
    } catch { toast.error(t("project.clipboardError")); }
  }, [diagram, annotations, viewSettings, t]);

  const shortcutHandlers = useMemo(
    () => ({
      onImport: () => { closeAll(); setShowUpload(true); },
      onExport: () => { closeAll(); setShowExport(true); },
      onAI: () => { closeAll(); setShowAI(true); },
      onEscape: closeAll,
      onShare: handleShare,
      onSave: () => { onSave(); },
    }),
    [closeAll, handleShare, onSave]
  );

  useKeyboardShortcuts(shortcutHandlers);

  const handleTablePositionsUpdate = useCallback((positions: Array<{ id: string; x: number; y: number }>) => {
    const index = new Map(positions.map((position) => [position.id, position]));
    onProjectChange((current) => ({ diagram: { ...current.diagram, tables: current.diagram.tables.map((table) => {
      const position = index.get(table.id);
      return position ? { ...table, x: position.x, y: position.y } : table;
    }) } }));
  }, [onProjectChange]);

  const handleNewSQL = useCallback(async (sql: string, fileName?: string, signal?: AbortSignal) => {
    const next = await parseSchemaInput(sql, fileName, signal);
    signal?.throwIfAborted();
    onProjectOpened(next);
  }, [onProjectOpened]);

  return (
    <div className="flex h-dvh flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
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

        <button className="rounded-md p-2 hover:bg-accent md:hidden" aria-label={t("navigation.toggleSidebar")} aria-expanded={showSidebar} aria-controls="schema-sidebar" onClick={() => setShowSidebar((shown) => !shown)}><PanelLeft className="h-4 w-4" /></button>
        <div className="mx-2 h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <h1 className="max-w-[40vw] truncate text-sm font-semibold text-foreground">{diagram.name}</h1>
          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-300">
            {DATABASE_TYPE_LABELS[diagram.databaseType]}
          </span>
        </div>

        <div role="status" className="text-xs text-muted-foreground">
          {t(`project.${saveStatus}`)}
          {saveStatus === "error" && <button className="ml-2 rounded px-2 py-1 text-foreground underline" onClick={() => onSave()}>{t("project.retry")}</button>}
        </div>
        <div className="flex-1" />

        <div className="flex max-w-full items-center gap-1 overflow-x-auto [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>button>svg]:shrink-0">
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
            aria-label={t("editor.addStickyNote")}
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

          <button
            onClick={() => setColoredEdges((v) => !v)}
            className={`rounded-lg p-2 transition-colors ${coloredEdges ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            title={t("editor.coloredEdges")}
            aria-label={t("editor.coloredEdges")}
          >
            <Palette className="h-4 w-4" />
          </button>

          <button
            onClick={handleShuffle}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("editor.shuffleLayout")}
            aria-label={t("editor.shuffleLayout")}
          >
            <Shuffle className="h-4 w-4" />
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
        <div id="schema-sidebar" className={showSidebar ? "block" : "hidden md:block"}>
        <SchemaSidebar
          diagram={diagram}
          selectedTableId={selectedTableId}
          onTableSelect={setSelectedTableId}
          onTableZoom={handleZoomToTable}
          filters={filters}
          onFiltersChange={(next) => setViewSettings({ filters: next })}
          visibleDiagram={visibleDiagram}
          onFitResults={() => setFitRequest((value) => value + 1)}
        />
        </div>
        <div className="min-w-0 flex-1">
          <SchemaCanvas
            key={diagram.id}
            diagram={diagram}
            selectedTableId={selectedTableId}
            onTableSelect={setSelectedTableId}
            onTablePositionsUpdate={handleTablePositionsUpdate}
            visibleTableIds={exportAll ? undefined : visibleTableIds}
            fitRequest={fitRequest}
            notation={erdNotation}
            coloredEdges={coloredEdges}
            zoomTarget={zoomTarget}
            annotations={annotations}
            onAnnotationUpdate={handleAnnotationUpdate}
            onAnnotationDelete={handleAnnotationDelete}
            initialViewport={viewSettings.viewport}
            onViewportChange={setViewport}
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
          project={project}
          captureFullDiagram={captureFullDiagram}
          onClose={() => setShowExport(false)}
        />
      )}
      {(showAI || openedPanels.ai) && <AIPanel
        diagram={diagram}
        onClose={() => setShowAI(false)}
        visible={showAI}
      />}
      {(showData || openedPanels.data) && <DataExplorer
        onClose={() => setShowData(false)}
        diagram={diagram}
        visible={showData}
      />}
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
