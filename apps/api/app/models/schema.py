from __future__ import annotations
from pydantic import BaseModel
from typing import List, Literal, Optional

Relation = Literal["sum", "product", "ratio", "influences"]

class Node(BaseModel):
    id: str
    name: str
    type: Literal["focus", "input"]
    level: int
    formula: Optional[str] = None
    owner: Optional[str] = None
    window: Optional[str] = None
    stage: Optional[Literal["Acquisition","Activation","Engagement","Retention","Referral","Revenue"]] = None
    guardrails: Optional[list[str]] = None
    counter_metrics: Optional[list[str]] = None

class Edge(BaseModel):
    src: str
    dst: str
    relation: Relation = "influences"

class Tree(BaseModel):
    north_star: Node
    nodes: List[Node]
    edges: List[Edge]

class NSMRequest(BaseModel):
    industry: str
    product_type: str
    emphasis: dict[str, int] | None = None
    constraints: dict[str, str] | None = None

class NSMCandidate(BaseModel):
    name: str
    rationale: str
    tradeoffs: list[str]
    window: str = "7d"

class ExpandRequest(BaseModel):
    industry: str
    product_type: str
    north_star: Optional[str] = None
    emphasis: dict[str, int] | None = None
    constraints: dict[str, str] | None = None
