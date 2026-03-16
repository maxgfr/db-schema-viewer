"use client";

import { useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import type { Diagram } from "@/lib/domain";
import { DATABASE_TYPE_LABELS } from "@/lib/domain";
import { generateShareUrl, estimateUrlSize } from "@/lib/sharing/encode-state";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { Theme, ThemeMode } from "@/hooks/use-theme";
import { SchemaCanvas } from "./SchemaCanvas";
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

interface EditorLayoutProps {
  diagram: Diagram;
  onDiagramUpdate: (diagram: Diagram) => void;
  onBack: () => void;
  theme: Theme;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

export function EditorLayout({
  diagram,
  onDiagramUpdate,
  onBack,
  theme,
  themeMode,
  onToggleTheme,
}: EditorLayoutProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [erdNotation, setErdNotation] = useState<ERDNotation>("crowsfoot");
  const canvasRef = { current: null as HTMLDivElement | null };

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
    if (size > 8000) {
      toast.warning("Schema is large", {
        description: `URL is ~${Math.round(size / 1024)}KB. Very large URLs may not work in all browsers.`,
      });
    }
    const url = generateShareUrl(diagram);
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Share URL copied to clipboard!");
    });
  }, [diagram]);

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
          `Loaded ${newDiagram.tables.length} tables, ${newDiagram.relationships.length} relationships`
        );
      } catch (err) {
        toast.error("Failed to parse schema", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [onDiagramUpdate]
  );

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <button
          onClick={() => {
            if (window.confirm("Go back to home? Any unsaved layout changes will be lost.")) {
              onBack();
            }
          }}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Back to home"
          aria-label="Back to home"
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
            Import
          </button>
          {diagram.sourceContent && (
            <button
              onClick={() => setShowSource(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="View original schema source code"
            >
              <FileCode className="h-4 w-4" />
              Source
            </button>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Brain className="h-4 w-4" />
            AI
          </button>
          <button
            onClick={() => setShowData(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Upload a SQL dump to explore INSERT data in tables and charts"
          >
            <BarChart3 className="h-4 w-4" />
            Data Explorer
          </button>
          <button
            onClick={() => setShowDiff(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <GitCompareArrows className="h-4 w-4" />
            Diff
          </button>

          <div className="mx-1 h-6 w-px bg-border" />

          <button
            onClick={() => setErdNotation(erdNotation === "crowsfoot" ? "uml" : "crowsfoot")}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={`Notation: ${erdNotation === "crowsfoot" ? "Crow's Foot (1, N)" : "UML (0..*, 1)"} — click to toggle`}
            aria-label="Toggle ERD notation"
          >
            {erdNotation === "crowsfoot" ? "Crow's Foot" : "UML"}
          </button>

          <div className="mx-1 h-6 w-px bg-border" />

          <button
            onClick={onToggleTheme}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={`Theme: ${themeMode} (click to cycle)`}
            aria-label={`Theme: ${themeMode} (click to cycle)`}
          >
            {themeMode === "system" ? <Monitor className="h-4 w-4" /> : theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="AI Settings"
            aria-label="AI Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <a
            href="https://github.com/maxgfr/db-schema-viewer"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="GitHub Repository"
            aria-label="GitHub Repository"
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
        />
        <div className="flex-1" ref={(el) => { canvasRef.current = el; }}>
          <SchemaCanvas
            key={`${diagram.id}-${erdNotation}`}
            diagram={diagram}
            selectedTableId={selectedTableId}
            onTableSelect={setSelectedTableId}
            onTablePositionUpdate={handleTablePositionUpdate}
            notation={erdNotation}
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
