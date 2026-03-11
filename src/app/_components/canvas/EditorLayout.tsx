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
} from "lucide-react";
import type { Diagram } from "@/lib/domain";
import { DATABASE_TYPE_LABELS } from "@/lib/domain";
import { generateShareUrl, estimateUrlSize } from "@/lib/sharing/encode-state";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { SchemaCanvas } from "./SchemaCanvas";
import { SchemaSidebar } from "../schema/SchemaSidebar";
import { SchemaUpload } from "../schema/SchemaUpload";
import { ExportDialog } from "../export/ExportDialog";
import { AIPanel } from "../ai/AIPanel";
import { DataExplorer } from "../data/DataExplorer";
import { APIKeySettings } from "../settings/APIKeySettings";
import { parseSQLToDiagram } from "@/lib/sql";
import { autoLayout } from "@/lib/layout/auto-layout";

interface EditorLayoutProps {
  diagram: Diagram;
  onDiagramUpdate: (diagram: Diagram) => void;
  onBack: () => void;
}

export function EditorLayout({
  diagram,
  onDiagramUpdate,
  onBack,
}: EditorLayoutProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const canvasRef = { current: null as HTMLDivElement | null };

  const closeAll = useCallback(() => {
    setShowUpload(false);
    setShowExport(false);
    setShowAI(false);
    setShowData(false);
    setShowSettings(false);
  }, []);

  const shortcutHandlers = useMemo(
    () => ({
      onImport: () => { closeAll(); setShowUpload(true); },
      onExport: () => { closeAll(); setShowExport(true); },
      onAI: () => { closeAll(); setShowAI(true); },
      onEscape: closeAll,
      onShare: () => {
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
      },
    }),
    [closeAll, diagram]
  );

  useKeyboardShortcuts(shortcutHandlers);

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
        const newDiagram = parseSQLToDiagram(
          sql,
          fileName?.replace(/\.sql$/i, "")
        );
        const layouted = autoLayout(
          newDiagram.tables,
          newDiagram.relationships
        );
        onDiagramUpdate({ ...newDiagram, tables: layouted });
        toast.success(
          `Loaded ${newDiagram.tables.length} tables, ${newDiagram.relationships.length} relationships`
        );
      } catch (err) {
        toast.error("Failed to parse SQL", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [onDiagramUpdate]
  );

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-4 py-2">
        <button
          onClick={onBack}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          title="Back to home"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-white">{diagram.name}</h1>
          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
            {DATABASE_TYPE_LABELS[diagram.databaseType]}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Brain className="h-4 w-4" />
            AI
          </button>
          <button
            onClick={() => setShowData(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <BarChart3 className="h-4 w-4" />
            Data
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>
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
            diagram={diagram}
            selectedTableId={selectedTableId}
            onTableSelect={setSelectedTableId}
            onTablePositionUpdate={handleTablePositionUpdate}
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
      {showAI && (
        <AIPanel
          diagram={diagram}
          onClose={() => setShowAI(false)}
        />
      )}
      {showData && (
        <DataExplorer onClose={() => setShowData(false)} />
      )}
      {showSettings && (
        <APIKeySettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
