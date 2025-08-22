from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict
import random

router = APIRouter(prefix="/metric-tree", tags=["metric-tree"])

IDEAS = {
    "SaaS B2B": {
        "Activation": ["Time-to-first-value","Onboarding completion","First team invited","Template used"],
        "Engagement": ["Weekly core actions / WAU","Active seats %","Projects edited","API calls / account"],
        "Retention": ["Logo retention","Seat retention","Reactivation rate","Feature-level retention"],
        "Referral": ["Invites sent","Invite→accept%","Org-to-org referrals","Public link shares"],
        "Revenue": ["Trial→paid CVR","Expansion MRR","ARPPU","Gross retention"],
    },
    "eCommerce": {
        "Activation": ["First purchase latency","Add-to-cart completion","Account creation CVR"],
        "Engagement": ["Session depth","Repeat vertical visits","Wishlist additions"],
        "Retention": ["30-day repeat purchase%","Cohort spend decay","Reactivation rate"],
        "Referral": ["Share to social","Referral code usage","UGC submissions"],
        "Revenue": ["AOV","Items per order","Discount take-rate","Net margin%"],
    },
}

class IdeateBody(BaseModel):
    industry: Optional[str] = None
    stage: Optional[str] = None
    count: int = 8
    diversity: int = 2

@router.post("/ideate")
def ideate(body: IdeateBody):
    industry = body.industry or "SaaS B2B"
    bank: Dict[str, List[str]] = IDEAS.get(industry, IDEAS["SaaS B2B"])
    stages = [body.stage] if body.stage else ["Activation","Engagement","Retention","Referral","Revenue"]
    rnd = random.Random(body.diversity * 1337)
    out = []
    per = max(1, body.count // len(stages))
    for s in stages:
        pool = bank.get(s, [])
        picks = rnd.sample(pool, min(per, len(pool))) if pool else []
        for name in picks:
            out.append({
                "stage": s, "name": name,
                "measure": f"Define a precise formula for '{name}' and owner.",
                "why": f"{name} is often a leading indicator for {s.lower()} in {industry}."
            })
    return {"ideas": out[:body.count]}
