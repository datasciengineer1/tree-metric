export type DeltaMap = Record<string, number>;

type TreeNode = { id: string; name: string; level?: number; stage?: string; };
type TreeEdge = { src: string; dst: string; weight?: number };
type TreeData = { north_star: TreeNode; nodes: TreeNode[]; edges: TreeEdge[] };

/**
 * Propagate node %-deltas bottom-up to the root using edge weights.
 * - deltas[id] is interpreted as a percent change (e.g., 0.05 = +5%).
 * - Each parent receives child_delta * weight (default 0.2) plus its own base delta.
 * Returns per-node computed deltas and the root (NSM) delta.
 */
export function computePropagation(
  tree: TreeData,
  deltas: DeltaMap,
  defaultWeight = 0.2
): { byId: Record<string, number>; nsDelta: number } {
  const byId: Record<string, number> = {};
  const children: Record<string, TreeEdge[]> = {};
  for (const e of tree.edges) {
    (children[e.dst] ||= []).push(e);
  }

  function accum(id: string): number {
    if (id in byId) return byId[id];
    const base = deltas[id] ?? 0;
    const kids = children[id] || [];
    const sumKids = kids.reduce((acc, e) => {
      const w = (typeof e.weight === "number" ? e.weight : defaultWeight);
      return acc + accum(e.src) * w;
    }, 0);
    const val = base + sumKids;
    byId[id] = val;
    return val;
  }

  const nsId = tree.north_star.id;
  const nsDelta = accum(nsId);

  // ensure all nodes computed (in case of disconnected subgraphs)
  for (const n of tree.nodes) {
    if (!(n.id in byId)) byId[n.id] = deltas[n.id] ?? 0;
  }
  if (!(nsId in byId)) byId[nsId] = nsDelta;

  return { byId, nsDelta };
}
