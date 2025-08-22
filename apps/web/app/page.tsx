'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import TreeCanvas from '../components/TreeCanvas';
import Sidebar from '../components/Sidebar';
import RightPanel, { Scenario } from '../components/RightPanel';
import EdgeEditor from '../components/EdgeEditor';
import DataImportModal from '../components/DataImportModal';
import RagIngestModal from '../components/RagIngestModal';
import IdeasDrawer from '../components/IdeasDrawer';
import { computePropagation } from '../lib/propagate';
import { expandTree, explainNode, lintTree, ragSearch } from '../lib/api';
import type { OwnerInfo } from '../lib/owners';

export default function Page() {
  const [industry, setIndustry] = useState('eCommerce');
  const [product, setProduct]   = useState('consumer portal');
  const [tree, setTree]         = useState<any | null>(null);

  const [rightOpen, setRightOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'explain'|'scenarios'|'math'|'owners'>('explain');
  const [explain, setExplain]     = useState<any | null>(null);

  const [palette, setPalette]       = useState<'pastel'|'vibrant'|'mono'>('pastel');
  const [showWeights, setShowWeights] = useState<boolean>(true);

  const [useLLM, setUseLLM]       = useState(false);
  const [useQdrant, setUseQdrant] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{src:string;dst:string;weight?:number} | null>(null);

  const [lint, setLint]           = useState<string[] | null>(null);
  const [query, setQuery]         = useState('');
  const [rag, setRag]             = useState<any[] | null>(null);

  const [deltas, setDeltas]       = useState<Record<string, number>>({});
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [ownersMeta, setOwnersMeta] = useState<Record<string, OwnerInfo>>({});

  const [showImporter, setShowImporter] = useState(false);
  const [showIngest, setShowIngest]     = useState(false);
  const [showIdeas, setShowIdeas]       = useState(false);

  const propagation = useMemo(() => {
    if (!tree) return { byId: {}, nsDelta: 0 };
    return computePropagation(tree, deltas);
  }, [tree, deltas]);
  const nsDelta = propagation.nsDelta;

  const run = async (payload?: any) => {
    const t = await expandTree({ industry, product_type: product, brief: payload?.brief, diversity: 2 });
    setTree(t);
    setExplain(null); setLint(null); setRag(null);
    setDeltas({});
    setActiveTab('explain');
    setSelectedId(t?.north_star?.id ?? null);
  };

  const onLint = async () => {
    if (!tree) return;
    const res = await lintTree(tree);
    setLint(res?.warnings ?? []);
  };
  const onRag = async () => {
    const res = await ragSearch(query || 'metric tree', useQdrant ? 'qdrant' : 'local', { industry, stage: undefined });
    setRag(res.results || []);
  };

  function addIdeaToTree(stage: string, name: string) {
    if (!tree) return;
    const candidates = (tree.nodes||[]).filter((n:any)=> new RegExp(stage,'i').test(n.name));
    const parent = candidates[0] || tree.north_star || (tree.nodes||[])[0];
    const newId = `custom-${Date.now()}`;
    const next = JSON.parse(JSON.stringify(tree));
    next.nodes.push({ id:newId, name, level:(parent.level??0)+1 });
    next.edges.push({ src: parent.id, dst: newId, weight: 0.2 });
    setTree(next);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-white">
      <header className="px-4 md:px-6 py-4 border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-semibold">Metric Trees Designer</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3 text-xs text-gray-700">
            <button onClick={()=>setShowImporter(true)} className="rounded px-2 py-1 border bg-white">Import CSV</button>
            <button onClick={()=>setShowIngest(true)} className="rounded px-2 py-1 border bg-white">Ingest (Modal)</button>
            <Link href="/ingest" className="rounded px-2 py-1 border bg-white">Ingest (Page)</Link>
            <button onClick={()=>setShowIdeas(true)} className="rounded px-2 py-1 border bg-white">Ideas</button>
            <Link href="/dashboard" className="rounded px-2 py-1 border bg-white">Dashboard</Link>
            <div className="hidden md:block">
              Level key:
              <span className="px-2 py-0.5 rounded bg-red-100 ml-2">L0</span>
              <span className="px-2 py-0.5 rounded bg-amber-100 ml-2">L1</span>
              <span className="px-2 py-0.5 rounded bg-indigo-100 ml-2">L2</span>
              <span className="px-2 py-0.5 rounded bg-sky-100 ml-2">L3</span>
            </div>
            {tree ? (<span className={`px-2 py-0.5 rounded ${nsDelta>0.001?'bg-emerald-100 text-emerald-700':nsDelta<-0.001?'bg-rose-100 text-rose-700':'bg-gray-100 text-gray-700'}`}>NSM Δ {(nsDelta*100).toFixed(1)}%</span>) : null}
            <select className="border rounded px-2 py-1 bg-white" value={palette} onChange={e=>setPalette(e.target.value as any)}>
              <option value="pastel">Pastel</option><option value="vibrant">Vibrant</option><option value="mono">Mono</option>
            </select>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showWeights} onChange={e=>setShowWeights(e.target.checked)} />
              weights
            </label>
            <button onClick={()=>setRightOpen(v=>!v)} className="text-xs px-2 py-1 rounded border bg-white" title="Toggle right panel">⧉</button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-2 md:p-4">
        <div className="grid gap-3 md:gap-4 items-start" style={{ gridTemplateColumns: `320px 1fr ${rightOpen ? '420px' : '0px'}` }}>
          <Sidebar
            industry={industry} setIndustry={setIndustry}
            product={product} setProduct={setProduct}
            run={(payload) => { void run(payload); }}
            useLLM={useLLM} setUseLLM={setUseLLM}
            useQdrant={useQdrant} setUseQdrant={setUseQdrant}
            onLint={onLint}
            query={query} setQuery={setQuery}
            onRag={onRag}
            onShowScenarios={()=>setActiveTab('scenarios')}
            onOpenIngest={()=>setShowIngest(true)}
          />

          <section className="rounded-2xl border bg-white p-2 min-w-0">
            {tree ? (
              <>
                <TreeCanvas
                  tree={tree}
                  deltasComputed={computePropagation(tree, deltas).byId}
                  palette={palette}
                  showWeights={showWeights}
                  selectedId={selectedId}
                  ownersMeta={{}}
                  onNodeClick={async (id, name, parent) => {
                    setSelectedId(id);
                    const ex = await explainNode(name, parent, useQdrant, useQdrant ? 'qdrant' : 'local');
                    setExplain(ex);
                    setActiveTab('explain');
                    if (!rightOpen) setRightOpen(true);
                  }}
                  onEdgeClick={(e)=>setSelectedEdge(e)}
                />
                {lint && (
                  <section className="mt-4 p-4 rounded-2xl border bg-white">
                    <div className="font-medium mb-2">Lint Warnings</div>
                    {lint.length === 0 ? (<div className="text-sm opacity-60">No warnings 🎉</div>) : (
                      <ul className="list-disc ml-5 text-sm">{lint.map((w, i) => (<li key={i}>{w}</li>))}</ul>
                    )}
                  </section>
                )}
                {rag && (
                  <section className="mt-4 p-4 rounded-2xl border bg-white">
                    <div className="font-medium mb-2">Playbook Snippets (RAG) {useQdrant ? '(Qdrant)' : '(Local)'}</div>
                    <ul className="space-y-2 text-sm">
                      {rag.map((r, i) => (
                        <li key={i} className="p-2 rounded border">
                          <div className="text-xs opacity-60">{r.source === 'url' ? (r.url || 'url') : (r.filename || 'file')} • score {Number(r.score).toFixed(3)}</div>
                          <div>{r.text}</div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <div className="text-sm opacity-70 p-6">No tree yet. Use the left panel to generate.</div>
            )}
          </section>

          <div className={rightOpen ? 'block' : 'hidden'}>
            <RightPanel
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              explain={explain}
              tree={tree}
              selectedId={selectedId}
              deltas={deltas}
              setDeltas={setDeltas}
              nsDelta={nsDelta}
              scenarios={scenarios}
              onSaveScenario={(name)=>{ const id=`${Date.now()}`; setScenarios(prev=>[{id,name,deltas:{...deltas},nsDelta},...prev].slice(0,12)); }}
              onApplyScenario={(id)=>{ const s=scenarios.find(x=>x.id===id); if(s){ setDeltas({...s.deltas}); setActiveTab('scenarios'); }}}
              onDeleteScenario={(id)=>setScenarios(prev=>prev.filter(x=>x.id!==id))}
              onCollapse={()=>setRightOpen(false)}
              ownersMeta={ownersMeta}
              setOwnersMeta={setOwnersMeta}
            />
          </div>
        </div>
      </main>

      <EdgeEditor
        open={!!selectedEdge}
        edge={selectedEdge}
        tree={tree}
        onClose={()=>setSelectedEdge(null)}
        onSave={()=>{}}
        onApplyWeights={(parentName, weights) => {
          if (!tree) return;
          const next = JSON.parse(JSON.stringify(tree));
          const keys = Object.keys(weights);
          (next.edges||[]).forEach((e:any) => { if (e.src === parentName && keys.includes(e.dst)) e.weight = weights[e.dst]; });
          setTree(next);
        }}
      />
      <DataImportModal open={showImporter} onClose={()=>setShowImporter(false)} tree={tree} onApply={()=>{}} />
      <RagIngestModal open={showIngest} onClose={()=>setShowIngest(false)} defaultIndustry={industry} defaultStage="Engagement" />
      <IdeasDrawer open={showIdeas} onClose={()=>setShowIdeas(false)} industry={industry} onAdd={(stage, name)=>{ addIdeaToTree(stage, name); setShowIdeas(false); }} />
    </div>
  );
}
