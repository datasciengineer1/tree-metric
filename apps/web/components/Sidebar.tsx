'use client';
import React from 'react';

export default function Sidebar({
  industry, setIndustry,
  product, setProduct,
  run,
  useLLM, setUseLLM,
  useQdrant, setUseQdrant,
  onLint,
  query, setQuery,
  onRag,
  onShowScenarios,
  onOpenIngest,
}: {
  industry: string;
  setIndustry: (v: string) => void;
  product: string;
  setProduct: (v: string) => void;
  run: () => void;
  useLLM: boolean;
  setUseLLM: (v: boolean) => void;
  useQdrant: boolean;
  setUseQdrant: (v: boolean) => void;
  onLint: () => void;
  query: string;
  setQuery: (v: string) => void;
  onRag: () => void;
  onShowScenarios: () => void;
  onOpenIngest: () => void;
}) {
  return (
    <aside className="h-[calc(100vh-88px)] w-full border-r bg-gradient-to-b from-sky-50 via-sky-50 to-white p-4 rounded-2xl overflow-y-auto">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Context</div>

      <div className="space-y-6">
        <div className="space-y-2">
          <select value={industry} onChange={(e)=>setIndustry(e.target.value)} className="w-full border rounded px-2 py-1 bg-white">
            <option>SaaS B2B</option>
            <option>Streaming / Media</option>
            <option>Marketplace</option>
            <option>Consumer Social</option>
            <option>eCommerce</option>
          </select>
          <input className="w-full border rounded px-2 py-1 bg-white" value={product} onChange={(e)=>setProduct(e.target.value)} placeholder="Product type"/>
          <button onClick={run} className="w-full rounded-xl px-3 py-2 bg-black text-white">Generate Tree</button>
        </div>

        <div className="pt-2 border-t">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Analysis</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useLLM} onChange={(e)=>setUseLLM(e.target.checked)} />
              Use LLM (Ollama)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useQdrant} onChange={(e)=>setUseQdrant(e.target.checked)} />
              Use Qdrant (vector search)
            </label>
            <button onClick={onLint} className="w-full rounded-xl px-3 py-2 border bg-white">Lint Tree</button>
            <button onClick={onShowScenarios} className="w-full rounded-xl px-3 py-2 border bg-white">Scenarios</button>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-gray-500">Playbooks (RAG)</div>
            <button onClick={onOpenIngest} className="text-xs px-2 py-1 rounded border bg-white">Ingest</button>
          </div>
          <div className="mt-2 flex gap-2">
            <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="e.g., activation checklist" className="flex-1 border rounded px-2 py-1 bg-white"/>
            <button onClick={onRag} className="rounded-xl px-3 py-1.5 border bg-white">Search</button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Try: “reduce churn”, “trial → paid”, “referral guardrails”.</p>
        </div>
      </div>
    </aside>
  );
}
