"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Upload,
  X,
  Database,
  Code,
  Layers,
  Braces,
  FileText,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SchemaUploadProps {
  onClose: () => void;
  onSQLParsed: (sql: string, fileName?: string) => void;
}

type SchemaFormat = "sql" | "drizzle" | "prisma" | "typeorm" | "dbml" | "auto";

interface FormatOption {
  id: SchemaFormat;
  label: string;
  icon: typeof Database;
  description: string;
  accepts: string;
  extensions: string;
  placeholder: string;
  example: string;
  synthesizedFileName: string | undefined;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "sql",
    label: "SQL",
    icon: Database,
    description:
      "PostgreSQL, MySQL, SQLite, MariaDB, Supabase, CockroachDB, ClickHouse, BigQuery, Snowflake",
    accepts: ".sql,.txt",
    extensions: ".sql, .txt",
    placeholder: "Paste your SQL schema here...",
    example: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL
);`,
    synthesizedFileName: "schema.sql",
  },
  {
    id: "drizzle",
    label: "Drizzle ORM",
    icon: Code,
    description: "TypeScript schema with pgTable, mysqlTable, or sqliteTable",
    accepts: ".ts,.js",
    extensions: ".ts, .js",
    placeholder: "Paste your Drizzle schema here...",
    example: `export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
});`,
    synthesizedFileName: "schema.ts",
  },
  {
    id: "prisma",
    label: "Prisma",
    icon: Layers,
    description: "Prisma schema with model definitions",
    accepts: ".prisma",
    extensions: ".prisma",
    placeholder: "Paste your Prisma schema here...",
    example: `model User {
  id    Int    @id @default(autoincrement())
  email String @unique
}`,
    synthesizedFileName: "schema.prisma",
  },
  {
    id: "typeorm",
    label: "TypeORM",
    icon: Braces,
    description: "TypeScript entities with @Entity, @Column decorators",
    accepts: ".ts,.js",
    extensions: ".ts, .js",
    placeholder: "Paste your TypeORM entity here...",
    example: `@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;
}`,
    synthesizedFileName: "schema.ts",
  },
  {
    id: "dbml",
    label: "DBML",
    icon: FileText,
    description: "Database Markup Language for schema definitions",
    accepts: ".dbml",
    extensions: ".dbml",
    placeholder: "Paste your DBML schema here...",
    example: `Table users {
  id integer [pk, increment]
  email varchar(255) [not null]
}`,
    synthesizedFileName: "schema.dbml",
  },
  {
    id: "auto",
    label: "Auto-Detect",
    icon: Sparkles,
    description: "Drop any supported file and we'll figure it out",
    accepts: ".sql,.txt,.ts,.js,.prisma,.dbml",
    extensions: ".sql, .txt, .ts, .js, .prisma, .dbml",
    placeholder: "Paste any supported schema format here...",
    example: "",
    synthesizedFileName: undefined,
  },
];

export function SchemaUpload({ onClose, onSQLParsed }: SchemaUploadProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFormat, setSelectedFormat] = useState<SchemaFormat | null>(
    null
  );
  const [pasteContent, setPasteContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatOption = selectedFormat
    ? FORMAT_OPTIONS.find((f) => f.id === selectedFormat)!
    : null;

  const handleFormatSelect = useCallback((format: SchemaFormat) => {
    setSelectedFormat(format);
    setStep(2);
    setPasteContent("");
    setShowPaste(false);
  }, []);

  const handleBack = useCallback(() => {
    setStep(1);
    setSelectedFormat(null);
    setPasteContent("");
    setShowPaste(false);
  }, []);

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
      reader.onerror = () => {
        toast.error("Failed to read file");
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
    if (pasteContent.trim() && formatOption) {
      onSQLParsed(pasteContent, formatOption.synthesizedFileName);
      onClose();
    }
  }, [pasteContent, formatOption, onSQLParsed, onClose]);

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
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  onClick={handleBack}
                  className="rounded-lg p-1.5 transition-colors hover:bg-accent"
                >
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Import Schema
                </h2>
                <p className="text-xs text-muted-foreground">
                  {step === 1
                    ? "Step 1 of 2 — Choose format"
                    : `Step 2 of 2 — ${formatOption?.label}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-accent"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 1 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {FORMAT_OPTIONS.map((format) => {
                  const Icon = format.icon;
                  return (
                    <button
                      key={format.id}
                      onClick={() => handleFormatSelect(format.id)}
                      className="group flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 transition-colors group-hover:bg-indigo-500/20">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {format.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                          {format.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && formatOption && (
              <div className="space-y-4">
                {/* Drag-and-drop zone */}
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
                  <p className="mb-1 text-sm font-medium text-foreground">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Accepted: {formatOption.extensions}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={formatOption.accepts}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </div>

                {/* Example snippet */}
                {formatOption.example && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Example {formatOption.label} format
                    </p>
                    <pre className="rounded-lg border border-border bg-accent/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {formatOption.example}
                    </pre>
                  </div>
                )}

                {/* Paste section (expandable) */}
                <div>
                  <button
                    onClick={() => setShowPaste(!showPaste)}
                    className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPaste ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Or paste content
                  </button>

                  {showPaste && (
                    <div className="mt-3 space-y-3">
                      <textarea
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                        placeholder={formatOption.placeholder}
                        className="h-48 w-full resize-none rounded-xl border border-border bg-accent/50 p-4 font-mono text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={handlePaste}
                        disabled={!pasteContent.trim()}
                        className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Parse {formatOption.label}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
