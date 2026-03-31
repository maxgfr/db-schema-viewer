"use client";

import { memo, useState, useCallback } from "react";
import { type NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

interface StickyNoteData {
  text: string;
  color: string;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
}

const NOTE_COLORS = [
  { id: "0", light: "bg-yellow-100 border-yellow-300", dark: "dark:bg-yellow-400/20 dark:border-yellow-500/50", dot: "bg-yellow-400" },
  { id: "1", light: "bg-blue-100 border-blue-300", dark: "dark:bg-blue-400/20 dark:border-blue-500/50", dot: "bg-blue-400" },
  { id: "2", light: "bg-emerald-100 border-emerald-300", dark: "dark:bg-emerald-400/20 dark:border-emerald-500/50", dot: "bg-emerald-400" },
  { id: "3", light: "bg-pink-100 border-pink-300", dark: "dark:bg-pink-400/20 dark:border-pink-500/50", dot: "bg-pink-400" },
  { id: "4", light: "bg-orange-100 border-orange-300", dark: "dark:bg-orange-400/20 dark:border-orange-500/50", dot: "bg-orange-400" },
  { id: "5", light: "bg-purple-100 border-purple-300", dark: "dark:bg-purple-400/20 dark:border-purple-500/50", dot: "bg-purple-400" },
];

function getColorClasses(color: string) {
  const idx = parseInt(color) || 0;
  const c = NOTE_COLORS[idx % NOTE_COLORS.length]!;
  return `${c.light} ${c.dark}`;
}

function StickyNoteNodeComponent({ id, data }: NodeProps) {
  const { t } = useTranslation();
  const { text, color, onTextChange, onDelete, onColorChange } = data as unknown as StickyNoteData;
  const [isEditing, setIsEditing] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const colorClasses = getColorClasses(color);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsEditing(false);
      onTextChange(id, e.target.value);
    },
    [id, onTextChange],
  );

  return (
    <div
      className={`group relative min-w-[140px] max-w-[220px] rounded-lg border-2 ${colorClasses} p-3 shadow-lg`}
    >
      {/* Top bar: color dots + delete */}
      <div className="absolute -top-2 right-0 left-0 flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {showColors && NOTE_COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => { onColorChange?.(id, c.id); setShowColors(false); }}
            className={`h-4 w-4 rounded-full border border-white/50 shadow-sm ${c.dot} hover:scale-125 transition-transform`}
            title={`Color ${c.id}`}
          />
        ))}
        {!showColors && (
          <button
            onClick={() => setShowColors(true)}
            className={`h-4 w-4 rounded-full border border-white/50 shadow-sm ${NOTE_COLORS[parseInt(color) % NOTE_COLORS.length]?.dot ?? "bg-yellow-400"}`}
            title="Change color"
          />
        )}
        <button
          onClick={() => onDelete(id)}
          className="ml-1 rounded-full bg-card p-0.5 shadow-sm hover:bg-red-100 dark:hover:bg-red-900/50"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {isEditing ? (
        <textarea
          autoFocus
          defaultValue={text}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          placeholder={t("stickyNote.placeholder")}
          className="nodrag nowheel w-full resize-none bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none dark:text-gray-100 dark:placeholder-gray-500"
          rows={3}
        />
      ) : (
        <div
          onDoubleClick={() => setIsEditing(true)}
          className="cursor-text whitespace-pre-wrap text-xs text-gray-800 dark:text-gray-100"
          title={t("stickyNote.doubleClickToEdit")}
        >
          {text || t("stickyNote.doubleClickToEditFallback")}
        </div>
      )}
    </div>
  );
}

export const StickyNoteNode = memo(StickyNoteNodeComponent);
