from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os, json, re
import numpy as np

# Optional Qdrant (will gracefully fallback)
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, Filter, FieldCondition, MatchValue
from qdrant_client.fastembed import TextEmbedding

router = APIRouter(prefix="/", tags=["explain"])

# ---- RAG config (shared with rag_router) ----
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
QDRANT_COLLECTION = os.environ.get("QDRANT_COLLECTION", "rag_chunks")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)
JSONL_PATH = os.path.join(DATA_DIR, "rag_store.jsonl")

_embedder = TextEmbedding()  # ONNX small; ~384 dims
EMBED_DIM = 384

def _client():
    try:
        return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=5.0)
    except Exception:
        return None

def _ensure_collection():
    client = _client()
    if not client: return
    try:
        names = [c.name for c in client.get_collections().collections]
        if QDRANT_COLLECTION not in names:
            client.create_collection(QDRANT_COLLECTION, vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE))
    except Exception:
        pass

def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def _embed_one(q: str) -> List[float]:
    return list(_embedder.embed([q]))[0]

def _local_vector_search(q: str, limit: int = 5, industry: Optional[str] = None, stage: Optional[str] = None):
    corpus: List[Dict[str, Any]] = []
    try:
        with open(JSONL_PATH, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    j = json.loads(line)
                except Exception:
                    continue
                if industry and j.get("industry") != industry: continue
                if stage and j.get("stage") != stage: continue
                if "vector" in j and isinstance(j["vector"], list):
                    corpus.append(j)
    except FileNotFoundError:
        pass
    if not corpus:
        return []

    M = np.array([r["vector"] for r in corpus], dtype="float32")
    M /= (np.linalg.norm(M, axis=1, keepdims=True) + 1e-8)
    qv = np.array(_embed_one(q), dtype="float32")
    qv /= (np.linalg.norm(qv) + 1e-8)

    scores = M @ qv
    idx = np.argsort(-scores)[:limit]
    out = []
    for i in idx:
        r = corpus[int(i)]
        out.append({"text": r.get("text",""), "score": float(scores[int(i)])})
    return out

def _qdrant_search(q: str, limit: int = 5, industry: Optional[str] = None, stage: Optional[str] = None):
    client = _client()
    if not client:
        return []
    _ensure_collection()
    try:
        vec = _embed_one(q)
        flt = None
        must = []
        if industry: must.append(FieldCondition(key="industry", match=MatchValue(value=industry)))
        if stage:    must.append(FieldCondition(key="stage", match=MatchValue(value=stage)))
        if must:     flt = Filter(must=must)
        res = client.search(collection_name=QDRANT_COLLECTION, query_vector=vec, limit=limit, with_payload=True, query_filter=flt)
        return [{"text": (r.payload or {}).get("text",""), "score": float(r.score)} for r in res]
    except Exception:
        return []

def infer_stage(name: str) -> str:
    n = (name or "").lower()
    if "adopt" in n or "install" in n or "signup" in n: return "Adoption"
    if "activate" in n or "ftux" in n or "aha" in n:    return "Activation"
    if "retain" in n or "churn" in n:                   return "Retention"
    if "refer" in n or "invite" in n or "k-factor" in n:return "Referral"
    if "revenue" in n or "arpu" in n or "paid" in n or "mrr" in n or "arr" in n or "conversion" in n: return "Revenue"
    return "Engagement"

def base_playbook(stage: str, node: str):
    why = {
        "Adoption":  f"{node} expands top-of-funnel volume so more qualified users enter your product.",
        "Activation":f"{node} shortens time-to-value and increases the share of new users who reach the aha moment.",
        "Engagement":f"{node} deepens habitual use and compounds long-term value creation.",
        "Retention": f"{node} preserves acquired value; small gains here usually beat top-of-funnel.",
        "Referral":  f"{node} turns happy users into a growth channel with near-zero CAC.",
        "Revenue":   f"{node} monetizes value captured while balancing conversion and long-term LTV.",
    }[stage]

    move = {
        "Adoption": [
            "Tighten targeting & channels; improve landing page message-market fit.",
            "Ship high-intent SEO/ASO pages; reduce first-click latency.",
            "Partnerships or distribution loops where your users already are."
        ],
        "Activation": [
            "Clarify aha moment; guide users there in FTUX with checklists & defaults.",
            "Reduce cognitive load: progressive disclosure, sensible defaults, sample data.",
            "Shorten time-to-value: template gallery, importers, one-click examples."
        ],
        "Engagement": [
            "Instrument core action frequency targets (e.g., 3x/week).",
            "Lifecycle nudges: in-product tips, email/push for dormant users.",
            "Personalize surfaces to put most-used actions next."
        ],
        "Retention": [
            "Cohort analysis by feature adoption; win-back flows for at-risk users.",
            "Remove recurring friction (perf, reliability, billing failures).",
            "Value reinforcement: success moments and progress reminders."
        ],
        "Referral": [
            "Make sharing native to success moments; prefilled messages.",
            "Right-size incentives; anti-abuse checks to protect k-factor.",
            "Lower invite friction: deep links, contacts import."
        ],
        "Revenue": [
            "Price-to-value alignment; simplify paywall & plans.",
            "Trial-to-paid experiments (time/usage gating, prompts).",
            "Reduce billing friction and involuntary churn (dunning)."
        ],
    }[stage]

    measure = {
        "Adoption":  ["New users/day", "Visit→Signup CVR", "CAC by channel", "Qualified traffic share"],
        "Activation":["Activation rate", "Time-to-aha", "FTUX completion%", "Step drop-off"],
        "Engagement":["DAU/WAU/MAU", "Core action frequency", "Stickiness (DAU/MAU)", "Feature adoption%"],
        "Retention": ["D1/D7/D30 retention", "Monthly churn%", "Cohort decay slope", "Reactivation rate"],
        "Referral":  ["Invites sent", "Invite→Accept rate", "k-factor", "Fraud rate"],
        "Revenue":   ["Trial→Paid CVR", "ARPU/ARPPU", "MRR/ARR", "Gross/Net retention"],
    }[stage]

    counter = {
        "Adoption":  "Low-quality traffic inflates vanity signups and CAC.",
        "Activation":"Feature bloat or hard gates that slow time-to-value.",
        "Engagement":"Notification fatigue or dark patterns that hurt trust.",
        "Retention": "Over-incentivizing legacy behavior blocking innovation.",
        "Referral":  "Abuse/spam; incentive cannibalization.",
        "Revenue":   "Short-term discounting that erodes LTV and brand.",
    }[stage]

    owner_suggestions = {
        "Adoption":  ["Growth PM", "Performance Marketing", "Web Eng"],
        "Activation":["Product PM", "Onboarding Eng", "Design"],
        "Engagement":["Lifecycle Marketing", "Data Science", "Core App Eng"],
        "Retention": ["Lifecycle PM", "Support Ops", "SRE/Perf"],
        "Referral":  ["Growth PM", "Platform Eng", "Fraud/Risk"],
        "Revenue":   ["Monetization PM", "RevOps", "Billing Eng"],
    }[stage]

    actions = {
        "Adoption":  {"this_week": ["Heatmap & rewrite hero copy", "A/B test CTA contrast"], "this_quarter":["Ship SEO hub", "Partnership experiment"]},
        "Activation":{"this_week": ["Define aha metric & log it", "Trim FTUX steps by 30%"], "this_quarter":["Template gallery v1", "Guided checklist"]},
        "Engagement":{"this_week": ["Set weekly core-action target", "Enable nudges"], "this_quarter":["Personalized home v1", "Habit loops"]},
        "Retention": {"this_week": ["Instrument churn reasons", "Set win-back email"], "this_quarter":["Reliability SLIs", "Reactivation campaigns"]},
        "Referral":  {"this_week": ["Add share CTA at success moment", "Prefill messages"], "this_quarter":["Incentive tuning", "Abuse heuristics"]},
        "Revenue":   {"this_week": ["Simplify paywall copy", "Trial prompt experiment"], "this_quarter":["Plan audit", "Dunning improvements"]},
    }[stage]

    return why, move, measure, counter, owner_suggestions, actions

class ExplainBody(BaseModel):
    node: str
    parent: Optional[str] = None
    use_rag: Optional[bool] = False
    rag_provider: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None

@router.post("/explain")
def explain(body: ExplainBody):
    node = body.node.strip()
    if not node:
        raise HTTPException(status_code=400, detail="Missing node")

    stage = body.stage or infer_stage(node)
    why, move, measure, counter, owner_suggestions, actions = base_playbook(stage, node)

    # Optional RAG enrichment
    rag_items: List[str] = []
    if body.use_rag:
        query = f"{node} {stage} best practices playbook improve"
        if (body.rag_provider or "").lower() == "qdrant":
            hits = _qdrant_search(query, limit=5, industry=body.industry, stage=stage)
        else:
            hits = _local_vector_search(query, limit=5, industry=body.industry, stage=stage)
        # pull a few actionable sentences
        for h in hits[:3]:
            text = _clean(h.get("text",""))
            if not text: continue
            # naive sentence split
            for sent in re.split(r"(?<=[.!?])\s+", text):
                s = sent.strip()
                if 24 <= len(s) <= 180 and any(k in s.lower() for k in ["increase","improve","reduce","optimiz","experiment","measure","instrument","cohort","retention","activation","referral","pricing"]):
                    rag_items.append(f"From playbooks: {s}")
                    break

    if rag_items:
        move = (move + rag_items)[:8]  # cap to keep tidy

    return {
        "node": node,
        "stage": stage,
        "why_it_matters": why,
        "how_to_move": move,
        "how_to_measure": measure,
        "counter_metric": counter,
        "owner_suggestions": owner_suggestions,
        "team_actions": actions,
    }
