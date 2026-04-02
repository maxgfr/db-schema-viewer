"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, Table, Eye, ChevronDown, ChevronRight, KeyRound, Link, SearchX, ChevronsUpDown, ChevronsDownUp, Hash, FolderOpen } from "lucide-react";
import type { Diagram } from "db-schema-toolkit";
import { useTranslation } from "@/lib/i18n/context";

interface SchemaSidebarProps {
  diagram: Diagram;
  selectedTableId: string | null;
  onTableSelect: (tableId: string) => void;
  onTableZoom?: (tableId: string) => void;
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
  onTableZoom,
}: SchemaSidebarProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  const expandAll = useCallback(() => {
    setExpandedTables(new Set(diagram.tables.map((t) => t.id)));
  }, [diagram.tables]);

  const collapseAll = useCallback(() => {
    setExpandedTables(new Set());
  }, []);

  const totalFKs = useMemo(
    () => diagram.tables.reduce((sum, t) => sum + t.fields.filter((f) => f.isForeignKey).length, 0),
    [diagram.tables],
  );

  // Group tables by schema
  const groupedTables = useMemo(() => {
    const groups = new Map<string, typeof filteredTables>();
    for (const table of filteredTables) {
      const group = table.schema || "default";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(table);
    }
    return groups;
  }, [filteredTables]);

  const hasMultipleGroups = groupedTables.size > 1;

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const searchTerm = search.trim();

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Search + Expand/Collapse */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("sidebar.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-accent py-2 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
            aria-label={t("sidebar.searchAriaLabel")}
          />
        </div>
        <div className="mt-2 flex gap-1">
          <button
            onClick={expandAll}
            className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            title={t("sidebar.expandAllTitle")}
          >
            <ChevronsUpDown className="h-3 w-3" />
            {t("sidebar.expandAll")}
          </button>
          <button
            onClick={collapseAll}
            className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            title={t("sidebar.collapseAllTitle")}
          >
            <ChevronsDownUp className="h-3 w-3" />
            {t("sidebar.collapseAll")}
          </button>
        </div>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTables.length === 0 && searchTerm && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t("sidebar.noMatch", { term: searchTerm })}
            </p>
            <button
              onClick={() => setSearch("")}
              className="text-xs text-indigo-400 hover:underline"
            >
              {t("sidebar.clearSearch")}
            </button>
          </div>
        )}

        {Array.from(groupedTables.entries()).map(([group, tables]) => {
          const isGroupCollapsed = collapsedGroups.has(group);

          return (
            <div key={group}>
              {hasMultipleGroups && (
                <button
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {isGroupCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  <FolderOpen className="h-3 w-3" />
                  {group}
                  <span className="ml-auto font-normal">{tables.length}</span>
                </button>
              )}

              {!isGroupCollapsed && tables.map((table) => {
                const isExpanded = expandedTables.has(table.id);
                const isSelected = selectedTableId === table.id;
                const fkCount = table.fields.filter((f) => f.isForeignKey).length;
                const idxCount = table.indexes.length;

                return (
                  <div key={table.id} className="mb-1">
                    <button
                      onClick={() => {
                        onTableSelect(table.id);
                        toggleExpand(table.id);
                      }}
                      onDoubleClick={() => onTableZoom?.(table.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                          : "text-foreground/80 hover:bg-accent"
                      }`}
                      title={t("sidebar.clickToExpand")}
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
                      <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                        {fkCount > 0 && (
                          <span className="flex items-center gap-0.5 text-blue-400" title={t("sidebar.foreignKeys", { count: fkCount })}>
                            <Link className="h-2.5 w-2.5" />{fkCount}
                          </span>
                        )}
                        {idxCount > 0 && (
                          <span className="flex items-center gap-0.5 text-emerald-400" title={t("sidebar.indexes", { count: idxCount })}>
                            <Hash className="h-2.5 w-2.5" />{idxCount}
                          </span>
                        )}
                        <span>{table.fields.length}</span>
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
          );
        })}
      </div>

      {/* Stats */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filteredTables.length !== diagram.tables.length
              ? t("sidebar.tablesFiltered", { filtered: filteredTables.length, total: diagram.tables.length })
              : t("sidebar.tables", { count: diagram.tables.length })}
          </span>
          <span>{t("sidebar.fks", { count: totalFKs })}</span>
          <span>{t("sidebar.rels", { count: diagram.relationships.length })}</span>
        </div>
      </div>
    </div>
  );
}
