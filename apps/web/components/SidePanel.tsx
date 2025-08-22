'use client';
import React from 'react';

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

export default function SidePanel({ selected, onClose }: { selected: Explain | null; onClose: () => void }) {
  return (
    <aside className={`fixed right-4 top-4 bottom-4 w-[380px] max-w-[90vw] rounded-2xl border shadow bg-white dark:bg-neutral-900 transition ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Explainability</h3>
        <button className="text-sm opacity-70" onClick={onClose}>Close</button>
      </div>
      {selected && (
        <div className="p-4 space-y-3 text-sm overflow-y-auto h-[calc(100%-56px)]">
          <div className="text-xs uppercase opacity-60">{selected.stage}</div>
          <div className="text-base font-medium">{selected.node}</div>
          <p>{selected.why_it_matters}</p>

          <div>
            <div className="font-medium mt-2">How to move</div>
            <ul className="list-disc ml-5">{selected.how_to_move.map((x,i)=>(<li key={i}>{x}</li>))}</ul>
          </div>

          <div>
            <div className="font-medium mt-2">How to measure</div>
            <ul className="list-disc ml-5">{selected.how_to_measure.map((x,i)=>(<li key={i}>{x}</li>))}</ul>
          </div>

          <div className="opacity-80 mt-2"><span className="font-medium">Counter-metric:</span> {selected.counter_metric}</div>

          {selected.owner_suggestions?.length ? (
            <div>
              <div className="font-medium mt-2">Suggested owners</div>
              <ul className="list-disc ml-5">{selected.owner_suggestions.map((x,i)=>(<li key={i}>{x}</li>))}</ul>
            </div>
          ) : null}

          {selected.team_actions && (
            <div>
              <div className="font-medium mt-2">Team actions</div>
              {selected.team_actions.this_week?.length ? (
                <div className="mt-1">
                  <div className="text-xs uppercase opacity-70">This week</div>
                  <ul className="list-disc ml-5">{selected.team_actions.this_week.map((x,i)=>(<li key={i}>{x}</li>))}</ul>
                </div>
              ) : null}
              {selected.team_actions.this_quarter?.length ? (
                <div className="mt-2">
                  <div className="text-xs uppercase opacity-70">This quarter</div>
                  <ul className="list-disc ml-5">{selected.team_actions.this_quarter.map((x,i)=>(<li key={i}>{x}</li>))}</ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
