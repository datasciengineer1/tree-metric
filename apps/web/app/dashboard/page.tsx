'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { linregForecast, pctChange, Series } from '../../lib/forecast';
import { explainNode } from '../../lib/api';

function makeDemo(n = 26, start = '2025-02-01', base = 800, drift = 18) {
  const day = 86400000;
  const s: Series = [];
  const t0 = new Date(start).getTime();
  for (let i = 0; i < n; i++) {
    const y = base + i * drift + (Math.random() - 0.5) * 40;
    s.push({ t: new Date(t0 + i * 7 * day).toISOString().slice(0,10), y: Math.max(0, Math.round(y)) });
  }
  return s;
}

export default function DashboardPage() {
  const [nsmName] = useState('Weekly Engaged Users');
  const series = useMemo(() => makeDemo(), []);
  const last = series[series.length - 1]?.y ?? 0;
  const prev = series[series.length - 2]?.y ?? 0;
  const delta = pctChange(last, prev);

  const fc = linregForecast(series, 8);
  const combined = [...series.map(d => ({ ...d, type: 'hist' })), ...fc.fcst.map(d => ({ ...d, type: 'fcst' }))];

  const [fxExplain, setFxExplain] = useState<any | null>(null);
  async function onExplain() {
    const res = await explainNode(nsmName, undefined, true, 'local');
    setFxExplain(res);
  }

  const bars = ['Activation','Engagement','Retention','Referral','Revenue'].map((k, i) => ({
    k, w: Math.round(15 + 15*Math.sin(i+1) + (i===1?25:0))
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1220] to-[#0b1220] text-white">
      <header className="px-4 md:px-6 py-4 border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-white/70 hover:text-white">← Builder</Link>
            <h1 className="text-lg md:text-xl font-semibold">Growth Analytics</h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={onExplain} className="rounded px-3 py-1.5 bg-white/10 hover:bg-white/20">Explain forecast</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/70 mb-2">{nsmName}</div>
            <div className="text-3xl font-semibold">{last.toLocaleString()}</div>
            <div className={`text-xs mt-1 ${delta>=0?'text-emerald-300':'text-rose-300'}`}>
              {delta>=0 ? '▲' : '▼'} {(delta*100).toFixed(1)}% vs last week
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/70 mb-2">Forecast bias (slope)</div>
            <div className="text-3xl font-semibold">{fc.slope.toFixed(1)}</div>
            <div className="text-xs text-white/60">expected weekly change</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/70 mb-2">8-wk Projection</div>
            <div className="text-3xl font-semibold">{Math.round(fc.fcst[fc.fcst.length-1].y).toLocaleString()}</div>
            <div className="text-xs text-white/60">end of horizon</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/70 mb-2">Risk / Focus</div>
            <div className="text-sm">Engagement ▲ · Retention —</div>
            <div className="text-xs text-white/60">based on last 4 weeks</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/80 mb-2">NSM history & forecast</div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combined}>
                  <XAxis dataKey="t" hide />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}/>
                  <Line type="monotone" dataKey="y" stroke="#93c5fd" dot={false} isAnimationActive={false} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/80 mb-2">Driver focus (illustrative)</div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars}>
                  <XAxis dataKey="k" stroke="#9ca3af" />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}/>
                  <Bar dataKey="w" fill="#60a5fa" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-white/60 mt-1">Replace with data-driven weights via Edge Editor → Estimate from data.</div>
          </div>
        </div>

        {fxExplain && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-medium mb-1">Explainability</div>
            <div className="text-sm text-white/80">{fxExplain.why_it_matters}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <div className="text-xs text-white/60 mb-1">How to move</div>
                <ul className="list-disc ml-5 text-sm">{(fxExplain.how_to_move||[]).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">How to measure</div>
                <ul className="list-disc ml-5 text-sm">{(fxExplain.how_to_measure||[]).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
