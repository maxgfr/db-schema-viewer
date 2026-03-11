"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Upload, Plus, Minus, RefreshCw, ArrowRight } from "lucide-react";
import type { Diagram } from "@/lib/domain";
import { diffSchemas, type SchemaDiff, type TableDiff, type FieldDiff } from "@/lib/analysis/schema-diff";
import { parseSchemaFile } from "@/lib/parsing/parse-schema-file";

interface SchemaDiffPanelProps {
  currentDiagram: Diagram;
  onClose: () => void;
}

function FieldDiffRow({ diff }: { diff: FieldDiff }) {
  return (
    <div className="ml-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
      <div className="text-xs font-medium text-amber-400">{diff.fieldName}</div>
      {diff.changes.map((change, i) => (
        <div key={i} className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{change.property}:</span>
          <span className="text-red-400 line-through">{change.oldValue || "(empty)"}</span>
          <ArrowRight className="h-3 w-3" />
          <span className="text-emerald-400">{change.newValue || "(empty)"}</span>
        </div>
      ))}
    </div>
  );
}

function TableDiffCard({ diff }: { diff: TableDiff }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-amber-400" />
        <span className="font-medium text-foreground">{diff.tableName}</span>
      </div>

      {diff.addedFields.length > 0 && (
        <div className="mt-2 space-y-1">
          {diff.addedFields.map((f) => (
            <div key={f} className="ml-4 flex items-center gap-2 text-xs text-emerald-400">
              <Plus className="h-3 w-3" /> {f}
            </div>
          ))}
        </div>
      )}

      {diff.removedFields.length > 0 && (
        <div className="mt-2 space-y-1">
          {diff.removedFields.map((f) => (
            <div key={f} className="ml-4 flex items-center gap-2 text-xs text-red-400">
              <Minus className="h-3 w-3" /> {f}
            </div>
          ))}
        </div>
      )}

      {diff.modifiedFields.length > 0 && (
        <div className="mt-2 space-y-2">
          {diff.modifiedFields.map((fd) => (
            <FieldDiffRow key={fd.fieldName} diff={fd} />
          ))}
        </div>
      )}

      {diff.addedIndexes.length > 0 && (
        <div className="mt-2 space-y-1">
          {diff.addedIndexes.map((idx) => (
            <div key={idx} className="ml-4 flex items-center gap-2 text-xs text-emerald-400">
              <Plus className="h-3 w-3" /> index: {idx}
            </div>
          ))}
        </div>
      )}

      {diff.removedIndexes.length > 0 && (
        <div className="mt-2 space-y-1">
          {diff.removedIndexes.map((idx) => (
            <div key={idx} className="ml-4 flex items-center gap-2 text-xs text-red-400">
              <Minus className="h-3 w-3" /> index: {idx}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaDiffPanel({ currentDiagram, onClose }: SchemaDiffPanelProps) {
  const [diff, setDiff] = useState<SchemaDiff | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCompare = useCallback(
    (content: string, fileName?: string) => {
      try {
        const newDiagram = parseSchemaFile(content, fileName);
        const result = diffSchemas(currentDiagram, newDiagram);
        setDiff(result);
        toast.success(result.summary);
      } catch (err) {
        toast.error("Failed to parse schema for comparison", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [currentDiagram]
  );

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) handleCompare(content, file.name);
      };
      reader.readAsText(file);
    },
    [handleCompare]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const noChanges =
    diff &&
    diff.addedTables.length === 0 &&
    diff.removedTables.length === 0 &&
    diff.modifiedTables.length === 0 &&
    diff.addedRelationships.length === 0 &&
    diff.removedRelationships.length === 0;

  const modalContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-bold text-foreground">Schema Diff</h2>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!diff ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Upload a new schema to compare against the current one. Changes will be highlighted.
                </p>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-border hover:border-muted-foreground/50 hover:bg-accent/50"
                  }`}
                >
                  <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Drop schema file or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SQL, Drizzle (.ts), Prisma (.prisma), DBML (.dbml)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql,.txt,.ts,.js,.prisma,.dbml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-indigo-300">{diff.summary}</p>
                </div>

                {noChanges && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    The schemas are identical.
                  </p>
                )}

                {diff.addedTables.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase text-emerald-400 tracking-wider">
                      Added Tables
                    </h3>
                    {diff.addedTables.map((t) => (
                      <div key={t} className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-400">
                        <Plus className="h-4 w-4" /> {t}
                      </div>
                    ))}
                  </div>
                )}

                {diff.removedTables.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase text-red-400 tracking-wider">
                      Removed Tables
                    </h3>
                    {diff.removedTables.map((t) => (
                      <div key={t} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
                        <Minus className="h-4 w-4" /> {t}
                      </div>
                    ))}
                  </div>
                )}

                {diff.modifiedTables.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase text-amber-400 tracking-wider">
                      Modified Tables
                    </h3>
                    {diff.modifiedTables.map((td) => (
                      <TableDiffCard key={td.tableName} diff={td} />
                    ))}
                  </div>
                )}

                {diff.addedRelationships.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase text-emerald-400 tracking-wider">
                      Added Relationships
                    </h3>
                    {diff.addedRelationships.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                        <Plus className="h-3 w-3" />
                        {r.sourceTable}.{r.sourceField} → {r.targetTable}.{r.targetField}
                        <span className="ml-auto text-muted-foreground">{r.cardinality}</span>
                      </div>
                    ))}
                  </div>
                )}

                {diff.removedRelationships.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase text-red-400 tracking-wider">
                      Removed Relationships
                    </h3>
                    {diff.removedRelationships.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                        <Minus className="h-3 w-3" />
                        {r.sourceTable}.{r.sourceField} → {r.targetTable}.{r.targetField}
                        <span className="ml-auto text-muted-foreground">{r.cardinality}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setDiff(null)}
                  className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  Compare another schema
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
