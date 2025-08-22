'use client';
import React, { useState } from 'react';
import { ragIngestUrl, ragIngestFile } from '../lib/api';

export default function RagIngestModal({
  open, onClose, defaultIndustry, defaultStage
}: { open: boolean; onClose: ()=>void; defaultIndustry?: string; defaultStage?: string }) {
  const [mode, setMode] = useState<'url'|'files'>('url');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [industry, setIndustry] = useState(defaultIndustry || 'eCommerce');
  const [stage, setStage]       = useState(defaultStage || 'Engagement');
  const [tags, setTags]         = useState('');
  const [busy, setBusy]         = useState(false);
  const [log, setLog]           = useState<string[]>([]);
  const tagList = tags.split(',').map(s => s.trim()).filter(Boolean);

  async function run() {
    setBusy(true); setLog([]);
    try {
      if (mode === 'url') {
        const res = await ragIngestUrl(url, { industry, stage, tags: tagList });
        setLog(prev => [`Ingested URL (${res.chunks} chunks).`, ...prev]);
      } else {
        if (!files || files.length === 0) return;
        let total = 0;
        for (const f of Array.from(files)) {
          const res = await ragIngestFile(f, { industry, stage, tags: tagList });
          total += res.chunks || 0;
          setLog(prev => [`${f.name}: ${res.chunks} chunks`, ...prev]);
        }
        setLog(prev => [`Total: ${total} chunks`, ...prev]);
      }
    } catch (e: any) {
      setLog(prev => [`Error: ${e?.message || e}`, ...prev]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/30 flex items-center justify-center">
      <div className="w-[720px] max-w-[96vw] rounded-2xl border bg-white shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium">RAG Ingestion</div>
          <button onClick={onClose} className="text-sm opacity-70">Close</button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1">
              <input type="radio" checked={mode==='url'} onChange={()=>setMode('url')} /> URL
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" checked={mode==='files'} onChange={()=>setMode('files')} /> Files (PDF/TXT/MD)
            </label>
            <div className="ml-auto flex items-center gap-2">
              <select className="border rounded px-2 py-1 bg-white" value={industry} onChange={e=>setIndustry(e.target.value)}>
                <option>eCommerce</option><option>SaaS B2B</option><option>Streaming / Media</option><option>Marketplace</option><option>Consumer Social</option>
              </select>
              <select className="border rounded px-2 py-1 bg-white" value={stage} onChange={e=>setStage(e.target.value)}>
                <option>Adoption</option><option>Activation</option><option>Engagement</option><option>Retention</option><option>Referral</option><option>Revenue</option>
              </select>
            </div>
          </div>

          {mode === 'url' ? (
            <input className="w-full border rounded px-2 py-1 bg-white" placeholder="https://… (PDF or article)"
              value={url} onChange={e=>setUrl(e.target.value)} />
          ) : (
            <input type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" multiple
              onChange={e=>setFiles(e.target.files)} />
          )}

          <input className="w-full border rounded px-2 py-1 bg-white" placeholder="Tags (comma-separated)"
            value={tags} onChange={e=>setTags(e.target.value)} />

          <div className="flex items-center gap-2">
            <button disabled={busy || (mode==='url' && !url) || (mode==='files' && (!files || files.length===0))}
                    onClick={run}
                    className="rounded px-3 py-1.5 bg-black text-white disabled:opacity-50">{busy ? 'Ingesting…' : 'Ingest'}</button>
            <div className="text-xs opacity-70">Uploads → chunks → embeddings → Qdrant/local.</div>
          </div>

          <div className="max-h-56 overflow-auto border rounded p-2 bg-slate-50 text-[12px]">
            {log.length === 0 ? <div className="opacity-60">No logs yet.</div> : log.map((l,i)=>(<div key={i}>{l}</div>))}
          </div>
        </div>
      </div>
    </div>
  );
}
