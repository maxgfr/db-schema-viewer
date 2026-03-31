"use client";

import { memo } from "react";
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
  BaseEdge,
} from "@xyflow/react";
import type { DBRelationship } from "@/lib/domain";

export type ERDNotation = "crowsfoot" | "uml" | "chen";

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
  } else if (notation === "chen") {
    sourceLabel = cardinality === "one-to-one" ? "1" : "N";
    targetLabel = cardinality === "many-to-many" ? "N" : "1";
  } else {
    sourceLabel = cardinality === "one-to-one" ? "1" : "N";
    targetLabel = cardinality === "many-to-many" ? "N" : "1";
  }

  const isCrowsfoot = notation === "crowsfoot";
  const strokeColor = notation === "uml" ? "#8b5cf6" : notation === "chen" ? "#f59e0b" : "#6366f1";
  const sourceMarker = isCrowsfoot ? (cardinality === "one-to-one" ? "url(#cf-one)" : "url(#cf-many)") : undefined;
  const targetMarker = isCrowsfoot ? (cardinality === "one-to-one" ? "url(#cf-one)" : cardinality === "many-to-many" ? "url(#cf-many)" : "url(#cf-one)") : undefined;

  // Source handle is always Position.Right → label offset to the right
  // Target handle is always Position.Left → label offset to the left
  const labelOffset = 20;
  const isChen = notation === "chen";
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const labelColor = isChen
    ? "text-amber-600 dark:text-amber-300"
    : "text-indigo-600 dark:text-indigo-300";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: 1.5,
          opacity: notation === "uml" ? 0.8 : 0.7,
          markerStart: sourceMarker,
          markerEnd: targetMarker,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-none absolute rounded bg-card px-1 py-0.5 text-[10px] font-semibold ${labelColor}`}
          style={{
            transform: `translate(-50%, -50%) translate(${sourceX + labelOffset}px, ${sourceY}px)`,
          }}
        >
          {sourceLabel}
        </div>
        <div
          className={`nodrag nopan pointer-events-none absolute rounded bg-card px-1 py-0.5 text-[10px] font-semibold ${labelColor}`}
          style={{
            transform: `translate(-50%, -50%) translate(${targetX - labelOffset}px, ${targetY}px)`,
          }}
        >
          {targetLabel}
        </div>
        {isChen && (
          <div
            className="nodrag nopan pointer-events-none absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <polygon
                points="14,2 26,14 14,26 2,14"
                fill="#f59e0b"
                fillOpacity="0.2"
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
