from __future__ import annotations
from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

SEED_DOCS = [
    {"id":"tmpl_saas_01","text":"SaaS activation: FTUX completion increases retention. Measure activated_users / signups within 7 days. Improve with checklists and SSO."},
    {"id":"tmpl_streaming_01","text":"Streaming NSM: Weekly Active Subscribers. Inputs: 7-day retention, minutes viewed per subscriber, ARPU. Track completion rate and trial-to-paid."},
    {"id":"tmpl_marketplace_01","text":"Marketplace liquidity: match rate and time-to-match drive successful matches per week. Balance quality and quantity, avoid cold-start traps."},
    {"id":"tmpl_referral_01","text":"Referrals: simple invite flows near aha moments; measure referral_signups / WAU and monitor incentive abuse."},
]

class SimpleRAG:
    def __init__(self, docs: List[Dict[str,str]]):
        self.ids = [d["id"] for d in docs]
        self.texts = [d["text"] for d in docs]
        self.v = TfidfVectorizer(stop_words="english")
        self.m = self.v.fit_transform(self.texts)
    def search(self, q: str, k: int = 3) -> List[Dict[str, Any]]:
        qv = self.v.transform([q])
        sims = linear_kernel(qv, self.m).flatten()
        idx = sims.argsort()[::-1][:k]
        return [{"id": self.ids[i], "score": float(sims[i]), "text": self.texts[i]} for i in idx]

RAG = SimpleRAG(SEED_DOCS)

def rag_search(query: str, k: int = 3) -> List[Dict[str, Any]]:
    return RAG.search(query, k=k)
