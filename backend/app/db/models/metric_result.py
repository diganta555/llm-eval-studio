import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class MetricResult(Base):
    __tablename__ = "metric_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_result_id: Mapped[str] = mapped_column(String(36), ForeignKey("case_results.id", ondelete="CASCADE"), nullable=False)

    metric_name: Mapped[str] = mapped_column(String(50), nullable=False)  # correctness, relevance, faithfulness, hallucination
    score: Mapped[float] = mapped_column(Float, nullable=True)  # Null if not_applicable
    score_scale_min: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    score_scale_max: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    
    evaluator_type: Mapped[str] = mapped_column(String(50), default="llm_judge")  # deterministic, llm_judge, human
    evaluator_model: Mapped[str] = mapped_column(String(100), nullable=True)
    rubric_version: Mapped[str] = mapped_column(String(50), default="1.0")
    raw_output: Mapped[dict] = mapped_column(JSON, nullable=True)  # judge rationale, claim details, evidence list
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    # Relationships
    case_result = relationship("CaseResult", back_populates="metric_results")
