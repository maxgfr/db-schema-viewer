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
}

const COLORS = [
  { bg: "bg-yellow-200 dark:bg-yellow-900/60", border: "border-yellow-400 dark:border-yellow-700" },
  { bg: "bg-blue-200 dark:bg-blue-900/60", border: "border-blue-400 dark:border-blue-700" },
  { bg: "bg-green-200 dark:bg-green-900/60", border: "border-green-400 dark:border-green-700" },
  { bg: "bg-pink-200 dark:bg-pink-900/60", border: "border-pink-400 dark:border-pink-700" },
];

function getColorClasses(color: string) {
  const idx = parseInt(color) || 0;
  return COLORS[idx % COLORS.length]!;
}

function StickyNoteNodeComponent({ id, data }: NodeProps) {
  const { t } = useTranslation();
  const { text, color, onTextChange, onDelete } = data as unknown as StickyNoteData;
  const [isEditing, setIsEditing] = useState(!text);
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
      className={`group relative min-w-[120px] max-w-[200px] rounded-lg border ${colorClasses.border} ${colorClasses.bg} p-3 shadow-md`}
    >
      <button
        onClick={() => onDelete(id)}
        className="absolute -right-2 -top-2 hidden rounded-full bg-card p-0.5 shadow-sm hover:bg-red-100 group-hover:block dark:hover:bg-red-900/50"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
      {isEditing ? (
        <textarea
          autoFocus
          defaultValue={text}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          placeholder={t("stickyNote.placeholder")}
          className="nodrag w-full resize-none bg-transparent text-xs text-gray-800 placeholder-gray-500 focus:outline-none dark:text-gray-100 dark:placeholder-gray-400"
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
