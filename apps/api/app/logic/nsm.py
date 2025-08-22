from __future__ import annotations

def suggest_nsm(industry: str, product_type: str, emphasis: dict | None = None):
    industry = industry.lower()
    ideas = []
    if "saas" in industry or "b2b" in industry:
        ideas.append({
            "name": "Weekly Active Accounts (WAA)",
            "rationale": "Captures account-level value realization; aligns with seat expansion and retention.",
            "tradeoffs": ["Lagging vs feature adoption", "May hide seat concentration"]
        })
        ideas.append({
            "name": "Time-to-First-Value < X days (cohort %)",
            "rationale": "Early activation predicts retention; actionable by onboarding.",
            "tradeoffs": ["May bias towards shallow value", "Needs strong event semantics"]
        })
    if any(k in industry for k in ["streaming","media","video"]):
        ideas.append({
            "name": "Weekly Active Subscribers (WAS)",
            "rationale": "Represents engaged, retained subscribers; pairs with minutes viewed / WAS.",
            "tradeoffs": ["Paid-only focus", "Ignores ad-supported MAU"]
        })
    if any(k in industry for k in ["marketplace","rideshare","delivery"]):
        ideas.append({
            "name": "Successful Matches / Week",
            "rationale": "Measures liquidity and matching efficacy.",
            "tradeoffs": ["Quality vs quantity tradeoff", "Cold-start issues"]
        })
    if not ideas:
        ideas.append({
            "name": "Weekly Engaged Users (WEU)",
            "rationale": "General-purpose engagement focus (≥1 meaningful interaction in 7d).",
            "tradeoffs": ["Definition must avoid vanity", "Needs stage mapping"]
        })
    if emphasis and emphasis.get("Revenue",0) > 7:
        ideas.insert(0, {
            "name": "Weekly ARPU-Adjusted Active Users",
            "rationale": "Balances activity with monetization quality.",
            "tradeoffs": ["Risk of optimizing $$ over UX", "Needs guardrails"]
        })
    return ideas[:3]
