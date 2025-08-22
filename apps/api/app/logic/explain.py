from __future__ import annotations
from typing import Dict, Any

TEMPLATES = {
    "Activation": {
        "why": "Activation is the earliest leading indicator of retention and monetization. It proves users reached the first value moment.",
        "move": [
            "Shorten onboarding (progressive profiling, SSO)",
            "Add checklist with 1–3 core actions",
            "Contextual tips and empty-state examples",
            "Nudge via email/notifications for unfinished FTUX"
        ],
        "measure": [
            "Event: user_activated (within 7 days of signup)",
            "SQL: activated_users / signups",
            "Cohort view by acquisition channel"
        ],
        "counter": "Activation-to-churn (users activate then churn quickly)",
        "owner_suggestions": ["Growth PM", "Onboarding Designer"],
        "team_actions": {
            "this_week": [
                "Ship 1-step SSO setup",
                "Instrument 'user_activated' event with properties"
            ],
            "this_quarter": [
                "Design progressive onboarding with checklist",
                "A/B test shorter FTUX vs current"
            ]
        }
    },
    "Engagement": {
        "why": "Engagement frequency and depth are primary drivers of retention for sticky products.",
        "move": [
            "Surface high-value actions and saved views",
            "Personalized recommendations or recently-used",
            "Reduce latency; prefetch to keep UI snappy"
        ],
        "measure": [
            "Events: session_start, core_action",
            "SQL: sessions_per_WAU, core_action_users / WAU"
        ],
        "counter": "Low-quality activity (spam/accidental clicks)",
        "owner_suggestions": ["Eng PM", "Recommendations Eng"],
        "team_actions": {
            "this_week": ["Identify top 3 core actions", "Add recent items module"],
            "this_quarter": ["Ship recs v1", "Performance budget & prefetching"]
        }
    },
    "Retention": {
        "why": "Retention compounds value; it directly sustains the North Star.",
        "move": [
            "Lifecycle messaging (win-back, reminders)",
            "Quality improvements for core workflows",
            "Address recurring friction via support analysis"
        ],
        "measure": [
            "SQL: retained_7d / active_7d, retained_28d / active_28d",
            "Cohorts by first feature used"
        ],
        "counter": "Short-term boosts that degrade long-term retention",
        "owner_suggestions": ["Lifecycle Marketing", "Core UX Lead"],
        "team_actions": {
            "this_week": ["Define win-back triggers", "Add 7/28d cohort chart"],
            "this_quarter": ["Funnel analysis -> fix top 2 drop-offs"]
        }
    },
    "Referral": {
        "why": "Referrals lower CAC and signal product-market fit.",
        "move": [
            "Simple share/invite flows with clear benefits",
            "Incentives with guardrails to avoid abuse",
            "Seed viral loops near aha-moments"
        ],
        "measure": [
            "SQL: referral_signups / WAU",
            "K-factor decomposition"
        ],
        "counter": "Incentive gaming / invite spam",
        "owner_suggestions": ["Growth PM", "Lifecycle Marketing"],
        "team_actions": {
            "this_week": ["Add clear invite CTA near aha"],
            "this_quarter": ["Design referral incentive with fraud checks"]
        }
    },
    "Revenue": {
        "why": "Monetization quality (ARPU/ARPA) aligns economics with engagement.",
        "move": [
            "Right-sized plans and usage-based pricing",
            "Unblock paywalls after aha-moment",
            "Reduce failed payments; dunning flows"
        ],
        "measure": [
            "SQL: revenue / actives (ARPU), MRR, expansion rate",
            "Trial→paid conversion"
        ],
        "counter": "Revenue over-optimization harming UX",
        "owner_suggestions": ["Monetization PM", "Billing Eng"],
        "team_actions": {
            "this_week": ["Identify paywall placement post-aha"],
            "this_quarter": ["Ship dunning and failed payment retries"]
        }
    },
}

def map_stage(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ["activation", "ftux"]):
        return "Activation"
    if any(k in n for k in ["retention", "retained"]):
        return "Retention"
    if any(k in n for k in ["referral", "invite"]):
        return "Referral"
    if any(k in n for k in ["revenue", "arpu", "paid", "conversion"]):
        return "Revenue"
    return "Engagement"

def explain_node(node_name: str, parent_name: str | None = None) -> Dict[str, Any]:
    stage = map_stage(node_name)
    base = TEMPLATES[stage]
    why = base["why"]
    if parent_name:
        why = why + f" It influences '{parent_name}'."
    return {
        "node": node_name,
        "stage": stage,
        "why_it_matters": why,
        "how_to_move": base["move"],
        "how_to_measure": base["measure"],
        "counter_metric": base["counter"],
        "owner_suggestions": base.get("owner_suggestions", []),
        "team_actions": base.get("team_actions", {}),
    }
