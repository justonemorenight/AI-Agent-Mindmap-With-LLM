import React from "react";
import { Node, Edge, EdgeProps } from "reactflow";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Define specific types for nodes and edges
interface MindmapNode extends Node {
  id: string;
  data: {
    label: string;
  };
  position: {
    x: number;
    y: number;
  };
  style?: React.CSSProperties;
}

interface MindmapEdge extends EdgeProps {
  id: string;
  source: string;
  target: string;
  // type?: "default" | "straight" | "step" | "smoothstep" | "bezier";
  type: "smoothstep";
  animated?: boolean;
  style?: React.CSSProperties;
}

interface ParsedMindmap {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
}

interface MindmapResponse {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  error?: string;
  debug?: {
    prompt: string;
    rawResponse: string;
    timestamp: string;
    processingTime: number;
  };
}

const API_CONFIG = {
  MODEL_NAME: "gemini-1.5-flash",
  TIMEOUT: 30000,
  DEBUG: process.env.NODE_ENV === "development",
  API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
} as const;

const SYSTEM_PROMPT = `You are a mindmap generator. Your task is to generate detailed, multi-level mindmap data in JSON format that can be used with ReactFlow.

Requirements:
- IMPORTANT: Each topic MUST have at least 5-6 levels of depth
- Each node MUST have 2-3 child nodes minimum
- Break down each concept into its smallest components
- Main topic should be comprehensive and detailed
- Include relationships between concepts where relevant

Example hierarchy (minimum depth required):
Main Topic
├── Level 1 Topic A
│   ├── Level 2 Topic A1
│   │   ├── Level 3 Topic A1a
│   │   │   ├── Level 4 Topic A1a1
│   │   │   │   ├── Level 5 Topic A1a1a
│   │   │   │   └── Level 5 Topic A1a1b
│   │   │   └── Level 4 Topic A1a2
│   │   └── Level 3 Topic A1b
│   └── Level 2 Topic A2
└── Level 1 Topic B
    └── [similar depth structure...]

The JSON format must be:
{
  "nodes": [
    { 
      "id": "1", 
      "data": { "label": "Main Topic" }, 
      "position": { "x": 400, "y": 200 } 
    },
    { 
      "id": "2", 
      "data": { "label": "Level 1 Topic" }, 
      "position": { "x": 200, "y": 400 } 
    },
    { 
      "id": "3", 
      "data": { "label": "Level 2 Topic" }, 
      "position": { "x": 100, "y": 600 } 
    }
    // ... more nodes with deeper levels
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2" },
    { "id": "e2-3", "source": "2", "target": "3" }
    // ... corresponding edges
  ]
}

Remember:
- Only return JSON data in the specified format
- Do not include any explanations or additional text
- Focus on creating deep, meaningful hierarchies`;

// Update LAYOUT_CONFIG constants
const LAYOUT_CONFIG = {
  CENTER_X: 400,
  CENTER_Y: 300,
  LEVEL_WIDTH: 300,
  MIN_NODE_SPACING: 100,
  LEVEL_SPACING_FACTOR: 1.2,
  ROOT_NODE_ID: "1",
} as const;

export const MindmapService = {
  debugLog: (
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
  ) => {
    if (API_CONFIG.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`[Mindmap Service] ${message}`, data || "");
    }
  },

  extractJsonFromResponse(response: string): string {
    try {
      // Extract content between ```json and ```
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) {
        throw new Error("No JSON content found in response");
      }

      // Clean up JSON string
      const jsonStr = jsonMatch[1]
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/\n\s*\n/g, "\n")
        .trim();

      JSON.parse(jsonStr);

      return jsonStr;
    } catch (error) {
      MindmapService.debugLog("Error extracting JSON:", error);
      throw error;
    }
  },

  calculateNodePositions(
    nodes: MindmapNode[],
    edges: MindmapEdge[]
  ): MindmapNode[] {
    // Calculate levels and children for each node
    const nodeLevels = new Map<string, number>();
    const nodeChildren = new Map<string, string[]>();

    const calculateLevelsAndChildren = (nodeId: string, level: number) => {
      nodeLevels.set(nodeId, level);
      const children = edges
        .filter((edge) => edge.source === nodeId)
        .map((edge) => edge.target);
      nodeChildren.set(nodeId, children);
      children.forEach((childId) =>
        calculateLevelsAndChildren(childId, level + 1)
      );
    };

    // Calculate width needed for each subtree
    const calculateSubtreeWidth = (nodeId: string): number => {
      const children = nodeChildren.get(nodeId) || [];
      if (children.length === 0) return LAYOUT_CONFIG.MIN_NODE_SPACING;

      return Math.max(
        LAYOUT_CONFIG.MIN_NODE_SPACING,
        children.reduce(
          (sum, childId) => sum + calculateSubtreeWidth(childId),
          0
        )
      );
    };

    // Position nodes with improved spacing
    const positionNodes = (
      nodeId: string,
      startX: number,
      y: number,
      availableWidth: number
    ) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const children = nodeChildren.get(nodeId) || [];

      node.position = {
        x: startX,
        y: y,
      };

      let currentX = startX - calculateSubtreeWidth(nodeId) / 2;
      children.forEach((childId) => {
        const childWidth = calculateSubtreeWidth(childId);
        positionNodes(childId, currentX + childWidth / 2, y, availableWidth);
        currentX += childWidth;
      });
    };

    // Start from root node
    calculateLevelsAndChildren(LAYOUT_CONFIG.ROOT_NODE_ID, 0);
    positionNodes(
      LAYOUT_CONFIG.ROOT_NODE_ID,
      LAYOUT_CONFIG.CENTER_X,
      LAYOUT_CONFIG.CENTER_Y,
      LAYOUT_CONFIG.LEVEL_WIDTH
    );
    return nodes;
  },

  generateMindmap: async (prompt: string): Promise<MindmapResponse> => {
    const startTime = performance.now();
    const debugInfo = {
      prompt,
      rawResponse: "",
      timestamp: new Date().toISOString(),
      processingTime: 0,
    };

    try {
      if (!API_CONFIG.API_KEY) {
        throw new Error("Gemini API key is not configured");
      }

      MindmapService.debugLog("Initializing with prompt:", prompt);

      const genAI = new GoogleGenerativeAI(API_CONFIG.API_KEY);
      const model = genAI.getGenerativeModel({
        model: API_CONFIG.MODEL_NAME,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        },
      });

      // Combine system prompt with user prompt
      const fullPrompt = `${SYSTEM_PROMPT}\n\nGenerate a mindmap about: ${prompt}`;

      MindmapService.debugLog(
        "Generating content with full prompt:",
        fullPrompt
      );
      const result = await model.generateContent(fullPrompt);

      if (!result.response) {
        throw new Error("Failed to get response from Gemini API");
      }

      const response = await result.response;
      const rawText = response.text();

      debugInfo.rawResponse = rawText;
      MindmapService.debugLog("Raw response:", rawText);

      // Extract JSON from markdown response
      const jsonText = MindmapService.extractJsonFromResponse(rawText);

      // Validate response format
      if (!MindmapService.validateResponse(jsonText)) {
        throw new Error("Invalid response format from API");
      }

      const { nodes, edges } = JSON.parse(jsonText);

      // Calculate better positions for nodes
      const positionedNodes = MindmapService.calculateNodePositions(
        nodes,
        edges.map((edge: Edge) => ({
          ...edge,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#555" },
          markerEnd: { type: "arrowclosed" },
        }))
      );

      debugInfo.processingTime = performance.now() - startTime;

      return {
        nodes: positionedNodes,
        edges: edges.map((edge: Edge) => ({
          ...edge,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#555" },
          markerEnd: { type: "arrowclosed" },
        })),
        ...(API_CONFIG.DEBUG && { debug: debugInfo }),
      };
    } catch (error) {
      debugInfo.processingTime = performance.now() - startTime;

      // Enhanced error logging
      MindmapService.debugLog("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: error instanceof Error ? (error as any).status : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code: error instanceof Error ? (error as any).code : undefined,
      });

      return {
        nodes: [],
        edges: [],
        error:
          error instanceof Error
            ? `API Error: ${error.message}`
            : "Failed to connect to Gemini API",
        ...(API_CONFIG.DEBUG && { debug: debugInfo }),
      };
    }
  },

  validateResponse: (text: string): boolean => {
    try {
      const parsed = JSON.parse(text) as ParsedMindmap;

      const isValid =
        Array.isArray(parsed.nodes) &&
        Array.isArray(parsed.edges) &&
        parsed.nodes.length > 0 &&
        parsed.nodes.every(
          (node: MindmapNode) =>
            node.id &&
            node.data?.label &&
            typeof node.position?.x === "number" &&
            typeof node.position?.y === "number"
        ) &&
        parsed.edges.every(
          (edge: MindmapEdge) => edge.id && edge.source && edge.target
        );

      if (!isValid) {
        // eslint-disable-next-line no-console
        console.error("Invalid mindmap structure:", parsed);
      }

      return isValid;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("JSON parsing error:", error);
      return false;
    }
  },
};
