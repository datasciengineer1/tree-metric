'use client';
import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { applyLevelLayout } from '../lib/levelLayout';
import * as htmlToImage from 'html-to-image';
import type { OwnerInfo } from '../lib/owners';
import { needsAttention, statusColor } from '../lib/owners';

type TreeNode = { id: string; name: string; level?: number; stage?: string; };
type TreeEdge = { src: string; dst: string; weight?: number; };
type TreeData = { north_star: TreeNode; nodes: TreeNode[]; edges: TreeEdge[]; };

type Palette = 'pastel' | 'vibrant' | 'mono';

function colorFor(level: number, palette: Palette) {
  if (palette === 'mono') {
    switch (level) {
      case 0: return { bg: '#e5e7eb', border: '#111827' };
      case 1: return { bg: '#f3f4f6', border: '#4b5563' };
      case 2: return { bg: '#f9fafb', border: '#6b7280' };
      default: return { bg: '#ffffff', border: '#9ca3af' };
    }
  }
  if (palette === 'vibrant') {
    switch (level) {
      case 0: return { bg: '#fecdd3', border: '#e11d48' };
      case 1: return { bg: '#fde68a', border: '#d97706' };
      case 2: return { bg: '#c7d2fe', border: '#4f46e5' };
      default: return { bg: '#bae6fd', border: '#0284c7' };
    }
  }
  switch (level) {
    case 0: return { bg: '#fee2e2', border: '#ef4444' };
    case 1: return { bg: '#fef3c7', border: '#f59e0b' };
    case 2: return { bg: '#e0e7ff', border: '#6366f1' };
    default: return { bg: '#e0f2fe', border: '#0ea5e9' };
  }
}

function inferStage(name?: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('activation') || n.includes('ftux')) return 'Activation';
  if (n.includes('retention') || n.includes('retained')) return 'Retention';
  if (n.includes('referral') || n.includes('invite')) return 'Referral';
  if (n.includes('revenue') || n.includes('arpu') || n.includes('paid') || n.includes('conversion')) return 'Revenue';
  return 'Engagement';
}

function pct(v: number) { return `${(v*100).toFixed(1)}%`; }
function deltaBadge(delta: number) {
  if (delta > 0.001) return <span className="text-[11px] leading-none px-2 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800">Δ {pct(delta)}</span>;
  if (delta < -0.001) return <span className="text-[11px] leading-none px-2 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-800">Δ {pct(delta)}</span>;
  return <span className="text-[11px] leading-none px-2 py-1 rounded-full bg-gray-100 border text-gray-700">Δ {pct(0)}</span>;
}

function StatusDot({ info }: { info?: OwnerInfo }) {
  const attn = needsAttention(info);
  const sc = statusColor(info?.status);
  const bg =
    sc === 'red' ? '#fecaca'
    : sc === 'amber' ? '#fde68a'
    : sc === 'green' ? '#bbf7d0'
    : '#e5e7eb';
  const border =
    sc === 'red' ? '#dc2626'
    : sc === 'amber' ? '#d97706'
    : sc === 'green' ? '#16a34a'
    : '#6b7280';
  const ring = attn ? `0 0 0 3px rgba(239,68,68,0.25)` : '0 0 0 0 transparent';
  return <span style={{
    display:'inline-block', width:10, height:10, borderRadius:9999,
    background:bg, border:`2px solid ${border}`, boxShadow:ring
  }} />;
}

function NodeLabel({
  level, name, stage, delta = 0, info
}: { level: number; name: string; stage: string; delta?: number; info?: OwnerInfo }) {
  return (
    <div className="flex flex-col">
      <div className="inline-flex items-center gap-1">
        <span className="text-[11px] leading-none px-2 py-1 rounded-full bg-white/80 border">L{level}</span>
        <span className="text-[11px] leading-none px-2 py-1 rounded-full bg-white/60 border">{stage}</span>
        {deltaBadge(delta)}
        <StatusDot info={info} />
      </div>
      <div className="text-sm mt-1">{name}</div>
    </div>
  );
}

export default function TreeCanvas({
  tree,
  onNodeClick,
  onEdgeClick,
  deltasComputed,
  palette = 'pastel',
  showWeights = true,
  selectedId,
  ownersMeta,
}: {
  tree: TreeData;
  onNodeClick?: (id: string, name: string, parent?: string) => void;
  onEdgeClick?: (edge: { src: string; dst: string; weight?: number }) => void;
  deltasComputed?: Record<string, number>;
  palette?: Palette;
  showWeights?: boolean;
  selectedId?: string | null;
  ownersMeta?: Record<string, OwnerInfo>;
}) {
  const TEXT = '#111827';
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  const baseNodes = useMemo<Node[]>(() => {
    const ordered: TreeNode[] = [
      { ...tree.north_star, level: 0, stage: 'North Star' },
      ...tree.nodes.filter((n) => n.id !== tree.north_star.id),
    ];
    return ordered.map((n) => {
      const lvl = typeof n.level === 'number' ? n.level : (n.id === tree.north_star.id ? 0 : 1);
      const stg = n.stage || (n.id === tree.north_star.id ? 'North Star' : inferStage(n.name));
      const col = colorFor(lvl, palette);
      const d = deltasComputed?.[n.id] ?? 0;
      const info = ownersMeta?.[n.id];

      return {
        id: n.id,
        data: { meta: { level: lvl, stage: stg, name: n.name }, label: <NodeLabel level={lvl} name={n.name} stage={stg} delta={d} info={info} /> },
        position: { x: 0, y: 0 },
        style: {
          borderRadius: 14,
          padding: 10,
          background: col.bg,
          border: `2px solid ${col.border}`,
          color: TEXT,
          fontWeight: 600,
          fontSize: 12,
          boxShadow: '0 1px 1px rgba(0,0,0,0.03), 0 6px 14px rgba(17,24,39,0.06)',
        },
      } as Node;
    });
  }, [tree, deltasComputed, palette, ownersMeta]);

  const rfEdges = useMemo<Edge[]>(
    () =>
      tree.edges.map((e) => ({
        id: `${e.src}-${e.dst}`,
        source: e.src,
        target: e.dst,
        type: 'step',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' },
        style: { strokeWidth: 2, stroke: '#9ca3af' },
        label: showWeights ? (e.weight ?? 0.2).toFixed(2) : undefined,
        labelStyle: { fontSize: 11, fill: '#111827' },
        labelBgPadding: [4, 2] as any,
        labelBgBorderRadius: 6,
        labelBgStyle: { fill: 'white', stroke: '#cbd5e1', strokeWidth: 1 },
      })),
    [tree, showWeights]
  );

  const { nodes, edges } = useMemo(() => {
    const laidOut = applyLevelLayout(baseNodes, rfEdges, tree.north_star.id);
    return { nodes: laidOut, edges: rfEdges };
  }, [baseNodes, rfEdges, tree.north_star.id]);

  const handleNodeClick = useCallback(
    (_: any, n: any) => {
      const parentEdge = tree.edges.find((e) => e.src === n.id);
      const parent =
        parentEdge?.dst === tree.north_star.id
          ? tree.north_star
          : tree.nodes.find((x) => x.id === parentEdge?.dst);
      const meta = n?.data?.meta || {};
      const cleanName = meta?.name || String(n?.data?.label?.props?.name ?? n.id);
      onNodeClick?.(n.id, cleanName, parent?.name);
    },
    [tree, onNodeClick]
  );

  const handleEdgeClick = useCallback(
    (_: any, e: any) => {
      const found = tree.edges.find(x => x.src === e.source && x.dst === e.target);
      if (found) onEdgeClick?.(found);
    },
    [tree, onEdgeClick]
  );

  useEffect(() => {
    if (!selectedId || !rfRef.current) return;
    const node = rfRef.current.getNode(selectedId);
    if (node?.positionAbsolute) {
      rfRef.current.setCenter(node.positionAbsolute.x, node.positionAbsolute.y, { zoom: 1.2, duration: 400 });
    }
  }, [selectedId]);

  const fitView = () => rfRef.current?.fitView({ padding: 0.15, duration: 400 });
  const centerSelected = () => {
    if (!selectedId || !rfRef.current) return;
    const node = rfRef.current.getNode(selectedId);
    if (node?.positionAbsolute) {
      rfRef.current.setCenter(node.positionAbsolute.x, node.positionAbsolute.y, { zoom: 1.2, duration: 400 });
    }
  };
  const exportPNG = async () => {
    const el = wrapperRef.current;
    if (!el) return;
    const dataUrl = await htmlToImage.toPng(el, { pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'metric-tree.png';
    a.click();
  };

  return (
    <div className="relative h-[calc(100vh-140px)] w-full rounded-2xl border p-2 shadow bg-white overflow-hidden" ref={wrapperRef}>
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button onClick={fitView} className="text-xs px-2 py-1 rounded border bg-white shadow-sm">Fit</button>
        <button onClick={centerSelected} className="text-xs px-2 py-1 rounded border bg-white shadow-sm">Center</button>
        <button onClick={exportPNG} className="text-xs px-2 py-1 rounded border bg-white shadow-sm">Export PNG</button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onInit={(instance) => { rfRef.current = instance; }}
        panOnScroll
        selectionOnDrag
        zoomOnScroll
      >
        <Background gap={24} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
