from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ComparisonRequest(BaseModel):
    run_ids: List[str] = Field(..., min_length=2, max_length=5)

class MetricComparison(BaseModel):
    metric_name: str
    run_a_score: Optional[float] = None
    run_b_score: Optional[float] = None
    delta: Optional[float] = None
    delta_percent: Optional[float] = None
    improved: Optional[bool] = None

class CaseComparisonRow(BaseModel):
    test_case_id: str
    external_id: str
    question: str
    run_a_output: Optional[str] = None
    run_b_output: Optional[str] = None
    run_a_latency_ms: float = 0.0
    run_b_latency_ms: float = 0.0
    run_a_tokens: Optional[int] = None
    run_b_tokens: Optional[int] = None
    metric_scores_a: Dict[str, Optional[float]] = {}
    metric_scores_b: Dict[str, Optional[float]] = {}
    regressed: bool = False
    improved: bool = False

class RunComparisonResponse(BaseModel):
    run_a_id: str
    run_b_id: str
    compatible: bool
    compatibility_reason: Optional[str] = None
    
    run_a_model: str
    run_b_model: str
    dataset_name: str
    dataset_version: int
    
    # High-level metric comparisons
    metrics: List[MetricComparison] = []
    
    # Latency comparison
    mean_latency_a_ms: float = 0.0
    mean_latency_b_ms: float = 0.0
    latency_delta_ms: float = 0.0
    
    # Token comparison
    total_tokens_a: int = 0
    total_tokens_b: int = 0
    token_delta: int = 0
    
    # Detailed case comparisons
    cases: List[CaseComparisonRow] = []
