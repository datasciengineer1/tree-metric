'use client';
import React, { useMemo, useState } from 'react';
import Papa from 'papaparse';

type TreeNode = { id: string; name: string };
type TreeData = { north_star: TreeNode; nodes: TreeNode[]; edges: any[] };

type Row = { id?: string; name?: string; delta?: string | number; delta_pct?: string | number };

function parseNumber(x: any): number | null {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  if (!s) return null;
  // accepts "5", "5%", "0.05"
  if (s.endsWith('%')) {
    const n = Number(s.slice(0, -1).trim());
    return isFinite(n) ? n / 100 : null;
  }
  const n = Number(s);
  if (!isFinite(n)) return null;
  // heuristics: if |n| > 1, treat as %; else as fraction
  return Math.abs(n) > 1 ? n / 100 : n;
}

export default function DataImportModal({
  open,
  onClose,
  tree,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  tree: TreeData | null;
  onApply: (deltas: Record<string, number>) => void;
}) {
  const [raw, setRaw] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'name'|'id'>('name');

  const nameToId = useMemo(() => {
    const m: Record<string,string> = {};
    if (!tree) return m;
    const all = [tree.north_star, ...tree.nodes];
    for (const n of all) m[n.name.toLowerCase()] = n.id;
    return m;
  }, [tree]);

  const idExists = useMemo(() => {
    const s = new Set<string>();
    if (!tree) return s;
    const all = [tree.north_star, ...tree.nodes];
    for (const n of all) s.add(n.id);
    return s;
  }, [tree]);

  const preview = useMemo(() => {
    if (!tree) return [];
    const rows = raw;
    const out: { key: string; targetId?: string; targetName?: string; delta?: number; ok: boolean; reason?: string }[] = [];
    for (const r of rows) {
      let targetId: string | undefined;
      let targetName: string | undefined;

      if (mode === 'id' && r.id) {
        if (idExists.has(r.id)) {
          targetId = r.id;
          const found = [tree.north_star, ...tree.nodes].find(n => n.id === r.id);
          targetName = found?.name;
        } else {
          out.push({ key: r.id, ok: false, reason: 'ID not found' });
          continue;
        }
      } else {
        const key = (r.name || '').toString().trim().toLowerCase();
        if (!key) { out.push({ key: '(blank)', ok: false, reason: 'Missing name' }); continue; }
        const id = nameToId[key];
        if (!id) { out.push({ key: r.name as string, ok: false, reason: 'Name not matched' }); continue; }
        targetId = id;
        targetName = [tree.north_star, ...tree.nodes].find(n => n.id === id)?.name;
      }

      const d = parseNumber(r.delta ?? r.delta_pct);
      if (d === null) { out.push({ key: targetName || targetId!, ok: false, reason: 'Bad delta' }); continue; }

      out.push({ key: (targetName || targetId!) as string, targetId, targetName, delta: d, ok: true });
    }
    return out;
  }, [raw, mode, tree, nameToId, idExists]);

  const good = preview.filter(p => p.ok && p.targetId && typeof p.delta === 'number');

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse<Row>(f, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: res => {
        if (res.errors && res.errors.length) {
          setError(res.errors[0].message || 'CSV parse error');
        }
        setRaw(res.data || []);
      },
      error: err => setError(err.message || 'CSV parse error'),
    });
  }

  function downloadTemplate() {
    const tpl = [
      ['name','delta'],
      ['Activation rate','5%'],
      ['D7 Retention','-1.2%'],
      ['Referral accept rate','0.8%'],
    ].map(r=>r.join(',')).join('\n');
    const blob = new Blob([tpl], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'metric-tree-deltas-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="w-[720px] max-w-[95vw] rounded-2xl border bg-white shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium">Import Scenario Deltas (CSV)</div>
          <button onClick={onClose} className="text-sm opacity-70">Close</button>
        </div>

        <div className="p-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <input type="file" accept=".csv,text/csv" onChange={onFile} />
            <button onClick={downloadTemplate} className="rounded px-2 py-1 border bg-white">Download template</button>
            <div className="ml-auto flex items-center gap-2">
              <span className="opacity-70">Match by</span>
              <select className="border rounded px-2 py-1 bg-white" value={mode} onChange={e=>setMode(e.target.value as any)}>
                <option value="name">Name</option>
                <option value="id">ID</option>
              </select>
            </div>
          </div>

          <p className="opacity-70">
            CSV headers accepted: <code className="px-1 bg-slate-100 rounded">name</code> or <code className="px-1 bg-slate-100 rounded">id</code>, and
            <code className="px-1 bg-slate-100 rounded">delta</code> or <code className="px-1 bg-slate-100 rounded">delta_pct</code>. Values can be <code>0.05</code>, <code>5</code>, or <code>5%</code>.
          </p>

          {error && <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

          <div className="max-h-72 overflow-auto border rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left p-2">Row</th>
                  <th className="text-left p-2">Target</th>
                  <th className="text-left p-2">Parsed Δ</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{p.key}</td>
                    <td className="p-2">{p.targetName || p.targetId || '—'}</td>
                    <td className="p-2">{typeof p.delta === 'number' ? `${(p.delta*100).toFixed(2)}%` : '—'}</td>
                    <td className="p-2">
                      {p.ok ? <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">OK</span>
                           : <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">{p.reason}</span>}
                    </td>
                  </tr>
                ))}
                {preview.length === 0 && (
                  <tr><td className="p-4 text-center opacity-60" colSpan={4}>Choose a CSV file to preview.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 border bg-white">Cancel</button>
          <button
            onClick={()=>{
              const m: Record<string, number> = {};
              for (const g of good) m[g.targetId!] = g.delta!;
              onApply(m);
              onClose();
            }}
            disabled={good.length === 0}
            className="rounded px-3 py-1.5 bg-black text-white disabled:opacity-50"
          >Apply {good.length ? `(${good.length})` : ''}</button>
        </div>
      </div>
    </div>
  );
}
