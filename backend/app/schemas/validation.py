from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# --- Validation Case Schemas ---

class ExpectedLabel(BaseModel):
    """Expected metric label for a validation case."""
    passed: Optional[bool] = None  # Expected pass/fail verdict
    score: Optional[float] = None  # Expected score (if applicable)


class ValidationCaseCreate(BaseModel):
    """Schema to create or import a validation case."""
    question: str = Field(..., min_length=1, max_length=10000)
    reference_answer: Optional[str] = Field(default=None, max_length=10000)
    reference_context: Optional[str] = Field(default=None, max_length=30000)
    model_answer: str = Field(..., min_length=0, max_length=10000)
    expected_labels: Dict[str, ExpectedLabel] = Field(default_factory=dict)
    review_status: str = Field(default="provisional", pattern="^(provisional|reviewed|disputed)$")
    reviewer_notes: Optional[str] = Field(default=None, max_length=5000)
    category: Optional[str] = Field(default="general", max_length=100)


class ValidationCaseResponse(BaseModel):
    id: str
    dataset_id: str
    question: str
    reference_answer: Optional[str] = None
    reference_context: Optional[str] = None
    model_answer: str
    expected_labels: Dict[str, Any] = {}
    review_status: str
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    category: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ValidationCaseUpdate(BaseModel):
    """Schema to update a validation case's expected labels or review status."""
    expected_labels: Optional[Dict[str, ExpectedLabel]] = None
    review_status: Optional[str] = Field(default=None, pattern="^(provisional|reviewed|disputed)$")
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None


# --- Validation Dataset Schemas ---

class ValidationDatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default="", max_length=2000)
    cases: List[ValidationCaseCreate] = Field(default_factory=list)


class ValidationDatasetResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    version: int
    case_count: int = 0
    reviewed_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class ValidationDatasetDetailResponse(ValidationDatasetResponse):
    cases: List[ValidationCaseResponse] = []


# --- Validation Run Schemas ---

class ValidationRunRequest(BaseModel):
    """Request to start a validation run."""
    dataset_id: str
    include_unreviewed: bool = Field(default=False, description="Include provisional (unreviewed) cases in accuracy calculations")
    force_mock: bool = Field(default=True, description="Use mock judge for deterministic results")


class MetricValidationResult(BaseModel):
    """Per-metric validation results with strict separation of verified vs provisional data."""
    metric_name: str

    # Verified (strictly human-reviewed ground truth)
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    mae: Optional[float] = None  # Mean Absolute Error for continuous scores
    reviewed_count: int = 0
    reviewed_sample_count: int = 0
    true_positives: int = 0
    false_positives: int = 0
    true_negatives: int = 0
    false_negatives: int = 0

    # Total sample stats & status
    sample_count: int = 0
    provisional_count: int = 0
    na_count: int = 0
    sample_size_explanation: str = ""
    status: str = "pending"  # pending | provisional | insufficient_data | validated | needs_calibration
    status_notice: str = ""

    # Provisional metrics (shown separately when unreviewed cases are evaluated)
    provisional_accuracy: Optional[float] = None
    provisional_precision: Optional[float] = None
    provisional_recall: Optional[float] = None
    provisional_f1_score: Optional[float] = None
    provisional_mae: Optional[float] = None
    provisional_true_positives: int = 0
    provisional_false_positives: int = 0
    provisional_true_negatives: int = 0
    provisional_false_negatives: int = 0
    provisional_sample_count: int = 0


class ValidationCaseResultItem(BaseModel):
    """Result for an individual case in a validation run."""
    case_id: str
    question: str
    reference_answer: Optional[str] = None
    reference_context: Optional[str] = None
    model_answer: str
    metric: str
    expected_pass: Optional[bool] = None
    expected_score: Optional[float] = None
    predicted_pass: Optional[bool] = None
    predicted_score: Optional[float] = None
    predicted_reason: str = ""
    agreement: Optional[bool] = None  # Whether expected and predicted match
    score_error: Optional[float] = None  # Difference between expected and predicted score
    review_status: str = "provisional"
    is_reviewed: bool = False
    explanation: str = ""
    category: Optional[str] = None


class ValidationRunResponse(BaseModel):
    id: str
    dataset_id: str
    project_id: str
    status: str
    total_cases: int
    reviewed_cases: int
    include_unreviewed: bool
    results_summary: Dict[str, Any] = {}
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ValidationRunDetailResponse(ValidationRunResponse):
    """Full detail view of a validation run including per-case results."""
    case_results: List[ValidationCaseResultItem] = []
    metric_results: List[MetricValidationResult] = []
