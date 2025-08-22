from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os, re, json
import numpy as np

# Embeddings (always via fastembed ONNX)
try:
    from fastembed import TextEmbedding
except Exception:
    TextEmbedding = None

# Qdrant (optional)
try:
    from qdrant_client import QdrantClient
    from qdrant_client.http.models import Filter, FieldCondition, MatchValue
except Exception:
    QdrantClient = None
    Filter = FieldCondition = MatchValue = None  # type: ignore

router = APIRouter(tags=["explain"])

# --- Config shared with rag_router ---
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
QDRANT_COLLECTION = os.environ.get("QDRANT_COLLECTION", "rag_chunks")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)
JSONL_PATH = os.path.join(DATA_DIR, "rag_store.jsonl")

# Embedding model
_embedder = TextEmbedding() if TextEmbedding else None  # bge-small/onnx (~384d)

def _client():
    if QdrantClient is None:
        return None
    try:
        return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=5.0)
    except Exception:
        return None

def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def _embed_one(q: str):
    if not _embedder:
        return None
    return list(_embedder.embed([q]))[0]

def _local_vector_search(q: str, limit: int = 5, industry: Optional[str] = None, stage: Optional[str] = None):
    if not _embedder:
        return []
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
                if isinstance(j.get("vector"), list):
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
    if not _embedder:
        return []
    client = _client()
    if not client:
        return []
    try:
        vec = _embed_one(q)
        if vec is None:
            return []
        flt = None
        if Filter and FieldCondition and MatchValue:
            must = []
            if industry: must.append(FieldCondition(key="industry", match=MatchValue(value=industry)))
            if stage:    must.append(FieldCondition(key="stage", match=MatchValue(value=stage)))
            if must: flt = Filter(must=must)
        res = client.search(
            collection_name=QDRANT_COLLECTION,
            query_vector=vec,
            limit=limit,
            with_payload=True,
            query_filter=flt,
        )
        return [{"text": (r.payload or {}).get("text",""), "score": float(r.score)} for r in res]
    except Exception:
        return []

def infer_stage(name: str) -> str:
    n = (name or "").lower()
    if "adopt" in n or "install" in n or "signup" in n: return "Adoption"
    if "activate" in n or "ftux" in n or "aha" in n:    return "Activation"
    if "retain" in n or "churn" in n:                   return "Retention"
    if "refer" in n or "invite" in n or "k-factor" in n:return "Referral"
    if any(k in n for k in ["revenue","arpu","paid","mrr","arr","conversion"]): return "Revenue"
    return "Engagement"

def base_playbook(stage: str, node: str):
    why = {
        "Adoption":  f"{node} expands top-of-funnel volume so more qualified users enter your product.",
        "Activation":f"{node} shortens time-to-value and increases the share of new users who reach the aha moment.",
        "Engagement":f"{node} deepens habitual use and compounds long-term value creation.",
        "Retention": f"{node} preserves acquired value; small gains here usually beat top-of-funnel.",
        "Referral":  f"{node} turns happy users into a growth channel with near-zero CAC.",
        "Revenue":   f"{node} monetizes captured value while balancing conversion and long-term LTV.",
    }[stage]
    move = {
        "Adoption":  ["Tighten targeting & landing page M/M fit","Ship high-intent SEO pages","Try partner distribution loops"],
        "Activation":["Guide to aha in FTUX","Reduce cognitive load (defaults, samples)","Shorten time-to-value (templates/importers)"],
        "Engagement":["Instrument core-action frequency","Lifecycle nudges for dormant users","Personalize home to next best action"],
        "Retention": ["Cohort analysis by feature adoption","Fix recurring friction (perf, billing)","Reinforce success moments"],
        "Referral":  ["Share at success moments","Right-size incentives & anti-abuse","Lower invite friction (deep links)"],
        "Revenue":   ["Price-to-value alignment","Trial→Paid experiments","Reduce involuntary churn (dunning)"],
    }[stage]
    measure = {
        "Adoption":  ["New users/day","Visit→Signup CVR","CAC by channel","Qualified traffic share"],
        "Activation":["Activation rate","Time-to-aha","FTUX completion%","Step drop-off"],
        "Engagement":["DAU/WAU/MAU","Core action freq","Stickiness (DAU/MAU)","Feature adoption%"],
        "Retention": ["D1/D7/D30 retention","Monthly churn%","Cohort decay slope","Reactivation rate"],
        "Referral":  ["Invites sent","Invite→Accept rate","k-factor","Fraud rate"],
        "Revenue":   ["Trial→Paid CVR","ARPU/ARPPU","MRR/ARR","Gross/Net retention"],
    }[stage]
    counter = {
        "Adoption":  "Low-quality traffic inflates vanity signups and CAC.",
        "Activation":"Bloat or hard gates slow time-to-value.",
        "Engagement":"Notification fatigue / dark patterns hurt trust.",
        "Retention": "Over-indexing on legacy behavior blocks innovation.",
        "Referral":  "Abuse/spam; incentive cannibalization.",
        "Revenue":   "Short-term discounts erode LTV and brand.",
    }[stage]
    owner_suggestions = {
        "Adoption":  ["Growth PM","Perf Marketing","Web Eng"],
        "Activation":["Product PM","Onboarding Eng","Design"],
        "Engagement":["Lifecycle Marketing","Data Science","Core Eng"],
        "Retention": ["Lifecycle PM","Support Ops","SRE/Perf"],
        "Referral":  ["Growth PM","Platform Eng","Fraud/Risk"],
        "Revenue":   ["Monetization PM","RevOps","Billing Eng"],
    }[stage]
    actions = {
        "Adoption":  {"this_week":["Rewrite hero & CTA","Launch A/B test"],"this_quarter":["SEO hub","Partnerships"]},
        "Activation":{"this_week":["Define aha & log it","Trim FTUX by 30%"],"this_quarter":["Template gallery","Guided checklist"]},
        "Engagement":{"this_week":["Set weekly core-action target","Enable nudges"],"this_quarter":["Personalized home","Habit loops"]},
        "Retention": {"this_week":["Instrument churn reasons","Win-back email"],"this_quarter":["Reliability SLIs","Reactivation series"]},
        "Referral":  {"this_week":["Add share at success","Prefill messages"],"this_quarter":["Incentive tuning","Abuse heuristics"]},
        "Revenue":   {"this_week":["Simplify paywall copy","Trial prompt"],"this_quarter":["Plan audit","Improve dunning"]},
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
    node = (body.node or "").strip()
    if not node:
        raise HTTPException(status_code=400, detail="Missing node")
    stage = body.stage or infer_stage(node)
    why, move, measure, counter, owner_suggestions, actions = base_playbook(stage, node)

    # Optional RAG enrichment
    if body.use_rag:
        query = f"{node} {stage} improve experiment measure"
        hits = _qdrant_search(query, limit=5, industry=body.industry, stage=stage) \
               if (body.rag_provider or "").lower() == "qdrant" else \
               _local_vector_search(query, limit=5, industry=body.industry, stage=stage)
        for h in hits[:3]:
            text = _clean(h.get("text","") if isinstance(h, dict) else h)
            if not text: continue
            for sent in re.split(r"(?<=[.!?])\s+", text):
                s = sent.strip()
                if 24 <= len(s) <= 160 and any(k in s.lower() for k in ["increase","improve","reduce","optimiz","experiment","measure","cohort","retention","activation","referral","pricing"]):
                    move = (move + [f"From playbooks: {s}"])[:8]
                    break

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
