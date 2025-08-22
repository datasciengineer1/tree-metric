'use client';
import React, { useMemo, useState } from 'react';

type TreeNode = { id: string; name: string; level?: number; stage?: string; };
type TreeData = { north_star: TreeNode; nodes: TreeNode[]; edges: any[] };

export type Scenario = { id: string; name: string; deltas: Record<string, number>; nsDelta: number };

function inferStage(name?: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('activation') || n.includes('ftux')) return 'Activation';
  if (n.includes('retention') || n.includes('retained')) return 'Retention';
  if (n.includes('referral') || n.includes('invite')) return 'Referral';
  if (n.includes('revenue') || n.includes('arpu') || n.includes('paid') || n.includes('conversion')) return 'Revenue';
  return 'Engagement';
}

export default function ScenarioPanel({
  open,
  onClose,
  tree,
  deltas,
  setDeltas,
  nsDelta,
  scenarios,
  onSaveScenario,
  onApplyScenario,
  onDeleteScenario,
}: {
  open: boolean;
  onClose: () => void;
  tree: TreeData | null;                         // <- allow null safely
  deltas: Record<string, number>;
  setDeltas: (next: Record<string, number>) => void;
  nsDelta: number;
  scenarios: Scenario[];
  onSaveScenario: (name: string) => void;
  onApplyScenario: (id: string) => void;
  onDeleteScenario: (id: string) => void;
}) {
  const [name, setName] = useState('');

  const hasTree = Boolean(tree && tree.north_star && Array.isArray(tree.nodes));

  const list = useMemo(() => {
    if (!hasTree || !tree) return [];
    const nodes = tree.nodes.filter(n => n.id !== tree.north_star.id);
    nodes.sort((a, b) => (a.level ?? 1) - (b.level ?? 1) || a.name.localeCompare(b.name));
    return nodes;
  }, [tree, hasTree]);

  const update = (id: string, v: number) => setDeltas({ ...deltas, [id]: v });
  const reset = () => setDeltas({});

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const nsColor = nsDelta > 0.001 ? 'text-emerald-700' : nsDelta < -0.001 ? 'text-rose-700' : 'text-gray-600';
  const nsBadge = nsDelta > 0.001 ? 'bg-emerald-100' : nsDelta < -0.001 ? 'bg-rose-100' : 'bg-gray-100';

  return (
    <aside className={`fixed right-4 top-4 bottom-4 w-[420px] max-w-[92vw] rounded-2xl border shadow bg-white transition
      ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <div className="font-semibold">What-if Scenarios</div>
          {hasTree && (
            <div className={`text-sm mt-1 inline-flex items-center gap-2 ${nsColor}`}>
              NSM impact:
              <span className={`px-2 py-0.5 rounded ${nsBadge}`}>Δ {pct(nsDelta)}</span>
            </div>
          )}
        </div>
        <button className="text-sm opacity-70" onClick={onClose}>Close</button>
      </div>

      {!hasTree ? (
        <div className="p-4 text-sm opacity-70">
          Generate a tree first (left panel → <b>Generate Tree</b>), then open Scenarios to adjust inputs.
        </div>
      ) : (
        <>
          <div className="h-[calc(100%-130px)] overflow-y-auto p-4 space-y-3">
            {list.map(n => {
              const v = deltas[n.id] ?? 0;
              const stage = n.stage || inferStage(n.name);
              const level = typeof n.level === 'number' ? n.level : 1;
              return (
                <div key={n.id} className="p-3 rounded-xl border bg-white">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{n.name}</div>
                    <div className="text-xs opacity-70">L{level} • {stage}</div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="range" min="-0.2" max="0.2" step="0.01"
                      value={v}
                      onChange={(e)=>update(n.id, Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="w-16 text-right text-sm">{pct(v)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t flex items-center gap-2">
            <input
              className="flex-1 border rounded px-2 py-1"
              placeholder="Scenario name"
              value={name}
              onChange={(e)=>setName(e.target.value)}
            />
            <button
              onClick={()=>{ if(name.trim()) { onSaveScenario(name.trim()); setName(''); } }}
              disabled={!hasTree || !name.trim()}
              className="rounded-xl px-3 py-2 bg-black text-white disabled:opacity-50"
            >Save</button>
            <button onClick={reset} disabled={!hasTree} className="rounded-xl px-3 py-2 border bg-white disabled:opacity-50">Reset</button>
          </div>
        </>
      )}

      <div className="p-4 border-t">
        <div className="font-medium mb-2">Saved Scenarios</div>
        {scenarios.length === 0 ? (
          <div className="text-sm opacity-60">None yet.</div>
        ) : (
          <ul className="space-y-2">
            {scenarios.map(s => (
              <li key={s.id} className="p-2 rounded-lg border flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-xs opacity-70">Δ NSM {pct(s.nsDelta)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>onApplyScenario(s.id)} className="rounded px-2 py-1 border bg-white text-sm">Apply</button>
                  <button onClick={()=>onDeleteScenario(s.id)} className="rounded px-2 py-1 border bg-white text-sm">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
