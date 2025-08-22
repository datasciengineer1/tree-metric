// apps/web/lib/levelLayout.ts
import type { Node, Edge } from "reactflow";

/** Vertical spacing between levels (rows) */
export const LEVEL_VSPACE = 140;
/** Horizontal spacing between nodes in the same level (columns) */
export const NODE_HSPACE = 260;

/** Resolve a node's level (fallbacks if not provided) */
export function nodeLevel(n: any, nsId: string) {
  if (typeof n.level === "number") return n.level;
  return n.id === nsId ? 0 : 1;
}

/**
 * Simple, readable grid layout:
 * - Y is driven by level (L0 top → L3… below)
 * - X is evenly distributed per level, centered around 0
 * Dagre is great, but this “level grid” is very clear for metric trees.
 */
export function applyLevelLayout(
  nodes: Node[],
  edges: Edge[],
  nsId = "ns"
): Node[] {
  // gather lightweight info
  const info = nodes.map((n: Node) => {
    const meta = (n.data as any)?.meta || {};
    const lvl = typeof meta.level === "number" ? meta.level : nodeLevel({ id: n.id, level: meta.level }, nsId);
    return { id: n.id, level: lvl };
  });

  // group by level
  const byLevel = new Map<number, string[]>();
  for (const { id, level } of info) {
    const arr = byLevel.get(level) || [];
    arr.push(id);
    byLevel.set(level, arr);
  }

  // assign X positions centered per level
  const posById: Record<string, { x: number; y: number }> = {};
  for (const [lvl, ids] of byLevel.entries()) {
    ids.sort(); // stable positions
    const count = ids.length;
    const half = (count - 1) / 2;
    ids.forEach((id, i) => {
      const x = (i - half) * NODE_HSPACE;
      const y = lvl * LEVEL_VSPACE;
      posById[id] = { x, y };
    });
  }

  return nodes.map((n) => {
    const p = posById[n.id] || { x: 0, y: 0 };
    return { ...n, position: p };
  });
}
