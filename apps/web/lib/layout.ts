// apps/web/lib/layout.ts
import * as dagre from "dagre";
import type { Edge, Node } from "reactflow";

export const LANES = [
  "North Star",
  "Activation",
  "Engagement",
  "Retention",
  "Referral",
  "Revenue",
] as const;

export type StageName = typeof LANES[number];

export const LANE_HEIGHT = 140;

export function stageIndex(stage?: string): number {
  if (!stage) return 2; // default to Engagement
  const i = LANES.findIndex(
    (s) => s.toLowerCase() === stage.toLowerCase().trim()
  );
  return i >= 0 ? i : 2;
}

/**
 * Dagre layout for X; pin Y to a lane (stage) with small offset by level.
 * Node is expected to carry data.meta = { stage?: string, level?: number }.
 */
export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 40,
    ranksep: 80,
    edgesep: 20,
    ranker: "longest-path",
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => {
    g.setNode(n.id, { width: 220, height: 40 });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const dag = g.node(n.id);
    const meta = (n.data as any)?.meta || {};
    const lvl = typeof meta.level === "number" ? meta.level : 1;
    const laneY = stageIndex(meta.stage) * LANE_HEIGHT;
    return {
      ...n,
      position: { x: dag?.x ?? 0, y: laneY + lvl * 28 },
    };
  });
}
