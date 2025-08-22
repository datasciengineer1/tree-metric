from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os, io, json, uuid, re
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader
import numpy as np

# Embeddings (always via fastembed)
try:
    from fastembed import TextEmbedding
except Exception:
    TextEmbedding = None

# Qdrant (optional)
try:
    from qdrant_client import QdrantClient
    from qdrant_client.http.models import Distance, VectorParams, Filter, FieldCondition, MatchValue
except Exception:
    QdrantClient = None
    Distance = VectorParams = Filter = FieldCondition = MatchValue = None  # type: ignore

router = APIRouter(prefix="/rag", tags=["rag"])

QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
COLLECTION = os.environ.get("QDRANT_COLLECTION", "rag_chunks")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)
JSONL_PATH = os.path.join(DATA_DIR, "rag_store.jsonl")

_embedder = TextEmbedding() if TextEmbedding else None
EMBED_DIM = 384  # bge-small

def _client():
    if QdrantClient is None:
        return None
    try:
        return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=5.0)
    except Exception:
        return None

def _ensure_collection():
    client = _client()
    if not client or Distance is None or VectorParams is None:
        return
    try:
        names = [c.name for c in client.get_collections().collections]
        if COLLECTION not in names:
            client.create_collection(COLLECTION, vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE))
    except Exception:
        pass

def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def _chunk(text: str, max_len=900, overlap=200):
    text = _clean(text)
    if not text: return []
    if len(text) <= max_len: return [text]
    out, i = [], 0
    while i < len(text):
        out.append(text[i:i+max_len])
        i += max_len - overlap
    return out

def _embed(texts: List[str]) -> List[List[float]]:
    if not _embedder: return []
    return list(_embedder.embed(texts))

def _append_jsonl(records: List[Dict[str, Any]]):
    with open(JSONL_PATH, "a", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

def _upsert_qdrant(records: List[Dict[str, Any]]):
    client = _client()
    if not client: return
    _ensure_collection()
    try:
        client.upsert(
            collection_name=COLLECTION,
            points=[{"id": r["id"], "vector": r["vector"], "payload": {k:v for k,v in r.items() if k!='vector'}} for r in records]
        )
    except Exception:
        pass

class IngestURL(BaseModel):
    url: str
    industry: Optional[str] = None
    stage: Optional[str] = None
    tags: Optional[List[str]] = None

class SearchBody(BaseModel):
    q: str
    limit: int = 8
    provider: Optional[str] = None   # "qdrant" or None
    industry: Optional[str] = None
    stage: Optional[str] = None

@router.post("/ingest-url")
def ingest_url(body: IngestURL):
    try:
        r = requests.get(body.url, timeout=20)
        r.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fetch failed: {e}")

    text = ""
    if "pdf" in (r.headers.get("content-type","").lower()) or body.url.lower().endswith(".pdf"):
        with io.BytesIO(r.content) as bio:
            reader = PdfReader(bio)
            for p in reader.pages:
                text += p.extract_text() or ""
    else:
        soup = BeautifulSoup(r.text, "html.parser")
        text = soup.get_text(separator=" ")

    chunks = _chunk(text)
    if not chunks: raise HTTPException(status_code=400, detail="No text extracted.")

    vecs = _embed(chunks)
    records = [{
        "id": str(uuid.uuid4()),
        "text": ch,
        "vector": v,
        "source": "url",
        "url": body.url,
        "industry": body.industry,
        "stage": body.stage,
        "tags": body.tags or [],
    } for ch, v in zip(chunks, vecs)]

    _append_jsonl(records)
    _upsert_qdrant(records)
    return {"ok": True, "chunks": len(records)}

@router.post("/ingest-file")
async def ingest_file(
    file: UploadFile = File(...),
    industry: Optional[str] = Form(None),
    stage: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
):
    raw = await file.read()
    name = (file.filename or "").lower()
    try:
        if name.endswith(".pdf"):
            with io.BytesIO(raw) as bio:
                reader = PdfReader(bio)
                text = "".join((p.extract_text() or "") for p in reader.pages)
        else:
            text = raw.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse failed: {e}")

    chunks = _chunk(text)
    if not chunks: raise HTTPException(status_code=400, detail="No text extracted.")

    vecs = _embed(chunks)
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    records = [{
        "id": str(uuid.uuid4()),
        "text": ch,
        "vector": v,
        "source": "file",
        "filename": file.filename,
        "industry": industry,
        "stage": stage,
        "tags": tag_list,
    } for ch, v in zip(chunks, vecs)]

    _append_jsonl(records)
    _upsert_qdrant(records)
    return {"ok": True, "chunks": len(records)}

def _local_vector_search(q: str, limit: int, industry: Optional[str], stage: Optional[str]):
    if not _embedder: return []
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
    if not corpus: return []

    M = np.array([r["vector"] for r in corpus], dtype="float32")
    M /= (np.linalg.norm(M, axis=1, keepdims=True) + 1e-8)
    qv = np.array(_embed([q])[0], dtype="float32")
    qv /= (np.linalg.norm(qv) + 1e-8)
    scores = M @ qv
    idx = np.argsort(-scores)[:limit]
    out = []
    for i in idx:
        r = corpus[int(i)]
        out.append({
            "id": r["id"],
            "score": float(scores[int(i)]),
            "text": r.get("text"),
            "source": r.get("source"),
            "url": r.get("url"),
            "filename": r.get("filename"),
            "industry": r.get("industry"),
            "stage": r.get("stage"),
            "tags": r.get("tags", []),
        })
    return out

@router.post("/search")
def rag_search(body: SearchBody):
    if (body.provider or "").lower() == "qdrant":
        client = _client()
        if client and Filter and FieldCondition and MatchValue:
            _ensure_collection()
            try:
                vec = _embed([body.q])[0]
                must = []
                if body.industry: must.append(FieldCondition(key="industry", match=MatchValue(value=body.industry)))
                if body.stage:    must.append(FieldCondition(key="stage", match=MatchValue(value=body.stage)))
                flt = Filter(must=must) if must else None
                res = client.search(collection_name=COLLECTION, query_vector=vec, limit=body.limit, with_payload=True, query_filter=flt)
                return {"results": [{
                    "id": str(r.id),
                    "score": float(r.score),
                    "text": (r.payload or {}).get("text"),
                    "source": (r.payload or {}).get("source"),
                    "url": (r.payload or {}).get("url"),
                    "filename": (r.payload or {}).get("filename"),
                    "industry": (r.payload or {}).get("industry"),
                    "stage": (r.payload or {}).get("stage"),
                    "tags": (r.payload or {}).get("tags", []),
                } for r in res], "provider": "qdrant"}
            except Exception:
                pass

    local_vec = _local_vector_search(body.q, body.limit, body.industry, body.stage)
    if local_vec:
        return {"results": local_vec, "provider": "local-vectors"}

    # keyword fallback
    corpus = []
    try:
        with open(JSONL_PATH, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    j = json.loads(line)
                except Exception:
                    continue
                if body.industry and j.get("industry") != body.industry: continue
                if body.stage and j.get("stage") != body.stage: continue
                corpus.append(j)
    except FileNotFoundError:
        pass
    qset = set(_clean(body.q).lower().split())
    scored = []
    for r in corpus:
        words = set(_clean(r.get("text","")).lower().split())
        inter = len(qset & words)
        scored.append((inter / max(1, len(qset)), r))
    scored.sort(key=lambda x: x[0], reverse=True)
    return {"results": [{
        "id": r["id"], "score": float(s),
        "text": r.get("text"), "source": r.get("source"),
        "url": r.get("url"), "filename": r.get("filename"),
        "industry": r.get("industry"), "stage": r.get("stage"),
        "tags": r.get("tags", []),
    } for s, r in scored[:body.limit]], "provider": "local-bow"}
