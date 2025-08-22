'use client';
import React, { useMemo, useState } from 'react';
import type { Warehouse } from '../lib/sqlTemplates';
import { sqlForNode } from '../lib/sqlTemplates';
import { symbolicFormula, numericExpansion, topContributors } from '../lib/formula';
import type { OwnerInfo, Cadence, Status } from '../lib/owners';
import { nextDueDate, formatISODate, asICS } from '../lib/owners';

type Explain = {
  node: string;
  stage: string;
  why_it_matters: string;
  how_to_move: string[];
  how_to_measure: string[];
  counter_metric: string;
  owner_suggestions?: string[];
  team_actions?: { this_week?: string[]; this_quarter?: string[] };
};

type TreeNode = { id: string; name: string; level?: number; stage?: string };
type TreeData  = { north_star: TreeNode; nodes: TreeNode[]; edges: any[] };

export type Scenario = { id: string; name: string; deltas: Record<string, number>; nsDelta: number };

function inferStage(name?: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('activation') || n.includes('ftux')) return 'Activation';
  if (n.includes('retention') || n.includes('retained')) return 'Retention';
  if (n.includes('referral')  || n.includes('invite'))   return 'Referral';
  if (n.includes('revenue')   || n.includes('arpu') || n.includes('paid') || n.includes('conversion')) return 'Revenue';
  return 'Engagement';
}
function pct(v: number) { return `${(v*100).toFixed(1)}%`; }

export default function RightPanel({
  activeTab,
  setActiveTab,
  explain,
  tree,
  selectedId,
  deltas,
  setDeltas,
  nsDelta,
  scenarios,
  onSaveScenario,
  onApplyScenario,
  onDeleteScenario,
  onCollapse,
  ownersMeta,
  setOwnersMeta,
}: {
  activeTab: 'explain' | 'scenarios' | 'math' | 'owners';
  setActiveTab: (t: 'explain' | 'scenarios' | 'math' | 'owners') => void;
  explain: Explain | null;
  tree: TreeData | null;
  selectedId: string | null;
  deltas: Record<string, number>;
  setDeltas: (next: Record<string, number>) => void;
  nsDelta: number;
  scenarios: Scenario[];
  onSaveScenario: (name: string) => void;
  onApplyScenario: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onCollapse?: () => void;
  ownersMeta: Record<string, OwnerInfo>;
  setOwnersMeta: (m: Record<string, OwnerInfo>) => void;
}) {
  const [name, setName] = useState('');
  const hasTree = Boolean(tree && tree.north_star && Array.isArray(tree.nodes));

  // Scenarios list
  const nodes = useMemo(() => {
    if (!hasTree || !tree) return [];
    const arr = tree.nodes.filter(n => n.id !== tree.north_star.id);
    arr.sort((a,b)=> (a.level ?? 1) - (b.level ?? 1) || a.name.localeCompare(b.name));
    return arr;
  }, [tree, hasTree]);

  const nsColor  = nsDelta > 0.001 ? 'text-emerald-700' : nsDelta < -0.001 ? 'text-rose-700' : 'text-gray-600';
  const nsBadge  = nsDelta > 0.001 ? 'bg-emerald-100' : nsDelta < -0.001 ? 'bg-rose-100' : 'bg-gray-100';

  // Math & SQL tab state
  const [warehouse, setWarehouse] = useState<Warehouse>('postgres');
  const [table, setTable] = useState('events');
  const [pk, setPk]       = useState('user_id');
  const [event, setEvent] = useState('core_action');

  const currentNodeName = useMemo(() => {
    if (!hasTree || !tree) return '';
    const all = [tree.north_star, ...tree.nodes];
    const hit = all.find(n => n.id === selectedId);
    return hit?.name ?? tree.north_star.name;
  }, [selectedId, tree, hasTree]);

  const math = useMemo(() => {
    if (!hasTree || !tree) return null;
    const nodeId = selectedId || tree.north_star.id;
    return {
      symbolic: symbolicFormula(tree as any, nodeId),
      numeric: numericExpansion(tree as any, nodeId, deltas),
      top: topContributors(tree as any, nodeId, deltas)
    };
  }, [tree, hasTree, selectedId, deltas]);

  // Owners tab state
  const selectedOwner: OwnerInfo = ownersMeta[selectedId || ''] || {};
  const [ownerName, setOwnerName] = useState(selectedOwner.owner || '');
  const [cadence, setCadence] = useState<Cadence>(selectedOwner.cadence || 'weekly');
  const [status, setStatus]   = useState<Status>(selectedOwner.status || 'on_track');
  const [notes, setNotes]     = useState<string>(selectedOwner.notes || '');

  React.useEffect(() => {
    setOwnerName(selectedOwner.owner || '');
    setCadence((selectedOwner.cadence as Cadence) || 'weekly');
    setStatus((selectedOwner.status as Status) || 'on_track');
    setNotes(selectedOwner.notes || '');
  }, [selectedId]); // eslint-disable-line

  const idToName = (id: string) => {
    if (!tree) return id;
    if (tree.north_star.id === id) return tree.north_star.name;
    const f = tree.nodes.find(n => n.id === id);
    return f?.name || id;
  };

  function saveOwner() {
    if (!selectedId) return;
    setOwnersMeta({
      ...ownersMeta,
      [selectedId]: {
        ...(ownersMeta[selectedId] || {}),
        owner: ownerName || undefined,
        cadence,
        status,
        notes,
      },
    });
  }

  function logCheckin() {
    if (!selectedId) return;
    setOwnersMeta({
      ...ownersMeta,
      [selectedId]: {
        ...(ownersMeta[selectedId] || {}),
        owner: ownerName || undefined,
        cadence,
        status,
        notes,
        lastCheckin: new Date().toISOString(),
      },
    });
  }

  function exportICS() {
    const ics = asICS(ownersMeta, idToName);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'metric-tree-checkins.ics'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="h-[calc(100vh-88px)] w-full rounded-2xl border shadow bg-white overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b bg-gradient-to-r from-sky-50 to-white">
        <div className="flex items-center justify-between">
          <div className="inline-flex gap-2">
            <button onClick={() => setActiveTab('explain')}
              className={`px-3 py-1.5 rounded-lg text-sm border ${activeTab==='explain' ? 'bg-white shadow-sm' : 'bg-white/50'}`}>
              Explainability
            </button>
            <button onClick={() => setActiveTab('scenarios')}
              className={`px-3 py-1.5 rounded-lg text-sm border ${activeTab==='scenarios' ? 'bg-white shadow-sm' : 'bg-white/50'}`}>
              Scenarios
            </button>
            <button onClick={() => setActiveTab('math')}
              className={`px-3 py-1.5 rounded-lg text-sm border ${activeTab==='math' ? 'bg-white shadow-sm' : 'bg-white/50'}`}>
              Math & SQL
            </button>
            <button onClick={() => setActiveTab('owners')}
              className={`px-3 py-1.5 rounded-lg text-sm border ${activeTab==='owners' ? 'bg-white shadow-sm' : 'bg-white/50'}`}>
              Owners
            </button>
          </div>
          <div className="flex items-center gap-2">
            {hasTree && (
              <div className={`text-xs ${nsColor}`}>
                NSM Δ <span className={`px-2 py-0.5 rounded ${nsBadge}`}>{pct(nsDelta)}</span>
              </div>
            )}
            <button onClick={onCollapse} title="Collapse right panel" className="text-xs px-2 py-1 rounded border bg-white">▶</button>
          </div>
        </div>
      </div>

      <div className="h-[calc(100%-56px)] overflow-y-auto p-4">
        {activeTab === 'explain' && (
          !explain ? (
            <div className="text-sm opacity-70">Click a node to see explainability.</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="text-xs uppercase opacity-60">{explain.stage}</div>
              <div className="text-base font-medium">{explain.node}</div>
              <p>{explain.why_it_matters}</p>
              <div><div className="font-medium mt-2">How to move</div><ul className="list-disc ml-5">{explain.how_to_move.map((x,i)=>(<li key={i}>{x}</li>))}</ul></div>
              <div><div className="font-medium mt-2">How to measure</div><ul className="list-disc ml-5">{explain.how_to_measure.map((x,i)=>(<li key={i}>{x}</li>))}</ul></div>
              <div className="opacity-80 mt-2"><span className="font-medium">Counter-metric:</span> {explain.counter_metric}</div>
              {explain.owner_suggestions?.length ? (<div><div className="font-medium mt-2">Suggested owners</div><ul className="list-disc ml-5">{explain.owner_suggestions.map((x,i)=>(<li key={i}>{x}</li>))}</ul></div>) : null}
              {explain.team_actions && (<div><div className="font-medium mt-2">Team actions</div>
                {explain.team_actions.this_week?.length ? (<div className="mt-1"><div className="text-xs uppercase opacity-70">This week</div><ul className="list-disc ml-5">{explain.team_actions.this_week.map((x,i)=>(<li key={i}>{x}</li>))}</ul></div>) : null}
                {explain.team_actions.this_quarter?.length ? (<div className="mt-2"><div className="text-xs uppercase opacity-70">This quarter</div><ul className="list-disc ml-5">{explain.team_actions.this_quarter.map((x,i)=>(<li key={i}>{x}</li>))}</ul></div>) : null}
              </div>)}
            </div>
          )
        )}

        {activeTab === 'scenarios' && (
          !hasTree ? (
            <div className="text-sm opacity-70">Generate a tree (left panel) to start creating scenarios.</div>
          ) : (
            <>
              <div className="space-y-3">
                {nodes.map(n => {
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
                        <input type="range" min="-0.2" max="0.2" step="0.01" value={v}
                               onChange={(e)=>setDeltas({ ...deltas, [n.id]: Number(e.target.value) })}
                               className="w-full" />
                        <div className="w-16 text-right text-sm">{(v*100).toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 rounded-xl border bg-sky-50">
                <div className="text-xs mb-2">Save scenario</div>
                <div className="flex items-center gap-2">
                  <input className="flex-1 border rounded px-2 py-1" placeholder="Scenario name"
                         value={name} onChange={(e)=>setName(e.target.value)} />
                  <button onClick={()=>{ if(name.trim()){ onSaveScenario(name.trim()); setName(''); } }}
                          className="rounded-xl px-3 py-2 bg-black text-white disabled:opacity-50"
                          disabled={!name.trim()}>
                    Save
                  </button>
                  <button onClick={()=>setDeltas({})} className="rounded-xl px-3 py-2 border bg-white">Reset</button>
                </div>
              </div>

              <div className="mt-4">
                <div className="font-medium mb-2">Saved Scenarios</div>
                {scenarios.length === 0 ? (
                  <div className="text-sm opacity-60">None yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {scenarios.map(s => (
                      <li key={s.id} className="p-2 rounded-lg border flex items-center justify-between bg-white">
                        <div>
                          <div className="font-medium text-sm">{s.name}</div>
                          <div className="text-xs opacity-70">Δ NSM {(s.nsDelta*100).toFixed(1)}%</div>
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
            </>
          )
        )}

        {activeTab === 'math' && (
          !hasTree ? (
            <div className="text-sm opacity-70">Generate a tree to view formulas and SQL templates.</div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="font-medium">Formula for: <span className="opacity-80">{currentNodeName}</span></div>
              <div className="p-3 rounded-xl border bg-white">
                <div className="text-xs uppercase opacity-60 mb-1">Symbolic</div>
                <pre className="whitespace-pre-wrap text-[12px]">{math?.symbolic}</pre>
              </div>
              <div className="p-3 rounded-xl border bg-white">
                <div className="text-xs uppercase opacity-60 mb-1">With current scenario</div>
                <pre className="whitespace-pre-wrap text-[12px]">{(math?.numeric || []).join('\n')}</pre>
              </div>
              <div className="p-3 rounded-xl border bg-white">
                <div className="text-xs uppercase opacity-60 mb-1">Top contributors</div>
                <ul className="list-disc ml-5">
                  {(math?.top || []).map((t,i)=>(
                    <li key={i}>{t.path} → {(t.contribution*100).toFixed(2)} pp</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl border bg-sky-50">
                <div className="font-medium mb-2">SQL Blueprint</div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <select className="border rounded px-2 py-1 bg-white" value={warehouse} onChange={e=>setWarehouse(e.target.value as Warehouse)}>
                    <option value="postgres">Postgres</option>
                    <option value="snowflake">Snowflake</option>
                    <option value="bigquery">BigQuery</option>
                  </select>
                  <input className="border rounded px-2 py-1 bg-white" value={table} onChange={e=>setTable(e.target.value)} placeholder="table (events)"/>
                  <input className="border rounded px-2 py-1 bg-white" value={pk} onChange={e=>setPk(e.target.value)} placeholder="user_id"/>
                  <input className="border rounded px-2 py-1 bg-white" value={event} onChange={e=>setEvent(e.target.value)} placeholder="event name"/>
                  <button
                    className="rounded px-2 py-1 border bg-white text-xs"
                    onClick={()=>{
                      const t = document.getElementById('sql-blueprint') as HTMLTextAreaElement | null;
                      if (t) { navigator.clipboard.writeText(t.value); }
                    }}>Copy</button>
                </div>
                <textarea id="sql-blueprint" className="w-full h-56 border rounded p-2 bg-white text-[12px]" readOnly
                  value={sqlForNode(currentNodeName || 'Metric', warehouse, table, pk, event)} />
              </div>
            </div>
          )
        )}

        {activeTab === 'owners' && (
          !hasTree ? (
            <div className="text-sm opacity-70">Generate a tree to assign owners and check-ins.</div>
          ) : !selectedId ? (
            <div className="text-sm opacity-70">Select a node to manage its owner.</div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="font-medium">Owner & Check-ins for: <span className="opacity-80">{currentNodeName}</span></div>
              <div className="p-3 rounded-xl border bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <label className="w-28 opacity-70">Owner</label>
                  <input className="flex-1 border rounded px-2 py-1 bg-white" value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="Name or @handle" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-28 opacity-70">Cadence</label>
                  <select className="border rounded px-2 py-1 bg-white" value={cadence} onChange={e=>setCadence(e.target.value as Cadence)}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-28 opacity-70">Status</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1"><input type="radio" name="status" checked={status==='on_track'} onChange={()=>setStatus('on_track')} />On track</label>
                    <label className="inline-flex items-center gap-1"><input type="radio" name="status" checked={status==='at_risk'} onChange={()=>setStatus('at_risk')} />At risk</label>
                    <label className="inline-flex items-center gap-1"><input type="radio" name="status" checked={status==='off_track'} onChange={()=>setStatus('off_track')} />Off track</label>
                  </div>
                </div>
                <div>
                  <label className="block opacity-70 mb-1">Notes</label>
                  <textarea className="w-full border rounded p-2 bg-white min-h-24" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What changed, blockers, next steps…" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={saveOwner} className="rounded px-3 py-1.5 border bg-white">Save Owner</button>
                  <button onClick={logCheckin} className="rounded px-3 py-1.5 bg-black text-white">Log Check-in</button>
                  <div className="ml-auto text-xs opacity-70">
                    Last check-in: {formatISODate(ownersMeta[selectedId!]?.lastCheckin)} •
                    Next due: {formatISODate(nextDueDate(ownersMeta[selectedId!] || {}).toISOString())}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-sky-50">
                <div className="font-medium mb-2">Export Reminders (.ics)</div>
                <p className="opacity-70 mb-2">Creates a calendar with recurring check-ins for all owned metrics.</p>
                <button onClick={exportICS} className="rounded px-3 py-1.5 border bg-white">Download .ics</button>
              </div>
            </div>
          )
        )}
      </div>
    </aside>
  );
}
