from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Tuple
import numpy as np

router = APIRouter(prefix="/elasticities", tags=["elasticities"])

class ElasticityRequest(BaseModel):
    parent: List[float] = Field(..., description="Time series of parent metric deltas (y). Length n.")
    children: Dict[str, List[float]] = Field(..., description="Map child_name -> time series (x_i). Each length n.")
    add_intercept: bool = Field(default=False)
    non_negative: bool = Field(default=True)
    normalize: bool = Field(default=True)
    ci: bool = Field(default=True)

class ElasticityResponse(BaseModel):
    weights: Dict[str, float]
    ci95: Optional[Dict[str, Tuple[float, float]]] = None
    r2: float
    n: int
    notes: Optional[str] = None

def _ols(y: np.ndarray, X: np.ndarray):
    beta, residuals, rank, s = np.linalg.lstsq(X, y, rcond=None)
    n, p = X.shape
    if residuals.size == 0:
        resid = y - X @ beta
        sse = float((resid ** 2).sum())
    else:
        sse = float(residuals[0])
    dof = max(n - p, 1)
    sigma2 = sse / dof
    XtX = X.T @ X
    try:
        XtX_inv = np.linalg.inv(XtX)
    except np.linalg.LinAlgError:
        XtX_inv = np.linalg.pinv(XtX)
    cov = sigma2 * XtX_inv
    return beta, sse, dof, sigma2, cov

@router.post("/estimate", response_model=ElasticityResponse)
def estimate(body: ElasticityRequest):
    y = np.array(body.parent, dtype=float).reshape(-1, 1)
    names = list(body.children.keys())
    if not names:
        raise HTTPException(status_code=400, detail="children cannot be empty")
    n = len(body.parent)
    X_cols = []
    for k in names:
        x = np.array(body.children[k], dtype=float).reshape(-1)
        if x.shape[0] != n:
            raise HTTPException(status_code=400, detail=f"Length mismatch for child '{k}': expected {n}, got {x.shape[0]}")
        X_cols.append(x)
    X = np.column_stack(X_cols)
    if body.add_intercept:
        X = np.column_stack([np.ones(n), X])

    beta, sse, dof, sigma2, cov = _ols(y.ravel(), X)
    y_bar = float(np.mean(y))
    sst = float(((y - y_bar) ** 2).sum())
    r2 = 0.0 if sst <= 1e-12 else (1.0 - sse / sst)

    offset = 1 if body.add_intercept else 0
    raw = beta[offset:].copy()

    ci_dict = None
    if body.ci:
        se = np.sqrt(np.maximum(np.diag(cov), 0.0))
        se_children = se[offset:]
        z = 1.96
        lo = raw - z * se_children
        hi = raw + z * se_children
        ci_dict = {names[i]: (float(lo[i]), float(hi[i])) for i in range(len(names))}

    weights = raw.copy()
    notes = []
    if body.non_negative:
        if (weights < 0).sum():
            notes.append("Clamped negative weights to 0.")
        weights = np.maximum(weights, 0.0)
    if body.normalize:
        s = float(weights.sum())
        if s <= 1e-12:
            notes.append("All weights ~0; using equal weights.")
            weights[:] = 1.0 / len(weights)
        else:
            weights /= s

    out = {names[i]: float(weights[i]) for i in range(len(names))}
    return ElasticityResponse(weights=out, ci95=ci_dict, r2=float(r2), n=int(n), notes=" ".join(notes) or None)
