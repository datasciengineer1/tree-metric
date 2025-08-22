'use client';
import React, { useState } from 'react';
import { ideateMetrics } from '../lib/api';

export default function IdeasDrawer({
  open, onClose, industry, onAdd
}: {
  open: boolean; onClose: ()=>void; industry: string;
  onAdd: (parentStage: string, metricName: string) => void;
}) {
  const [stage, setStage] = useState<string>('');
  const [diversity, setDiversity] = useState(2);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await ideateMetrics({ industry, stage: stage || undefined, count: 10, diversity });
      setIdeas(res.ideas || []);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-black/30 flex justify-end">
      <div className="w-[420px] max-w-[96vw] h-full bg-white shadow-xl p-4 overflow-auto">
        <div className="flex items-center justify-between">
          <div className="font-medium">Metric ideas</div>
          <button onClick={onClose} className="text-sm opacity-70">Close</button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <select className="border rounded px-2 py-1 bg-white" value={stage} onChange={e=>setStage(e.target.value)}>
            <option value="">All stages</option>
            <option>Activation</option><option>Engagement</option><option>Retention</option><option>Referral</option><option>Revenue</option>
          </select>
          <label className="text-xs opacity-70">Diversity</label>
          <input type="range" min={1} max={3} value={diversity} onChange={e=>setDiversity(Number(e.target.value))}/>
          <button onClick={run} className="ml-auto rounded px-3 py-1.5 border bg-white">{busy?'…':'Generate'}</button>
        </div>

        <ul className="mt-3 space-y-2">
          {ideas.map((it, i) => (
            <li key={i} className="border rounded p-2">
              <div className="text-xs opacity-60">{it.stage}</div>
              <div className="font-medium">{it.name}</div>
              <div className="text-xs opacity-70">{it.why}</div>
              <button onClick={()=>onAdd(it.stage, it.name)} className="mt-2 rounded px-2 py-1 bg-black text-white text-xs">Add to tree</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
