from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class MetricResultResponse(BaseModel):
    id: str
    case_result_id: str
    metric_name: str
    score: Optional[float] = None
    score_scale_min: float = 0.0
    score_scale_max: float = 100.0
    passed: Optional[bool] = None
    reason: Optional[str] = None
    evaluator_type: str = "llm_judge"
    evaluator_model: Optional[str] = None
    rubric_version: str = "1.0"
    raw_output: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class HumanReviewCreate(BaseModel):
    reviewer_id: str = Field(default="local_evaluator", max_length=100)
    metric_name: Optional[str] = Field(default=None, max_length=50)
    human_score: float = Field(..., ge=0.0, le=100.0)
    comment: Optional[str] = Field(default="", max_length=2000)

class HumanReviewResponse(HumanReviewCreate):
    id: str
    case_result_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class CaseResultResponse(BaseModel):
    id: str
    run_id: str
    test_case_id: str
    status: str
    external_id: Optional[str] = None
    question: Optional[str] = None
    category: Optional[str] = None
    output_text: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    latency_ms: float = 0.0
    started_at: datetime
    finished_at: Optional[datetime] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    metric_results: List[MetricResultResponse] = []
    human_reviews: List[HumanReviewResponse] = []

    class Config:
        from_attributes = True

class CaseResultDetailResponse(CaseResultResponse):
    input_snapshot: Dict[str, Any] = {}
