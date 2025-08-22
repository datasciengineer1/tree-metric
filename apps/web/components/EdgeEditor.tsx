'use client';
import React, { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { estimateElasticities } from '../lib/api';

type EdgeShape = { src: string; dst: string; weight?: number };

export default function EdgeEditor({
  open,
  edge,
  tree,
  onClose,
  onSave,
  onApplyWeights,
}: {
  open: boolean;
  edge: EdgeShape | null;
  tree: any;
  onClose: () => void;
  onSave?: () => void;
  onApplyWeights?: (parentName: string, weights: Record<string, number>) => void;
}) {
  const [tab, setTab] = useState<'weights' | 'estimate'>('weights');
  const [localWeight, setLocalWeight] = useState<number | ''>(edge?.weight ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<{
    weights: Record<string, number>;
    r2: number;
    n: number;
    ci95?: Record<string, [number, number]>;
    notes?: string;
  } | null>(null);

  const [opts, setOpts] = useState({
    add_intercept: false,
    non_negative: true,
    normalize: true,
    ci: true,
  });

  const parentName = edge?.src;
  const siblings = useMemo(() => {
    if (!tree || !edge) return [] as string[];
    const children = tree.edges?.filter((e: any) => e.src === edge.src)?.map((e: any) => e.dst) ?? [];
    const seen = new Set<string>(), out: string[] = [];
    for (const c of children) if (!seen.has(c)) { seen.add(c); out.push(c); }
    return out;
  }, [tree, edge]);

  const siblingWeights = useMemo(() => {
    if (!tree || !edge) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    (tree.edges || []).forEach((e: any) => { if (e.src === edge.src) map[e.dst] = typeof e.weight === 'number' ? e.weight : 0; });
    return map;
  }, [tree, edge]);

  const onSaveManual = () => {
    if (typeof localWeight !== 'number' || !edge) return;
    onSave?.(); onClose();
  };

  const downloadTemplate = () => {
    if (!parentName || siblings.length === 0) return;
    const headers = ['date', parentName, ...siblings];
    const sample = [
      ['2025-01-01', '', ...siblings.map(() => '')],
      ['2025-01-08', '', ...siblings.map(() => '')],
      ['2025-01-15', '', ...siblings.map(() => '')],
    ];
    const csv = Papa.unparse({ fields: headers, data: sample });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `elasticities_${parentName.replace(/\s+/g,'_')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const onChooseFile = async (file: File) => {
    setBusy(true); setLog([]); setResult(null);
    try {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rows = (parsed.data as any[]).filter(Boolean);
      if (!parentName) throw new Error('No parent edge selected.');
      if (siblings.length === 0) throw new Error('No sibling edges found.');
      const headers = parsed.meta?.fields || Object.keys(rows[0] || {});
      const missing: string[] = [];
      if (!headers.includes(parentName)) missing.push(parentName);
      for (const c of siblings) if (!headers.includes(c)) missing.push(c);
      if (missing.length) throw new Error(`CSV missing required columns: ${missing.join(', ')}`);

      const pSeries: number[] = [];
      const childSeries: Record<string, number[]> = {};
      for (const c of siblings) childSeries[c] = [];

      for (const r of rows) {
        const pVal = parseFloat(String(r[parentName]).replace(/,/g,''));
        if (Number.isNaN(pVal)) continue;
        let ok = true;
        const temp: Record<string, number> = {};
        for (const c of siblings) {
          const v = parseFloat(String(r[c]).replace(/,/g,''));
          if (Number.isNaN(v)) { ok = false; break; }
          temp[c] = v;
        }
        if (!ok) continue;
        pSeries.push(pVal);
        for (const c of siblings) childSeries[c].push(temp[c]);
      }
      if (pSeries.length < Math.max(6, siblings.length + 3)) throw new Error(`Not enough complete rows (got ${pSeries.length}).`);

      setLog(prev => [`Rows accepted: ${pSeries.length}`, ...prev]);
      const res = await estimateElasticities({ parent: pSeries, children: childSeries, ...opts });
      setResult(res);
      setLog(prev => [`R² = ${(res.r2||0).toFixed(3)} • n = ${res.n}`, ...prev]);
      if (res.notes) setLog(prev => [res.notes, ...prev]);
    } catch (e: any) {
      setLog(prev => [`Error: ${e?.message || e}`, ...prev]);
    } finally {
      setBusy(false);
    }
  };

  const applySuggested = () => {
    if (!result || !parentName) return;
    onApplyWeights?.(parentName, result.weights);
    onClose();
  };

  if (!open || !edge) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/30 flex items-center justify-center">
      <div className="w-[840px] max-w-[96vw] rounded-2xl border bg-white shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium">Edge Editor — <span className="opacity-70">{edge.src} → {edge.dst}</span></div>
          <button onClick={onClose} className="text-sm opacity-70">Close</button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-3 text-sm">
            <button className={`px-3 py-1.5 rounded ${tab==='weights'?'bg-black text-white':'border bg-white'}`} onClick={()=>setTab('weights')}>Weights</button>
            <button className={`px-3 py-1.5 rounded ${tab==='estimate'?'bg-black text-white':'border bg-white'}`} onClick={()=>setTab('estimate')}>Estimate from data (CSV)</button>
          </div>
        </div>

        {tab === 'weights' ? (
          <div className="p-4 space-y-3">
            <div className="text-sm">Current sibling weights for <b>{edge.src}</b></div>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr><th className="text-left p-2">Child</th><th className="text-right p-2">Weight</th></tr></thead>
                <tbody>
                  {Object.entries(siblingWeights).map(([child, w]) => (
                    <tr key={child} className="border-t"><td className="p-2">{child}</td><td className="p-2 text-right">{(w*100).toFixed(1)}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-sm">Manual edit for this edge:</div>
            <div className="flex items-center gap-2">
              <input type="number" step="0.01" min="0" max="1" value={localWeight}
                     onChange={(e)=>setLocalWeight(e.target.value===''?'':Number(e.target.value))}
                     className="border rounded px-2 py-1 w-28" />
              <span className="text-xs opacity-70">0–1; siblings should sum to 1</span>
              <button className="ml-auto rounded px-3 py-1.5 bg-black text-white" onClick={onSaveManual}>Save</button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="text-sm">
              Upload a CSV with headers: <code>date</code>, <code>{parentName}</code>, {siblings.map((s,i)=>(<code key={s}>{s}{i<siblings.length-1?', ':''}</code>))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadTemplate} className="rounded px-3 py-1.5 border bg-white">Download template</button>
              <input type="file" accept=".csv,text/csv" ref={fileRef} onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onChooseFile(f); }}/>
              <div className="ml-auto flex items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={opts.add_intercept} onChange={e=>setOpts({...opts, add_intercept: e.target.checked})}/>intercept</label>
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={opts.non_negative} onChange={e=>setOpts({...opts, non_negative: e.target.checked})}/>non-negative</label>
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={opts.normalize} onChange={e=>setOpts({...opts, normalize: e.target.checked})}/>normalize</label>
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={opts.ci} onChange={e=>setOpts({...opts, ci: e.target.checked})}/>CI</label>
              </div>
            </div>
            {busy && <div className="text-sm">Estimating…</div>}
            {result && (
              <div className="space-y-2">
                <div className="text-sm"><b>Suggested weights</b> — R² {(result.r2||0).toFixed(3)} • n {result.n}{result.notes?` • ${result.notes}`:''}</div>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr><th className="text-left p-2">Child</th><th className="text-right p-2">Weight</th><th className="text-right p-2">95% CI</th></tr></thead>
                    <tbody>
                      {Object.keys(result.weights).map((k) => {
                        const w = result.weights[k]; const ci = result.ci95?.[k];
                        return (<tr key={k} className="border-t"><td className="p-2">{k}</td><td className="p-2 text-right">{(w*100).toFixed(1)}%</td><td className="p-2 text-right">{ci?`${ci[0].toFixed(3)} … ${ci[1].toFixed(3)}`:'—'}</td></tr>);
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded px-3 py-1.5 bg-black text-white" onClick={applySuggested}>Apply to edges</button>
                  <div className="text-xs opacity-70">Applies to all children of <b>{parentName}</b></div>
                </div>
              </div>
            )}
            <div className="max-h-40 overflow-auto border rounded p-2 bg-slate-50 text-[12px]">
              {log.length===0 ? <div className="opacity-60">Logs will appear here.</div> : log.map((l,i)=><div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
