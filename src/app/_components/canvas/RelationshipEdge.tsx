"use client";

import { memo } from "react";
import {
  getSmoothStepPath,
  type EdgeProps,
  BaseEdge,
} from "@xyflow/react";
import type { DBRelationship } from "@/lib/domain";

interface RelationshipEdgeData {
  relationship: DBRelationship;
}

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const { relationship } = (data ?? {}) as Partial<RelationshipEdgeData>;
  const cardinality = relationship?.cardinality ?? "one-to-many";

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const sourceLabel = cardinality === "many-to-many" ? "N" : "1";
  const targetLabel = cardinality === "one-to-one" ? "1" : "N";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "#6366f1",
          strokeWidth: 1.5,
          opacity: 0.7,
        }}
      />
      {/* Source cardinality */}
      <text
        x={sourceX + (sourceX < targetX ? 12 : -12)}
        y={sourceY - 8}
        className="fill-slate-400 text-[10px] font-bold"
        textAnchor="middle"
      >
        {sourceLabel}
      </text>
      {/* Target cardinality */}
      <text
        x={targetX + (targetX < sourceX ? 12 : -12)}
        y={targetY - 8}
        className="fill-slate-400 text-[10px] font-bold"
        textAnchor="middle"
      >
        {targetLabel}
      </text>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
