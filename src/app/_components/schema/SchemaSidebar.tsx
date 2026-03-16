"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, Table, Eye, ChevronDown, ChevronRight, KeyRound, Link, SearchX } from "lucide-react";
import type { Diagram } from "@/lib/domain";

interface SchemaSidebarProps {
  diagram: Diagram;
  selectedTableId: string | null;
  onTableSelect: (tableId: string) => void;
}

/** Highlights all occurrences of `term` inside `text` with a <mark>. */
function HighlightMatch({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded bg-indigo-500/30 text-inherit">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
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

  const toggleExpand = useCallback((tableId: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  }, []);

  const searchTerm = search.trim();

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Search */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tables & fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-accent py-2 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
            aria-label="Search tables and fields"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTables.length === 0 && searchTerm && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No tables match &ldquo;{searchTerm}&rdquo;
            </p>
            <button
              onClick={() => setSearch("")}
              className="text-xs text-indigo-400 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

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
                    ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                    : "text-foreground/80 hover:bg-accent"
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                {table.isView ? (
                  <Eye className="h-4 w-4 shrink-0 text-purple-400" />
                ) : (
                  <Table className="h-4 w-4 shrink-0 text-indigo-400" />
                )}
                <span className="truncate font-medium">
                  <HighlightMatch text={table.name} term={searchTerm} />
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {table.fields.length}
                </span>
              </button>

              {isExpanded && (
                <div className="ml-7 mt-1 space-y-0.5 border-l border-border pl-3">
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
                      <span className="truncate text-foreground/80">
                        <HighlightMatch text={field.name} term={searchTerm} />
                      </span>
                      <span className="ml-auto font-mono text-muted-foreground">
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
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filteredTables.length !== diagram.tables.length
              ? `${filteredTables.length}/${diagram.tables.length} tables`
              : `${diagram.tables.length} tables`}
          </span>
          <span>{diagram.relationships.length} relationships</span>
        </div>
      </div>
    </div>
  );
}
