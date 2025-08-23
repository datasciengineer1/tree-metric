const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

async function jpost<T=any>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

/** Expand a metric tree from context */
export async function expandTree(payload: {
  industry: string;
  product_type: string;
  brief?: string;
  diversity?: number;
}) {
  return jpost('/metric-tree/expand', payload);
}

/** Explain a node (optionally with RAG) */
export async function explainNode(
  node: string,
  parent?: string,
  use_rag?: boolean,
  rag_provider?: 'qdrant' | 'local',
  industry?: string,
  stage?: string
) {
  return jpost('/explain', { node, parent, use_rag, rag_provider, industry, stage });
}

/** Lint the current tree; tries /lint, falls back to /metric-tree/lint if needed */
export async function lintTree(tree: any) {
  try {
    return await jpost('/lint', { tree });
  } catch (e) {
    return await jpost('/metric-tree/lint', { tree });
  }
}

/** RAG search (Qdrant or local) */
export async function ragSearch(
  q: string,
  provider: 'qdrant' | 'local' = 'local',
  filters?: { industry?: string; stage?: string },
  limit = 8
) {
  return jpost('/rag/search', { q, provider, ...filters, limit });
}

/** Ingest a URL (PDF/HTML) into the RAG store */
export async function ingestUrl(url: string, meta?: { industry?: string; stage?: string; tags?: string[] }) {
  return jpost('/rag/ingest-url', { url, ...(meta || {}) });
}

/** Ingest a file into the RAG store */
export async function ingestFile(file: File, meta?: { industry?: string; stage?: string; tags?: string[] }) {
  const form = new FormData();
  form.append('file', file);
  if (meta?.industry) form.append('industry', meta.industry);
  if (meta?.stage) form.append('stage', meta.stage);
  if (meta?.tags) form.append('tags', JSON.stringify(meta.tags));

  const res = await fetch(`${API}/rag/ingest-file`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`/rag/ingest-file failed: ${res.status}`);
  return res.json();
}

/** OLS-based weight suggestion */
export async function estimateElasticities(payload: {
  parent: number[];
  children: Record<string, number[]>;
  add_intercept?: boolean;
  non_negative?: boolean;
  normalize?: boolean;
  ci?: boolean;
}) {
  return jpost('/elasticities/estimate', payload);
}

/** Generate metric ideas by industry/stage (non-LLM bank) */
export async function ideateMetrics(payload: {
  industry?: string;
  stage?: string;
  count?: number;
  diversity?: number;
}) {
  return jpost('/metric-tree/ideate', payload);
}
// Back-compat aliases for older imports
export { ingestUrl as ragIngestUrl, ingestFile as ragIngestFile };
