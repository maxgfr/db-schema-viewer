"use client";

import { memo } from "react";
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
  BaseEdge,
} from "@xyflow/react";
import type { DBRelationship } from "@/lib/domain";

export type ERDNotation = "crowsfoot" | "uml";

interface RelationshipEdgeData {
  relationship: DBRelationship;
  notation?: ERDNotation;
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
  const { relationship, notation = "crowsfoot" } = (data ?? {}) as Partial<RelationshipEdgeData>;
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

  // Determine labels based on notation and cardinality
  let sourceLabel: string;
  let targetLabel: string;

  if (notation === "uml") {
    sourceLabel = cardinality === "one-to-one" ? "1" : "0..*";
    targetLabel = cardinality === "many-to-many" ? "0..*" : "1";
  } else {
    sourceLabel = cardinality === "one-to-one" ? "1" : "N";
    targetLabel = cardinality === "many-to-many" ? "N" : "1";
  }

  const isUML = notation === "uml";
  const strokeColor = isUML ? "#8b5cf6" : "#6366f1";
  const sourceMarker = !isUML ? (cardinality === "one-to-one" ? "url(#cf-one)" : "url(#cf-many)") : undefined;
  const targetMarker = !isUML ? (cardinality === "one-to-one" ? "url(#cf-one)" : cardinality === "many-to-many" ? "url(#cf-many)" : "url(#cf-one)") : undefined;

  // Source handle is always Position.Right → label offset to the right
  // Target handle is always Position.Left → label offset to the left
  const labelOffset = 20;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: 1.5,
          opacity: isUML ? 0.8 : 0.7,
          markerStart: sourceMarker,
          markerEnd: targetMarker,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-none absolute rounded bg-card px-1 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300"
          style={{
            transform: `translate(-50%, -50%) translate(${sourceX + labelOffset}px, ${sourceY}px)`,
          }}
        >
          {sourceLabel}
        </div>
        <div
          className="nodrag nopan pointer-events-none absolute rounded bg-card px-1 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300"
          style={{
            transform: `translate(-50%, -50%) translate(${targetX - labelOffset}px, ${targetY}px)`,
          }}
        >
          {targetLabel}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
