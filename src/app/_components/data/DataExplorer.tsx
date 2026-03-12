"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Upload, Table, BarChart3, Download, Search, ChevronUp, ChevronDown } from "lucide-react";
import { parseSQLDump, type ParsedDumpTable } from "@/lib/dump/dump-parser";
import { inferColumnTypes } from "@/lib/dump/data-types";
import { DataCharts } from "./DataCharts";

interface DataExplorerProps {
  onClose: () => void;
}

export function DataExplorer({ onClose }: DataExplorerProps) {
  const [tables, setTables] = useState<ParsedDumpTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "chart">("table");
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 50;

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large", {
        description: "Maximum file size is 5MB. Please use a smaller SQL dump.",
      });
      return;
    }
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
        setSearchQuery("");
        setSortColumn(null);
        setSortDirection(null);
        toast.success(`Loaded ${parsed.length} tables with data`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse dump");
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleColumnSort = useCallback((col: string) => {
    setSortColumn((prev) => {
      if (prev !== col) {
        setSortDirection("asc");
        return col;
      }
      if (sortDirection === "asc") {
        setSortDirection("desc");
        return col;
      }
      setSortDirection(null);
      return null;
    });
    setPage(0);
  }, [sortDirection]);

  const currentTable = tables.find((t) => t.name === selectedTable);

  const columnTypes = useMemo(() => {
    if (!currentTable) return {};
    return inferColumnTypes(currentTable.columns, currentTable.rows);
  }, [currentTable]);

  const stats = useMemo(() => {
    if (!currentTable) return null;
    const numericCols = currentTable.columns.filter((c) => columnTypes[c] === "number");
    const textCols = currentTable.columns.filter((c) => columnTypes[c] === "string");
    return {
      rows: currentTable.rows.length,
      columns: currentTable.columns.length,
      numericCount: numericCols.length,
      textCount: textCols.length,
    };
  }, [currentTable, columnTypes]);

  const filteredRows = useMemo(() => {
    if (!currentTable) return [];
    let rows = currentTable.rows;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter((row) =>
        currentTable.columns.some((col) => {
          const val = row[col];
          return val !== null && String(val).toLowerCase().includes(query);
        })
      );
    }

    // Sort
    if (sortColumn && sortDirection) {
      const col = sortColumn;
      const dir = sortDirection;
      rows = [...rows].sort((a, b) => {
        const aVal = a[col];
        const bVal = b[col];
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        if (typeof aVal === "number" && typeof bVal === "number") {
          return dir === "asc" ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal);
        const bStr = String(bVal);
        return dir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return rows;
  }, [currentTable, searchQuery, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportCSV = useCallback(() => {
    if (!currentTable) return;
    const escapeCSV = (str: string) => {
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const header = currentTable.columns.map(escapeCSV).join(",");
    const rows = filteredRows.map((row) =>
      currentTable.columns
        .map((col) => {
          const val = row[col];
          if (val === null) return "";
          return escapeCSV(String(val));
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentTable.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }, [currentTable, filteredRows]);

  const modalContent = (
    <>
      <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto flex max-h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-bold text-foreground">Data Explorer</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="flex flex-col items-center p-12">
              <h3 className="mb-2 text-xl font-bold text-foreground">Explore Your Data</h3>
              <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
                Upload a SQL dump file containing INSERT INTO statements. You can explore data in tables, sort/filter, and generate charts. Max 5MB.
              </p>
              <div
                className={`flex w-full max-w-md flex-col items-center rounded-xl border-2 border-dashed border-border p-8 transition-colors ${
                  isDragOver ? "border-indigo-500 bg-indigo-500/10" : ""
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="mb-2 text-sm font-medium text-foreground">
                  {isDragOver ? "Drop file here..." : "Drag & drop a .sql file here"}
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Data is processed entirely in your browser.
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
              <p className="mt-4 max-w-md text-center text-xs text-muted-foreground">
                This feature parses INSERT INTO statements from .sql files to let you explore the actual data in your schema.
              </p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <select
                  value={selectedTable ?? ""}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setPage(0);
                    setSearchQuery("");
                    setSortColumn(null);
                    setSortDirection(null);
                  }}
                  className="rounded-lg border border-border bg-accent px-3 py-1.5 text-sm text-foreground focus:outline-none"
                >
                  {tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.rows.length} rows)
                    </option>
                  ))}
                </select>

                <div className="flex-1" />

                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                  title="Export CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>

                <div className="flex rounded-lg border border-border">
                  <button
                    onClick={() => setView("table")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                      view === "table" ? "bg-accent text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Table className="h-3.5 w-3.5" /> Table
                  </button>
                  <button
                    onClick={() => setView("chart")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                      view === "chart" ? "bg-accent text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" /> Charts
                  </button>
                </div>
              </div>

              {/* Stats bar */}
              {stats && (
                <div className="flex items-center gap-3 border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
                  <span>{stats.rows} rows</span>
                  <span className="text-border">|</span>
                  <span>{stats.columns} cols</span>
                  <span className="text-border">|</span>
                  <span>numeric: {stats.numericCount}</span>
                  <span className="text-border">|</span>
                  <span>text: {stats.textCount}</span>
                  {searchQuery.trim() && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-indigo-400">{filteredRows.length} matching</span>
                    </>
                  )}
                </div>
              )}

              {/* Search bar */}
              {view === "table" && currentTable && (
                <div className="border-b border-border px-4 py-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(0);
                      }}
                      placeholder="Search across all columns..."
                      className="w-full rounded-lg border border-border bg-accent py-1.5 pl-8 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {view === "table" && currentTable && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-accent/50">
                          {currentTable.columns.map((col) => (
                            <th
                              key={col}
                              onClick={() => handleColumnSort(col)}
                              className="cursor-pointer select-none whitespace-nowrap px-4 py-2 text-left font-medium text-foreground hover:bg-accent"
                            >
                              <span className="inline-flex items-center gap-1">
                                {col}
                                {sortColumn === col && sortDirection === "asc" && (
                                  <ChevronUp className="h-3 w-3 text-indigo-400" />
                                )}
                                {sortColumn === col && sortDirection === "desc" && (
                                  <ChevronDown className="h-3 w-3 text-indigo-400" />
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-border/30 hover:bg-accent/30"
                          >
                            {currentTable.columns.map((col) => (
                              <td
                                key={col}
                                className="max-w-[200px] truncate whitespace-nowrap px-4 py-1.5 text-muted-foreground"
                              >
                                {row[col] === null ? (
                                  <span className="text-muted-foreground/40">NULL</span>
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {pageRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={currentTable.columns.length}
                              className="px-4 py-8 text-center text-sm text-muted-foreground"
                            >
                              {searchQuery.trim()
                                ? "No rows match your search."
                                : "No data available."}
                            </td>
                          </tr>
                        )}
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
                <div className="flex items-center justify-between border-t border-border px-4 py-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded px-3 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded px-3 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
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
