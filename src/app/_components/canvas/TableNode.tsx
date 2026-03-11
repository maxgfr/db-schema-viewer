"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { KeyRound, Link, ChevronDown, ChevronUp } from "lucide-react";
import type { DBTable, DBField, DBRelationship } from "@/lib/domain";

interface TableNodeData {
  table: DBTable;
  isSelected: boolean;
  relationships: DBRelationship[];
}

const MAX_VISIBLE_FIELDS = 12;

function TableNodeComponent({ data }: NodeProps) {
  const { table, isSelected } = data as unknown as TableNodeData;
  const [expanded, setExpanded] = useState(false);
  const needsExpand = table.fields.length > MAX_VISIBLE_FIELDS;
  const visibleFields = expanded
    ? table.fields
    : table.fields.slice(0, MAX_VISIBLE_FIELDS);

  return (
    <div
      className={`min-w-[240px] max-w-[320px] rounded-lg border bg-slate-900 shadow-xl transition-shadow ${
        isSelected
          ? "border-indigo-500 shadow-indigo-500/20"
          : "border-slate-600 shadow-black/40"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ backgroundColor: table.color ?? "#6366f1" }}
      >
        <span className="text-sm font-bold text-white">{table.name}</span>
        {table.isView && (
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white">
            VIEW
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="divide-y divide-slate-700/50">
        {visibleFields.map((field) => (
          <TableNodeField key={field.id} field={field} />
        ))}
      </div>

      {/* Expand toggle */}
      {needsExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex w-full items-center justify-center gap-1 rounded-b-lg border-t border-slate-700/50 py-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> +{table.fields.length - MAX_VISIBLE_FIELDS} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

function TableNodeField({ field }: { field: DBField }) {
  return (
    <div className="group relative flex items-center gap-2 px-3 py-1.5">
      {/* Left handle */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${field.id}-left`}
        className="!h-2 !w-2 !border-slate-500 !bg-slate-700"
        style={{ top: "50%" }}
      />

      {/* Icons */}
      <div className="flex w-5 items-center justify-center">
        {field.primaryKey ? (
          <KeyRound className="h-3.5 w-3.5 text-amber-400" />
        ) : field.isForeignKey ? (
          <Link className="h-3.5 w-3.5 text-blue-400" />
        ) : null}
      </div>

      {/* Name */}
      <span
        className={`flex-1 truncate text-xs ${
          field.primaryKey
            ? "font-semibold text-amber-200"
            : field.isForeignKey
              ? "text-blue-200"
              : "text-slate-300"
        }`}
      >
        {field.name}
      </span>

      {/* Type */}
      <span className="font-mono text-[10px] text-slate-500">
        {field.type}
      </span>

      {/* Nullable */}
      {!field.nullable && (
        <span className="text-[10px] font-medium text-rose-400">!</span>
      )}

      {/* Right handle */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${field.id}-right`}
        className="!h-2 !w-2 !border-slate-500 !bg-slate-700"
        style={{ top: "50%" }}
      />
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
