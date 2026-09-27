from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class RunCreate(BaseModel):
    project_id: str
    dataset_id: str
    model_config_id: str
    prompt_version_id: Optional[str] = None
    metrics: List[str] = Field(default=["correctness", "relevance", "faithfulness", "hallucination"])
    max_concurrency: int = Field(default=2, ge=1, le=10)

class RunStatusResponse(BaseModel):
    run_id: str
    status: str
    total_cases: int
    completed_cases: int
    failed_cases: int
    progress_percent: float
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_summary: Optional[str] = None

class MetricSummary(BaseModel):
    metric_name: str
    average_score: Optional[float] = None
    min_score: Optional[float] = None
    max_score: Optional[float] = None
    evaluated_count: int = 0
    not_applicable_count: int = 0
    passed_count: int = 0
    pass_rate: float = 0.0

class RunSummaryResponse(BaseModel):
    run_id: str
    project_id: str
    dataset_id: str
    dataset_name: Optional[str] = None
    dataset_version: Optional[int] = None
    model_config_id: str
    model_name: Optional[str] = None
    provider: Optional[str] = None
    prompt_version_id: Optional[str] = None
    prompt_name: Optional[str] = None
    status: str
    total_cases: int
    completed_cases: int
    failed_cases: int
    progress_percent: float
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    
    # Latency aggregates
    mean_latency_ms: float = 0.0
    median_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    
    # Token aggregates
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0
    avg_tokens_per_case: float = 0.0
    
    # Metrics
    metrics_summary: List[MetricSummary] = []
    
    configuration_snapshot: Dict[str, Any] = {}
    error_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RunListResponse(BaseModel):
    id: str
    project_id: str
    dataset_name: str
    dataset_version: int
    model_name: str
    provider: str
    status: str
    total_cases: int
    completed_cases: int
    failed_cases: int
    avg_correctness: Optional[float] = None
    avg_relevance: Optional[float] = None
    avg_faithfulness: Optional[float] = None
    avg_hallucination: Optional[float] = None
    mean_latency_ms: float = 0.0
    total_tokens: int = 0
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
