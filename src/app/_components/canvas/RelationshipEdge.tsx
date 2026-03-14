"use client";

import { memo } from "react";
import {
  getSmoothStepPath,
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

  if (notation === "uml") {
    return <UMLEdge id={id} edgePath={edgePath} cardinality={cardinality} sourceX={sourceX} sourceY={sourceY} targetX={targetX} targetY={targetY} />;
  }

  return <CrowsFootEdge id={id} edgePath={edgePath} cardinality={cardinality} sourceX={sourceX} sourceY={sourceY} targetX={targetX} targetY={targetY} />;
}

// ── Crow's Foot notation ──────────────────────────────────────────

function CrowsFootEdge({ id, edgePath, cardinality, sourceX, sourceY, targetX, targetY }: {
  id: string; edgePath: string; cardinality: string;
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}) {
  const sourceMarker = cardinality === "one-to-one" ? "url(#cf-one)" : "url(#cf-many)";
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
      <CrowsFootLabel x={sourceX} y={sourceY} side={sourceX < targetX ? "right" : "left"} cardinality={cardinality} end="source" />
      <CrowsFootLabel x={targetX} y={targetY} side={targetX < sourceX ? "right" : "left"} cardinality={cardinality} end="target" />
    </>
  );
}

function CrowsFootLabel({ x, y, side, cardinality, end }: {
  x: number; y: number; side: "left" | "right"; cardinality: string; end: "source" | "target";
}) {
  const offset = side === "right" ? 16 : -16;

  let label: string;
  if (end === "source") {
    label = cardinality === "one-to-one" ? "1" : "N";
  } else {
    label = cardinality === "many-to-many" ? "N" : "1";
  }

  return (
    <g>
      <rect x={x + offset - 8} y={y - 10} width={16} height={16} rx={4} className="fill-card/90" stroke="none" />
      <text x={x + offset} y={y + 1} className="fill-slate-300 text-[10px] font-semibold" textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  );
}

// ── UML notation ──────────────────────────────────────────────────

function UMLEdge({ id, edgePath, cardinality, sourceX, sourceY, targetX, targetY }: {
  id: string; edgePath: string; cardinality: string;
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}) {
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "#8b5cf6",
          strokeWidth: 1.5,
          opacity: 0.8,
        }}
      />
      <UMLLabel x={sourceX} y={sourceY} side={sourceX < targetX ? "right" : "left"} cardinality={cardinality} end="source" />
      <UMLLabel x={targetX} y={targetY} side={targetX < sourceX ? "right" : "left"} cardinality={cardinality} end="target" />
    </>
  );
}

function UMLLabel({ x, y, side, cardinality, end }: {
  x: number; y: number; side: "left" | "right"; cardinality: string; end: "source" | "target";
}) {
  const offset = side === "right" ? 20 : -20;

  let label: string;
  if (end === "source") {
    label = cardinality === "one-to-one" ? "1" : cardinality === "many-to-many" ? "0..*" : "0..*";
  } else {
    label = cardinality === "many-to-many" ? "0..*" : "1";
  }

  return (
    <g>
      <rect x={x + offset - 14} y={y - 10} width={28} height={16} rx={4} className="fill-card/90" stroke="none" />
      <text x={x + offset} y={y + 1} className="fill-purple-300 text-[10px] font-bold" textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
