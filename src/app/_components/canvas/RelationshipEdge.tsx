"use client";

import { memo } from "react";
import {
  getSmoothStepPath,
  type EdgeProps,
  BaseEdge,
} from "@xyflow/react";
import type { DBRelationship } from "@/lib/domain";

export type ERDNotation = "crowsfoot" | "chen";

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

  if (notation === "chen") {
    return <ChenEdge id={id} edgePath={edgePath} cardinality={cardinality} sourceX={sourceX} sourceY={sourceY} targetX={targetX} targetY={targetY} />;
  }

  return <CrowsFootEdge id={id} edgePath={edgePath} cardinality={cardinality} sourceX={sourceX} sourceY={sourceY} targetX={targetX} targetY={targetY} />;
}

function CrowsFootEdge({ id, edgePath, cardinality, sourceX, sourceY, targetX, targetY }: {
  id: string; edgePath: string; cardinality: string;
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}) {
  // Crow's Foot: source side = FK side, target side = PK side
  // one-to-many: source has crow's foot (many), target has single line (one)
  const sourceMarker = cardinality === "many-to-many" ? "url(#cf-many)" : "url(#cf-many)";
  const targetMarker = cardinality === "one-to-one" ? "url(#cf-one)" : cardinality === "many-to-many" ? "url(#cf-many)" : "url(#cf-one)";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "#6366f1",
          strokeWidth: 1.5,
          opacity: 0.7,
          markerStart: sourceMarker,
          markerEnd: targetMarker,
        }}
      />
      {/* Source label */}
      <text
        x={sourceX + (sourceX < targetX ? 14 : -14)}
        y={sourceY - 10}
        className="fill-slate-400 text-[9px] font-medium"
        textAnchor="middle"
      >
        {cardinality === "many-to-many" ? "N" : cardinality === "one-to-one" ? "1" : "N"}
      </text>
      {/* Target label */}
      <text
        x={targetX + (targetX < sourceX ? 14 : -14)}
        y={targetY - 10}
        className="fill-slate-400 text-[9px] font-medium"
        textAnchor="middle"
      >
        {cardinality === "one-to-many" ? "1" : cardinality === "many-to-many" ? "N" : "1"}
      </text>
    </>
  );
}

function ChenEdge({ id, edgePath, cardinality, sourceX, sourceY, targetX, targetY }: {
  id: string; edgePath: string; cardinality: string;
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}) {
  // Chen notation uses diamond shape for relationship and labels on edges
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const sourceLabel = cardinality === "many-to-many" ? "N" : cardinality === "one-to-one" ? "1" : "N";
  const targetLabel = cardinality === "one-to-many" ? "1" : cardinality === "many-to-many" ? "M" : "1";

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
      {/* Diamond at midpoint */}
      <polygon
        points={`${midX},${midY - 8} ${midX + 10},${midY} ${midX},${midY + 8} ${midX - 10},${midY}`}
        fill="#1e1b4b"
        stroke="#6366f1"
        strokeWidth="1.5"
        opacity="0.9"
      />
      {/* Source cardinality */}
      <text
        x={sourceX + (sourceX < targetX ? 14 : -14)}
        y={sourceY - 10}
        className="fill-indigo-300 text-[11px] font-bold"
        textAnchor="middle"
      >
        {sourceLabel}
      </text>
      {/* Target cardinality */}
      <text
        x={targetX + (targetX < sourceX ? 14 : -14)}
        y={targetY - 10}
        className="fill-indigo-300 text-[11px] font-bold"
        textAnchor="middle"
      >
        {targetLabel}
      </text>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
