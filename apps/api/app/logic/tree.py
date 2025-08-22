from __future__ import annotations
from typing import List
from ..models.schema import Node, Edge, Tree

STAGE = {
  "adoption": "Activation",
  "activation": "Activation",
  "engagement": "Engagement",
  "retention": "Retention",
  "referral": "Referral",
  "revenue": "Revenue"
}

def expand_tree(north_star: str, industry: str) -> Tree:
    ns = Node(id="ns", name=north_star, type="focus", level=0, window="7d", owner="Growth PM")
    nodes: List[Node] = [ns]
    edges: List[Edge] = []

    if "subscriber" in north_star.lower() or "WAS" in north_star:
        l1 = [
          Node(id="l1_ret", name="7-day Retention", type="input", level=1, formula="retained_7d / active_7d", stage=STAGE["retention"], guardrails=["new user experience quality"], counter_metrics=["spam_rate"]),
          Node(id="l1_eng", name="Minutes viewed / WAS", type="input", level=1, formula="total_minutes / WAS", stage=STAGE["engagement"]),
          Node(id="l1_arpu", name="ARPU", type="input", level=1, formula="revenue / subscribers", stage=STAGE["revenue"])
        ]
        nodes += l1
        edges += [Edge(src=n.id, dst="ns") for n in l1]
        l2 = [
          Node(id="l2_same_show", name="Same-show retention", type="input", level=2, stage=STAGE["retention"]),
          Node(id="l2_completion", name="Completion rate", type="input", level=2, stage=STAGE["engagement"]),
          Node(id="l2_trial_conv", name="Trial → Paid conversion", type="input", level=2, stage=STAGE["revenue"]),
        ]
        nodes += l2
        edges += [Edge(src="l2_same_show", dst="l1_ret"), Edge(src="l2_completion", dst="l1_eng"), Edge(src="l2_trial_conv", dst="l1_arpu")]
    else:
        l1 = [
          Node(id="l1_act", name="Activation rate (FTUX)", type="input", level=1, formula="activated_users / signups", stage=STAGE["activation"]),
          Node(id="l1_7dret", name="7-day retention", type="input", level=1, formula="retained_7d / active_7d", stage=STAGE["retention"]),
          Node(id="l1_depth", name="Core feature adoption %", type="input", level=1, formula="users_used_core / WAU", stage=STAGE["engagement"]),
          Node(id="l1_ref", name="Referral rate", type="input", level=1, formula="referrals / WAU", stage=STAGE["referral"]),
          Node(id="l1_arpu", name="ARPU", type="input", level=1, formula="revenue / actives", stage=STAGE["revenue"])
        ]
        nodes += l1
        edges += [Edge(src=n.id, dst="ns") for n in l1]
        l2 = [
          Node(id="l2_onboard", name="Onboarding completion", type="input", level=2, stage=STAGE["activation"]),
          Node(id="l2_freq", name="Sessions / WAU", type="input", level=2, stage=STAGE["engagement"]),
          Node(id="l2_nps", name="NPS", type="input", level=2, stage=STAGE["retention"]),
        ]
        nodes += l2
        edges += [Edge(src="l2_onboard", dst="l1_act"), Edge(src="l2_freq", dst="l1_depth"), Edge(src="l2_nps", dst="l1_7dret")]

    return Tree(north_star=ns, nodes=nodes, edges=edges)
