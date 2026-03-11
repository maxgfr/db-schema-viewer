"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, X, FileText, ClipboardPaste } from "lucide-react";

interface SchemaUploadProps {
  onClose: () => void;
  onSQLParsed: (sql: string, fileName?: string) => void;
}

export function SchemaUpload({ onClose, onSQLParsed }: SchemaUploadProps) {
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [pasteContent, setPasteContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          onSQLParsed(content, file.name);
          onClose();
        }
      };
      reader.readAsText(file);
    },
    [onSQLParsed, onClose]
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

  const handlePaste = useCallback(() => {
    if (pasteContent.trim()) {
      onSQLParsed(pasteContent);
      onClose();
    }
  }, [pasteContent, onSQLParsed, onClose]);

  const modalContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="animate-scale-in pointer-events-auto w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-bold text-foreground">Import Schema</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-accent"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("file")}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === "file"
                  ? "border-b-2 border-indigo-500 text-indigo-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              Upload File
            </button>
            <button
              onClick={() => setTab("paste")}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === "paste"
                  ? "border-b-2 border-indigo-500 text-indigo-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste SQL
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {tab === "file" ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50"
                }`}
              >
                <Upload className="mb-4 h-10 w-10 text-slate-500" />
                <p className="mb-1 text-sm font-medium text-slate-300">
                  Drop your schema file here or click to browse
                </p>
                <p className="text-xs text-slate-500">
                  SQL, Drizzle (.ts), Prisma (.prisma), DBML (.dbml), TypeORM (.ts){" "}
                  <span className="text-amber-400">(ORM: Beta)</span>
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
            ) : (
              <div className="space-y-4">
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={`Paste your SQL here...\n\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) NOT NULL\n);`}
                  className="h-64 w-full resize-none rounded-xl border border-slate-600 bg-slate-800 p-4 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handlePaste}
                  disabled={!pasteContent.trim()}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Parse SQL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
