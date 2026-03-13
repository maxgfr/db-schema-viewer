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

/** Cardinality label with a semi-transparent background pill for readability. */
function CardinalityLabel({ x, y, label, variant = "default" }: { x: number; y: number; label: string; variant?: "default" | "chen" }) {
  const textClass = variant === "chen"
    ? "fill-indigo-300 text-[11px] font-bold"
    : "fill-slate-300 text-[10px] font-semibold";

  return (
    <g>
      <rect
        x={x - 8}
        y={y - 18}
        width={16}
        height={16}
        rx={4}
        className="fill-card/90"
        stroke="none"
      />
      <text
        x={x}
        y={y - 7}
        className={textClass}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
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
  const sourceMarker = cardinality === "one-to-one" ? "url(#cf-one)" : "url(#cf-many)";
  const targetMarker = cardinality === "one-to-one" ? "url(#cf-one)" : cardinality === "many-to-many" ? "url(#cf-many)" : "url(#cf-one)";

  const sourceLabel = cardinality === "many-to-many" ? "N" : cardinality === "one-to-one" ? "1" : "N";
  const targetLabel = cardinality === "one-to-many" ? "1" : cardinality === "many-to-many" ? "N" : "1";

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
      <CardinalityLabel
        x={sourceX + (sourceX < targetX ? 14 : -14)}
        y={sourceY}
        label={sourceLabel}
      />
      <CardinalityLabel
        x={targetX + (targetX < sourceX ? 14 : -14)}
        y={targetY}
        label={targetLabel}
      />
    </>
  );
}

function ChenEdge({ id, edgePath, cardinality, sourceX, sourceY, targetX, targetY }: {
  id: string; edgePath: string; cardinality: string;
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}) {
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
      <CardinalityLabel
        x={sourceX + (sourceX < targetX ? 14 : -14)}
        y={sourceY}
        label={sourceLabel}
        variant="chen"
      />
      <CardinalityLabel
        x={targetX + (targetX < sourceX ? 14 : -14)}
        y={targetY}
        label={targetLabel}
        variant="chen"
      />
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
