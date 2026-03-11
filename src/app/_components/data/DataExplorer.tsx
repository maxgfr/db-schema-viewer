"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Upload, Table, BarChart3 } from "lucide-react";
import { parseSQLDump, type ParsedDumpTable } from "@/lib/dump/dump-parser";
import { DataCharts } from "./DataCharts";

interface DataExplorerProps {
  onClose: () => void;
}

export function DataExplorer({ onClose }: DataExplorerProps) {
  const [tables, setTables] = useState<ParsedDumpTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "chart">("table");
  const [page, setPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 50;

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseSQLDump(content);
        if (parsed.length === 0) {
          toast.error("No INSERT statements found in the file");
          return;
        }
        setTables(parsed);
        setSelectedTable(parsed[0]!.name);
        toast.success(`Loaded ${parsed.length} tables with data`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse dump");
      }
    };
    reader.readAsText(file);
  }, []);

  const currentTable = tables.find((t) => t.name === selectedTable);
  const totalPages = currentTable
    ? Math.ceil(currentTable.rows.length / PAGE_SIZE)
    : 0;
  const pageRows = currentTable
    ? currentTable.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : [];

  const modalContent = (
    <>
      <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto flex max-h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
            <h2 className="text-lg font-bold text-white">Data Explorer</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-800">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="flex flex-col items-center p-12">
              <Upload className="mb-4 h-10 w-10 text-slate-500" />
              <p className="mb-2 text-sm font-medium text-slate-300">
                Upload a SQL dump file with INSERT statements
              </p>
              <p className="mb-6 text-xs text-slate-500">
                Max 5MB. Data is processed entirely in your browser.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
              >
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-2">
                <select
                  value={selectedTable ?? ""}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setPage(0);
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none"
                >
                  {tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.rows.length} rows)
                    </option>
                  ))}
                </select>

                <div className="flex-1" />

                <div className="flex rounded-lg border border-slate-600">
                  <button
                    onClick={() => setView("table")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                      view === "table" ? "bg-slate-700 text-white" : "text-slate-400"
                    }`}
                  >
                    <Table className="h-3.5 w-3.5" /> Table
                  </button>
                  <button
                    onClick={() => setView("chart")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                      view === "chart" ? "bg-slate-700 text-white" : "text-slate-400"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" /> Charts
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {view === "table" && currentTable && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/50">
                          {currentTable.columns.map((col) => (
                            <th
                              key={col}
                              className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-300"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-slate-700/30 hover:bg-slate-800/30"
                          >
                            {currentTable.columns.map((col) => (
                              <td
                                key={col}
                                className="max-w-[200px] truncate whitespace-nowrap px-4 py-1.5 text-slate-400"
                              >
                                {row[col] === null ? (
                                  <span className="text-slate-600">NULL</span>
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {view === "chart" && currentTable && (
                  <DataCharts table={currentTable} />
                )}
              </div>

              {/* Pagination */}
              {view === "table" && totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-700 px-4 py-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded px-3 py-1 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded px-3 py-1 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
