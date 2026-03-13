"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Download, Search, ChevronUp, ChevronDown } from "lucide-react";
import type { ParsedDumpTable } from "@/lib/dump/dump-parser";
import { downloadBlob } from "@/lib/export/image-export";

interface DataGridProps {
  table: ParsedDumpTable;
}

const PAGE_SIZE = 50;

export function DataGrid({ table }: DataGridProps) {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

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

  const filteredRows = useMemo(() => {
    let rows = table.rows;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter((row) =>
        table.columns.some((col) => {
          const val = row[col];
          return val !== null && String(val).toLowerCase().includes(query);
        })
      );
    }

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
  }, [table, searchQuery, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportCSV = useCallback(() => {
    const escapeCSV = (str: string) => {
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const header = table.columns.map(escapeCSV).join(",");
    const rows = filteredRows.map((row) =>
      table.columns
        .map((col) => {
          const val = row[col];
          if (val === null) return "";
          return escapeCSV(String(val));
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    downloadBlob(csv, `${table.name}.csv`, "text/csv");
    toast.success("CSV exported");
  }, [table, filteredRows]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <div className="flex-1" />
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          title="Export CSV"
          aria-label="Export as CSV"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      {/* Search */}
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
            aria-label="Search data"
            className="w-full rounded-lg border border-border bg-accent py-1.5 pl-8 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {searchQuery.trim() && (
        <div className="border-b border-border px-4 py-1.5 text-xs text-indigo-400">
          {filteredRows.length} matching rows
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/50">
                {table.columns.map((col) => (
                  <th
                    key={col}
                    scope="col"
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
                  {table.columns.map((col) => (
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
                    colSpan={table.columns.length}
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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
  );
}
