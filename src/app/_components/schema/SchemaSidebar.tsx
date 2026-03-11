"use client";

import { useState, useMemo } from "react";
import { Search, Table, Eye, ChevronDown, ChevronRight, KeyRound, Link } from "lucide-react";
import type { Diagram } from "@/lib/domain";

interface SchemaSidebarProps {
  diagram: Diagram;
  selectedTableId: string | null;
  onTableSelect: (tableId: string) => void;
}

export function SchemaSidebar({
  diagram,
  selectedTableId,
  onTableSelect,
}: SchemaSidebarProps) {
  const [search, setSearch] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const filteredTables = useMemo(() => {
    if (!search.trim()) return diagram.tables;
    const lower = search.toLowerCase();
    return diagram.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.fields.some((f) => f.name.toLowerCase().includes(lower))
    );
  }, [diagram.tables, search]);

  const toggleExpand = (tableId: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-700 bg-slate-900">
      {/* Search */}
      <div className="border-b border-slate-700 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTables.map((table) => {
          const isExpanded = expandedTables.has(table.id);
          const isSelected = selectedTableId === table.id;

          return (
            <div key={table.id} className="mb-1">
              <button
                onClick={() => {
                  onTableSelect(table.id);
                  toggleExpand(table.id);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" />
                )}
                {table.isView ? (
                  <Eye className="h-4 w-4 shrink-0 text-purple-400" />
                ) : (
                  <Table className="h-4 w-4 shrink-0 text-indigo-400" />
                )}
                <span className="truncate font-medium">{table.name}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {table.fields.length}
                </span>
              </button>

              {isExpanded && (
                <div className="ml-7 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
                  {table.fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs"
                    >
                      {field.primaryKey && (
                        <KeyRound className="h-3 w-3 shrink-0 text-amber-400" />
                      )}
                      {field.isForeignKey && !field.primaryKey && (
                        <Link className="h-3 w-3 shrink-0 text-blue-400" />
                      )}
                      {!field.primaryKey && !field.isForeignKey && (
                        <span className="w-3" />
                      )}
                      <span className="truncate text-slate-300">
                        {field.name}
                      </span>
                      <span className="ml-auto font-mono text-slate-500">
                        {field.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="border-t border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{diagram.tables.length} tables</span>
          <span>{diagram.relationships.length} relationships</span>
        </div>
      </div>
    </div>
  );
}
