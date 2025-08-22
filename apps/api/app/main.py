from fastapi import FastAPI, Body
# from .some_router import router as lint_router
from fastapi.middleware.cors import CORSMiddleware
from .models.schema import NSMRequest, NSMCandidate, ExpandRequest, Tree
from .logic.nsm import suggest_nsm
from .logic.tree import expand_tree
from .logic.explain import explain_node
from .logic.rag import rag_search

app = FastAPI(title="Metric Trees API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Make sure the lint router is included
# app.include_router(lint_router, prefix="/lint")

@app.get("/healthz")
def health():
    return {"ok": True}

@app.post("/metric-tree/suggest")
def suggest(req: NSMRequest) -> dict[str, list[NSMCandidate]]:
    ideas = suggest_nsm(req.industry, req.product_type, req.emphasis)
    return {"candidates": ideas}

@app.post("/metric-tree/expand")
def expand(req: ExpandRequest) -> Tree:
    nsm = req.north_star or suggest_nsm(req.industry, req.product_type, req.emphasis)[0]["name"]
    return expand_tree(nsm, req.industry)

@app.post("/metric-tree/explain")
def explain(payload: dict = Body(...)) -> dict:
    node = payload.get("node")
    parent = payload.get("parent")
    return explain_node(node, parent)

@app.post("/metric-tree/lint")
def lint(payload: dict = Body(...)) -> dict:
    tree = Tree(**payload["tree"])
    warnings = []
    VANITY = ["page views","impressions","likes","followers","downloads","time on site"]
    for n in tree.nodes:
        if any(v in n.name.lower() for v in VANITY) and n.type == "input":
            warnings.append(f"Possible vanity metric: '{n.name}'. Ensure it's a controllable driver.")
    for n in [tree.north_star] + [x for x in tree.nodes if x.id != tree.north_star.id]:
        for fld in ["owner","window"]:
            if getattr(n, fld, None) in (None, "", 0):
                warnings.append(f"Missing '{fld}' on node '{n.name}'.")
    child_ids = {e.src for e in tree.edges}
    parent_ids = {e.dst for e in tree.edges}
    for n in tree.nodes:
        if n.id != tree.north_star.id and n.id not in child_ids and n.id not in parent_ids:
            warnings.append(f"Unlinked node '{n.name}'.")
    return {"warnings": warnings}

@app.post("/rag/search")
def rag(payload: dict = Body(...)) -> dict:
    q = payload.get("q","")
    k = int(payload.get("k",3))
    return {"results": rag_search(q,k)}

# --- RAG router ---
from .rag_router import router as rag_router
app.include_router(rag_router)

# --- RAG router ---
from .rag_router import router as rag_router
app.include_router(rag_router)

# --- Explainability router ---
from .explain_router import router as explain_router
app.include_router(explain_router)

# --- Elasticities router ---
from .elasticities_router import router as elasticities_router
app.include_router(elasticities_router)

from .ideate_router import router as ideate_router
app.include_router(ideate_router)
