"use client";

import React from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  ConnectionMode,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  ControlButton,
} from "reactflow";
import "reactflow/dist/style.css";
import { Maximize2, Minimize2, Wand2, Loader2 } from "lucide-react";
import { MindmapService } from "@/lib/services/mindmap.service";
import dagre from "@dagrejs/dagre";
import customNode from "./customNode";
import PromptPopup from "./promptPopup";

const nodeTypes = {
  custom: customNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const CustomControls = ({
  isLocked,
  setIsLocked,
  onToggleFullscreen,
  isFullscreen,
  setIsPromptOpen,
  isPromptOpen,
}: {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  setIsPromptOpen: (open: boolean) => void;
  isPromptOpen: boolean;
}) => {
  return (
    <Controls showInteractive={false}>
      <ControlButton
        onClick={() => setIsLocked(!isLocked)}
        title={isLocked ? "Locked" : "Unlocked"}
      >
        {isLocked ? "🔒" : "🔓"}
      </ControlButton>

      <ControlButton
        onClick={onToggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? (
          <Minimize2 size={20} className="text-black dark:text-black" />
        ) : (
          <Maximize2 size={20} className="text-black dark:text-black" />
        )}
      </ControlButton>

      <ControlButton
        onClick={() => setIsPromptOpen(!isPromptOpen)}
        title="Generate mindmap with AI"
      >
        <Wand2 size={20} className="text-black dark:text-black" />
      </ControlButton>
    </Controls>
  );
};

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: "LR" | "TB" = "TB"
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: 200,
      height: 50,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 30,
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
  };
};

const Mindmap = () => {
  const [nodes, setNodes] = React.useState<Node[]>(initialNodes);
  const [edges, setEdges] = React.useState<Edge[]>(initialEdges);
  const [isLocked, setIsLocked] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const flowWrapper = React.useRef<HTMLDivElement>(null);
  const [isPromptOpen, setIsPromptOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleNodeLabelChange = React.useCallback(
    (nodeId: string, newLabel: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                label: newLabel,
              },
            };
          }
          return node;
        })
      );
    },
    []
  );

  const handleGenerateMap = React.useCallback(
    async (prompt: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await MindmapService.generateMindmap(prompt);
        if (data.error) {
          setError(data.error);
          return;
        }
        if (data.nodes && data.edges) {
          const nodesWithCustomType = data.nodes.map((node) => ({
            ...node,
            type: "custom",
            data: {
              ...node.data,
              onChange: (newLabel: string) =>
                handleNodeLabelChange(node.id, newLabel),
            },
          }));

          const { nodes: layoutedNodes, edges: layoutedEdges } =
            getLayoutedElements(nodesWithCustomType, data.edges, "TB");
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
        }
      } catch (error) {
        setError(`Error: ${error}`);
      } finally {
        setIsLoading(false);
      }
    },
    [handleNodeLabelChange]
  );

  const onNodesChange = React.useCallback(
    (changes: NodeChange[]) => {
      if (isLocked) return;
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [isLocked]
  );

  const onEdgesChange = React.useCallback(
    (changes: EdgeChange[]) => {
      if (isLocked) return;
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [isLocked]
  );

  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (isLocked) return;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: "#555" },
            animated: true,
          },
          eds
        )
      );
    },
    [isLocked]
  );

  const onToggleFullscreen = React.useCallback(() => {
    if (!flowWrapper.current) return;

    if (!document.fullscreenElement) {
      flowWrapper.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const onLayout = React.useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "TB"
    );
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [nodes, edges]);

  React.useEffect(() => {
    onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  React.useEffect(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  return (
    <div
      ref={flowWrapper}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={true}
        fitView
        nodeTypes={nodeTypes}
      >
        <Background />
        <CustomControls
          isLocked={isLocked}
          setIsLocked={setIsLocked}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={isFullscreen}
          setIsPromptOpen={setIsPromptOpen}
          isPromptOpen={isPromptOpen}
        />
      </ReactFlow>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/10">
          <Loader2 size={40} className="animate-spin text-blue-500" />
          <div className="text-lg font-medium text-gray-700">
            Generating your mindmap...
          </div>
          <div className="text-sm text-gray-500">
            Please wait while AI processes your request
          </div>
        </div>
      )}
      <PromptPopup
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        onSubmit={handleGenerateMap}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
};

export default Mindmap;
