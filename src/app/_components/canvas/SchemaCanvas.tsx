"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeChange,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Diagram } from "@/lib/domain";
import { TableNode } from "./TableNode";
import { RelationshipEdge } from "./RelationshipEdge";

interface SchemaCanvasProps {
  diagram: Diagram;
  selectedTableId: string | null;
  onTableSelect: (tableId: string) => void;
  onTablePositionUpdate: (tableId: string, x: number, y: number) => void;
}

const nodeTypes = { table: TableNode };
const edgeTypes = { relationship: RelationshipEdge };

export function SchemaCanvas({
  diagram,
  selectedTableId,
  onTableSelect,
  onTablePositionUpdate,
}: SchemaCanvasProps) {
  const initialNodes: Node[] = useMemo(
    () =>
      diagram.tables.map((table) => ({
        id: table.id,
        type: "table",
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
    [diagram.tables, diagram.relationships, selectedTableId]
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
        data: { relationship: rel },
      })),
    [diagram.relationships]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // Persist position changes
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          onTablePositionUpdate(
            change.id,
            change.position.x,
            change.position.y
          );
        }
      }
    },
    [onNodesChange, onTablePositionUpdate]
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
      </ReactFlow>
    </div>
  );
}

function MarkerDefinitions() {
  return (
    <svg style={{ position: "absolute", top: 0, left: 0 }}>
      <defs>
        <marker
          id="one"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
        >
          <line x1="5" y1="0" x2="5" y2="10" stroke="#94a3b8" strokeWidth="2" />
        </marker>
        <marker
          id="many"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="8"
          markerHeight="8"
        >
          <path d="M0,0 L5,5 L0,10" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
        </marker>
      </defs>
    </svg>
  );
}
