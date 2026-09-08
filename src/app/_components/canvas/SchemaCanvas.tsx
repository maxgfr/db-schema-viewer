"use client";

import { useMemo, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  type Node,
  type Edge,
  type NodeChange,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Diagram } from "db-schema-toolkit";
import { indexRelationships } from "@/lib/graph/navigation";
import { TableNode } from "./TableNode";
import { RelationshipEdge, type ERDNotation } from "./RelationshipEdge";
import { StickyNoteNode } from "./StickyNoteNode";

export interface Annotation {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

interface SchemaCanvasProps {
  diagram: Diagram;
  selectedTableId: string | null;
  onTableSelect: (tableId: string) => void;
  onTablePositionsUpdate: (positions: Array<{ id: string; x: number; y: number }>) => void;
  visibleTableIds?: Set<string>;
  fitRequest?: number;
  notation?: ERDNotation;
  coloredEdges?: boolean;
  zoomTarget?: { id: string; key: number } | null;
  annotations?: Annotation[];
  onAnnotationUpdate?: (id: string, patch: Partial<Annotation>) => void;
  onAnnotationDelete?: (id: string) => void;
  initialViewport?: { x: number; y: number; zoom: number };
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}

const EMPTY_RELATIONSHIPS: Diagram["relationships"] = [];

const nodeTypes = { table: TableNode, stickyNote: StickyNoteNode };
const edgeTypes = { relationship: RelationshipEdge };

const EDGE_COLOR_PALETTE = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#a855f7", // purple
  "#e11d48", // rose
  "#0ea5e9", // sky
  "#d946ef", // fuchsia
];

function FitViewHandler({ zoomTarget, fitRequest = 0 }: { zoomTarget?: { id: string; key: number } | null; fitRequest?: number }) {
  const { fitView } = useReactFlow();
  const lastKey = useRef<number | null>(null);

  useEffect(() => {
    if (zoomTarget && zoomTarget.key !== lastKey.current) {
      lastKey.current = zoomTarget.key;
      fitView({ nodes: [{ id: zoomTarget.id }], duration: 500, padding: 0.5 });
    }
  }, [zoomTarget, fitView]);

  useEffect(() => {
    if (fitRequest) fitView({ duration: 300, padding: 0.2 });
  }, [fitRequest, fitView]);
  return null;
}

function SchemaCanvasInner({
  diagram,
  selectedTableId,
  onTableSelect,
  onTablePositionsUpdate, visibleTableIds, fitRequest,
  notation = "crowsfoot",
  coloredEdges = false,
  zoomTarget,
  annotations = [],
  onAnnotationUpdate,
  onAnnotationDelete,
  initialViewport,
  onViewportChange,
}: SchemaCanvasProps) {
  const handleNoteTextChange = useCallback(
    (id: string, text: string) => onAnnotationUpdate?.(id, { text }),
    [onAnnotationUpdate],
  );

  const handleNoteDelete = useCallback(
    (id: string) => onAnnotationDelete?.(id),
    [onAnnotationDelete],
  );

  const handleNoteColorChange = useCallback(
    (id: string, color: string) => onAnnotationUpdate?.(id, { color }),
    [onAnnotationUpdate],
  );

  const relationshipIndex = useMemo(() => indexRelationships(diagram.relationships), [diagram.relationships]);
  const initialNodes: Node[] = useMemo(
    () => [
      ...diagram.tables.map((table) => ({
        id: table.id,
        type: "table" as const,
        hidden: visibleTableIds ? !visibleTableIds.has(table.id) : false,
        position: { x: table.x, y: table.y },
        data: {
          table,
          isSelected: table.id === selectedTableId,
          relationships: relationshipIndex.get(table.id) ?? EMPTY_RELATIONSHIPS,
        },
        selected: table.id === selectedTableId,
      })),
      ...annotations.map((note) => ({
        id: note.id,
        type: "stickyNote" as const,
        position: { x: note.x, y: note.y },
        data: {
          text: note.text,
          color: note.color,
          onTextChange: handleNoteTextChange,
          onDelete: handleNoteDelete,
          onColorChange: handleNoteColorChange,
        },
      })),
    ],
    [diagram.tables, relationshipIndex, visibleTableIds, selectedTableId, annotations, handleNoteTextChange, handleNoteDelete, handleNoteColorChange]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      diagram.relationships.map((rel, index) => ({
        id: rel.id,
        type: "relationship",
        hidden: visibleTableIds ? !(visibleTableIds.has(rel.sourceTableId) && visibleTableIds.has(rel.targetTableId)) : false,
        source: rel.sourceTableId,
        target: rel.targetTableId,
        sourceHandle: `${rel.sourceFieldId}-right`,
        targetHandle: `${rel.targetFieldId}-left`,
        data: {
          relationship: rel,
          notation,
          edgeColor: coloredEdges ? EDGE_COLOR_PALETTE[index % EDGE_COLOR_PALETTE.length] : undefined,
        },
      })),
    [diagram.relationships, notation, coloredEdges, visibleTableIds]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  useEffect(() => {
    setNodes((currentNodes) => {
      const index = new Map(currentNodes.map((node) => [node.id, node]));
      return initialNodes.map((next) => {
        const old = index.get(next.id);
        if (!old) return next;
        const samePosition = old.position.x === next.position.x && old.position.y === next.position.y;
        const sameData = Object.keys(next.data).every((key) => old.data[key] === next.data[key]);
        if (samePosition && sameData && old.selected === next.selected && old.hidden === next.hidden) return old;
        return { ...old, ...next, position: samePosition ? old.position : next.position, data: sameData ? old.data : next.data };
      });
    });
  }, [initialNodes, setNodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const positions: Array<{ id: string; x: number; y: number }> = [];
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          // Check if this is a sticky note or a table
          const isNote = annotations.some((n) => n.id === change.id);
          if (isNote) {
            onAnnotationUpdate?.(change.id, { x: change.position.x, y: change.position.y });
          } else {
            positions.push({ id: change.id, x: change.position.x, y: change.position.y });
          }
        }
      }
      if (positions.length) onTablePositionsUpdate(positions);
    },
    [onNodesChange, onTablePositionsUpdate, annotations, onAnnotationUpdate]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "table") onTableSelect(node.id);
    },
    [onTableSelect]
  );

  const handleMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      onViewportChange?.(viewport);
    },
    [onViewportChange],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={!initialViewport}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={initialViewport ?? { x: 0, y: 0, zoom: 0.8 }}
        onMoveEnd={handleMoveEnd}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!text-border" />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!rounded-lg !border !border-border !bg-muted"
        />
        <Controls />
        <ViewportPortal><MarkerDefinitions /></ViewportPortal>
        <FitViewHandler zoomTarget={zoomTarget} fitRequest={fitRequest} />
      </ReactFlow>
    </div>
  );
}

export function SchemaCanvas(props: SchemaCanvasProps) {
  return (
    <ReactFlowProvider>
      <SchemaCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function MarkerDefinitions() {
  const colors = ["#6366f1", ...EDGE_COLOR_PALETTE];
  // Deduplicate
  const uniqueColors = [...new Set(colors)];
  return (
    <svg style={{ position: "absolute", top: 0, left: 0 }}>
      <defs>
        {uniqueColors.map((color) => {
          const suffix = color === "#6366f1" ? "" : `-${color.replace("#", "")}`;
          return (
            <g key={color}>
              <marker id={`cf-one${suffix}`} viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto">
                <line x1="6" y1="1" x2="6" y2="11" stroke={color} strokeWidth="2" />
              </marker>
              <marker id={`cf-many${suffix}`} viewBox="0 0 12 12" refX="1" refY="6" markerWidth="10" markerHeight="10" orient="auto">
                <path d="M10,1 L1,6 L10,11" stroke={color} strokeWidth="1.5" fill="none" />
              </marker>
            </g>
          );
        })}
      </defs>
    </svg>
  );
}
