'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ragIngestUrl, ragIngestFile } from '../../lib/api';

export default function IngestPage() {
  const [mode, setMode] = useState<'url'|'files'>('url');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [industry, setIndustry] = useState('eCommerce');
  const [stage, setStage]       = useState('Engagement');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-white">
      <header className="px-4 md:px-6 py-4 border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-semibold">RAG Ingestion</h1>
          <Link href="/" className="text-sm rounded px-3 py-1.5 border bg-white">← Back</Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto p-4">
        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-2xl border bg-white p-4 space-y-3">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-1 text-sm">
                <input type="radio" checked={mode==='url'} onChange={()=>setMode('url')} /> URL
              </label>
              <label className="inline-flex items-center gap-1 text-sm">
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
              <input className="w-full border rounded px-2 py-2 bg-white" placeholder="https://… (PDF or article)"
                value={url} onChange={e=>setUrl(e.target.value)} />
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center bg-slate-50">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,text/plain,application/pdf"
                  multiple
                  onChange={e=>setFiles(e.target.files)}
                />
                <div className="text-xs text-gray-600 mt-2">Drop files here or click to select (PDF/TXT/MD)</div>
              </div>
            )}

            <input className="w-full border rounded px-2 py-2 bg-white" placeholder="Tags (comma-separated)"
              value={tags} onChange={e=>setTags(e.target.value)} />

            <div className="flex items-center gap-2">
              <button
                disabled={busy || (mode==='url' && !url) || (mode==='files' && (!files || files.length===0))}
                onClick={run}
                className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50">{busy ? 'Ingesting…' : 'Ingest'}</button>
              <div className="text-xs opacity-70">Uploads → chunk (900 chars) → embed → Qdrant / local vectors.</div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4">
            <div className="font-medium mb-2">Logs</div>
            <div className="max-h-[60vh] overflow-auto border rounded p-2 bg-slate-50 text-[12px]">
              {log.length === 0 ? <div className="opacity-60">No logs yet.</div> : log.map((l,i)=>(<div key={i}>{l}</div>))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
