import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetch } from "undici";
const API = process.env.METRIC_TREES_API || "http://localhost:8000";
const text = (data) => ({ type: "text", text: JSON.stringify(data, null, 2) });
const server = new McpServer({ name: "metric-trees-mcp", version: "0.1.0" });
// expand_tree
server.registerTool("expand_tree", {
    title: "Expand Metric Tree",
    description: "Expand a North Star metric tree for an industry and product.",
    // NOTE: ZodRawShape (shape), not z.object(...)
    inputSchema: {
        industry: z.string().describe("e.g., 'SaaS B2B'"),
        product_type: z.string().describe("e.g., 'Team workspace'")
    }
}, async ({ industry, product_type }) => {
    const res = await fetch(`${API}/metric-tree/expand`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ industry, product_type })
    });
    if (!res.ok)
        throw new Error(`expand_tree failed: ${res.status}`);
    return { content: [text(await res.json())] };
});
// explain
server.registerTool("explain", {
    title: "Explain Node",
    description: "Explain a metric node with optional RAG enrichment.",
    inputSchema: {
        node: z.string(),
        parent: z.string().optional(),
        use_rag: z.boolean().default(false).optional(),
        rag_provider: z.enum(["qdrant", "local"]).optional(),
        industry: z.string().optional(),
        stage: z.string().optional()
    }
}, async (args) => {
    const res = await fetch(`${API}/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args)
    });
    if (!res.ok)
        throw new Error(`explain failed: ${res.status}`);
    return { content: [text(await res.json())] };
});
// rag_search
server.registerTool("rag_search", {
    title: "RAG Search",
    description: "Semantic search across ingested playbooks (Qdrant/local).",
    inputSchema: {
        q: z.string(),
        provider: z.enum(["qdrant", "local"]).optional(),
        industry: z.string().optional(),
        stage: z.string().optional(),
        limit: z.number().default(8).optional()
    }
}, async (args) => {
    const res = await fetch(`${API}/rag/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args)
    });
    if (!res.ok)
        throw new Error(`rag_search failed: ${res.status}`);
    return { content: [text(await res.json())] };
});
// rag_ingest_url
server.registerTool("rag_ingest_url", {
    title: "RAG Ingest URL",
    description: "Ingest a URL (PDF or HTML) into the RAG store.",
    inputSchema: {
        url: z.string(),
        industry: z.string().optional(),
        stage: z.string().optional(),
        tags: z.array(z.string()).optional()
    }
}, async (args) => {
    const res = await fetch(`${API}/rag/ingest-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args)
    });
    if (!res.ok)
        throw new Error(`rag_ingest_url failed: ${res.status}`);
    return { content: [text(await res.json())] };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("Metric Trees MCP server ready on stdio");
}
main().catch((err) => {
    console.error("Fatal MCP server error:", err);
    process.exit(1);
});
// --- elasticities_estimate ---
server.registerTool("elasticities_estimate", {
    title: "Estimate Elasticities",
    description: "Fit OLS y≈Σ w_i x_i and suggest non-negative, normalized weights.",
    inputSchema: {
        parent: z.array(z.number()).describe("Parent series y[t]"),
        children: z.record(z.array(z.number())).describe("Map child->series x[t]"),
        add_intercept: z.boolean().optional(),
        non_negative: z.boolean().optional(),
        normalize: z.boolean().optional(),
        ci: z.boolean().optional()
    }
}, async (args) => {
    const res = await fetch(`${API}/elasticities/estimate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args)
    });
    if (!res.ok)
        throw new Error(`elasticities_estimate failed: ${res.status}`);
    return { content: [text(await res.json())] };
});
