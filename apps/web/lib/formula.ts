export type TreeNode = { id: string; name: string; level?: number; stage?: string };
export type TreeEdge = { src: string; dst: string; weight?: number };
export type TreeData = { north_star: TreeNode; nodes: TreeNode[]; edges: TreeEdge[] };

function nameById(tree: TreeData): Record<string, string> {
  const m: Record<string,string> = { [tree.north_star.id]: tree.north_star.name };
  for (const n of tree.nodes) m[n.id] = n.name;
  return m;
}

function childrenMap(tree: TreeData): Record<string, TreeEdge[]> {
  const m: Record<string, TreeEdge[]> = {};
  for (const e of tree.edges) (m[e.dst] ||= []).push(e);
  return m;
}

/** One-level symbolic: Node = Δ(self) + Σ (w × Child) */
export function symbolicFormula(tree: TreeData, nodeId: string, defaultWeight=0.2): string {
  const names = nameById(tree);
  const ch = childrenMap(tree)[nodeId] || [];
  if (!ch.length) return `${names[nodeId]} = Δ(${names[nodeId]})`;
  const parts = ch.map(e => `${(e.weight ?? defaultWeight).toFixed(2)}×${names[e.src]}`);
  return `${names[nodeId]} = Δ(${names[nodeId]}) + ${parts.join(' + ')}`;
}

/** Numeric expansion with current deltas: each term shows contribution in pp (percentage points) */
export function numericExpansion(
  tree: TreeData,
  nodeId: string,
  deltas: Record<string, number>,
  defaultWeight=0.2
): string[] {
  const names = nameById(tree);
  const ch = childrenMap(tree)[nodeId] || [];
  const lines: string[] = [];
  const self = deltas[nodeId] ?? 0;
  lines.push(`Δ(${names[nodeId]}) = ${(self*100).toFixed(2)} pp`);
  for (const e of ch) {
    const w = e.weight ?? defaultWeight;
    const d = deltas[e.src] ?? 0;
    const contrib = w * d;
    lines.push(`${w.toFixed(2)} × ${names[e.src]} (${(d*100).toFixed(2)}%) = ${(contrib*100).toFixed(2)} pp`);
  }
  return lines;
}

/** Top path contributors to a node using DFS over children (leaves + self). */
export function topContributors(
  tree: TreeData,
  nodeId: string,
  deltas: Record<string, number>,
  defaultWeight=0.2,
  limit=5
): { path: string; contribution: number }[] {
  const names = nameById(tree);
  const chMap = childrenMap(tree);
  const out: { path: string; contribution: number }[] = [];

  // include self
  const self = deltas[nodeId] ?? 0;
  if (Math.abs(self) > 1e-6) out.push({ path: names[nodeId], contribution: self });

  function dfs(curr: string, accW: number, accPath: string[]) {
    const kids = chMap[curr] || [];
    if (!kids.length) {
      const d = deltas[curr] ?? 0;
      const c = accW * d;
      if (Math.abs(c) > 1e-6) out.push({ path: accPath.map(id=>names[id]).join(' → '), contribution: c });
      return;
    }
    for (const e of kids) {
      const w = e.weight ?? defaultWeight;
      dfs(e.src, accW * w, [e.src, ...accPath]);
    }
  }

  dfs(nodeId, 1, [nodeId]);
  out.sort((a,b)=> Math.abs(b.contribution) - Math.abs(a.contribution));
  return out.slice(0, limit);
}
