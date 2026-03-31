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
  type Node,
  type Edge,
  type NodeChange,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Diagram } from "@/lib/domain";
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
  onTablePositionUpdate: (tableId: string, x: number, y: number) => void;
  notation?: ERDNotation;
  zoomTarget?: { id: string; key: number } | null;
  annotations?: Annotation[];
  onAnnotationUpdate?: (id: string, patch: Partial<Annotation>) => void;
  onAnnotationDelete?: (id: string) => void;
}

const nodeTypes = { table: TableNode, stickyNote: StickyNoteNode };
const edgeTypes = { relationship: RelationshipEdge };

function FitViewHandler({ zoomTarget }: { zoomTarget?: { id: string; key: number } | null }) {
  const { fitView } = useReactFlow();
  const lastKey = useRef<number | null>(null);

  useEffect(() => {
    if (zoomTarget && zoomTarget.key !== lastKey.current) {
      lastKey.current = zoomTarget.key;
      fitView({ nodes: [{ id: zoomTarget.id }], duration: 500, padding: 0.5 });
    }
  }, [zoomTarget, fitView]);

  return null;
}

function SchemaCanvasInner({
  diagram,
  selectedTableId,
  onTableSelect,
  onTablePositionUpdate,
  notation = "crowsfoot",
  zoomTarget,
  annotations = [],
  onAnnotationUpdate,
  onAnnotationDelete,
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

  const initialNodes: Node[] = useMemo(
    () => [
      ...diagram.tables.map((table) => ({
        id: table.id,
        type: "table" as const,
        position: { x: table.x, y: table.y },
        data: {
          table,
          isSelected: table.id === selectedTableId,
          relationships: diagram.relationships.filter(
            (r) => r.sourceTableId === table.id || r.targetTableId === table.id
          ),
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
    [diagram.tables, diagram.relationships, selectedTableId, annotations, handleNoteTextChange, handleNoteDelete, handleNoteColorChange]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      diagram.relationships.map((rel) => ({
        id: rel.id,
        type: "relationship",
        source: rel.sourceTableId,
        target: rel.targetTableId,
        sourceHandle: `${rel.sourceFieldId}-right`,
        targetHandle: `${rel.targetFieldId}-left`,
        data: { relationship: rel, notation },
      })),
    [diagram.relationships, notation]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Sync annotation changes into React Flow nodes (useNodesState only uses initialNodes on mount)
  useEffect(() => {
    setNodes((currentNodes) => {
      const tableNodes = currentNodes.filter((n) => n.type !== "stickyNote");
      const noteNodes: Node[] = annotations.map((note) => ({
        id: note.id,
        type: "stickyNote",
        position: { x: note.x, y: note.y },
        data: {
          text: note.text,
          color: note.color,
          onTextChange: handleNoteTextChange,
          onDelete: handleNoteDelete,
          onColorChange: handleNoteColorChange,
        },
      }));
      return [...tableNodes, ...noteNodes];
    });
  }, [annotations, setNodes, handleNoteTextChange, handleNoteDelete, handleNoteColorChange]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          // Check if this is a sticky note or a table
          const isNote = annotations.some((n) => n.id === change.id);
          if (isNote) {
            onAnnotationUpdate?.(change.id, { x: change.position.x, y: change.position.y });
          } else {
            onTablePositionUpdate(change.id, change.position.x, change.position.y);
          }
        }
      }
    },
    [onNodesChange, onTablePositionUpdate, annotations, onAnnotationUpdate]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onTableSelect(node.id);
    },
    [onTableSelect]
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
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
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
        <MarkerDefinitions />
        <FitViewHandler zoomTarget={zoomTarget} />
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
  return (
    <svg style={{ position: "absolute", top: 0, left: 0 }}>
      <defs>
        <marker id="cf-one" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto">
          <line x1="6" y1="1" x2="6" y2="11" stroke="#6366f1" strokeWidth="2" />
        </marker>
        <marker id="cf-many" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="10" markerHeight="10" orient="auto">
          <path d="M10,1 L1,6 L10,11" stroke="#6366f1" strokeWidth="1.5" fill="none" />
        </marker>
      </defs>
    </svg>
  );
}
