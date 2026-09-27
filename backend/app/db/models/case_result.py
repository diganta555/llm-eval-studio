import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class CaseResult(Base):
    __tablename__ = "case_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("evaluation_runs.id", ondelete="CASCADE"), nullable=False)
    test_case_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)

    status: Mapped[str] = mapped_column(String(50), default="running", nullable=False)  # running, completed, failed
    input_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)  # question, expected_answer, context, rendered_prompt
    output_text: Mapped[str] = mapped_column(Text, nullable=True)

    provider_request_id: Mapped[str] = mapped_column(String(100), nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    finished_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    error_code: Mapped[str] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    run = relationship("EvaluationRun", back_populates="case_results")
    test_case = relationship("TestCase", back_populates="case_results")
    metric_results = relationship("MetricResult", back_populates="case_result", cascade="all, delete-orphan")
    human_reviews = relationship("HumanReview", back_populates="case_result", cascade="all, delete-orphan")
