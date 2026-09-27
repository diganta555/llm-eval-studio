import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ValidationDataset(Base):
    """A collection of ground-truth validation cases for measuring metric accuracy."""
    __tablename__ = "validation_datasets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True, default="")
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    # Relationships
    cases = relationship("ValidationCase", back_populates="dataset", cascade="all, delete-orphan")
    runs = relationship("ValidationRun", back_populates="dataset", cascade="all, delete-orphan")


class ValidationCase(Base):
    """
    An individual ground-truth validation case.
    Each case stores the input question, reference/model answers, and expected labels
    for each metric. Labels may be marked as provisional (not human-reviewed)
    or reviewed (human-verified).
    """
    __tablename__ = "validation_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id: Mapped[str] = mapped_column(String(36), ForeignKey("validation_datasets.id", ondelete="CASCADE"), nullable=False)

    # Input fields
    question: Mapped[str] = mapped_column(Text, nullable=False)
    reference_answer: Mapped[str] = mapped_column(Text, nullable=True)
    reference_context: Mapped[str] = mapped_column(Text, nullable=True)
    model_answer: Mapped[str] = mapped_column(Text, nullable=False)

    # Expected labels for each metric (stored as JSON dict)
    # e.g. {"correctness": {"pass": true, "score": 95.0}, "hallucination": {"pass": false, "score": 70.0}}
    expected_labels: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Human review status
    review_status: Mapped[str] = mapped_column(String(50), default="provisional", nullable=False)  # provisional | reviewed | disputed
    reviewer_notes: Mapped[str] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    category: Mapped[str] = mapped_column(String(100), nullable=True, default="general")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    # Relationships
    dataset = relationship("ValidationDataset", back_populates="cases")


class ValidationRun(Base):
    """A record of a ground-truth validation run with its aggregate results."""
    __tablename__ = "validation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id: Mapped[str] = mapped_column(String(36), ForeignKey("validation_datasets.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    status: Mapped[str] = mapped_column(String(50), default="running", nullable=False)  # running | completed | failed
    total_cases: Mapped[int] = mapped_column(default=0, nullable=False)
    reviewed_cases: Mapped[int] = mapped_column(default=0, nullable=False)
    include_unreviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Aggregate results (stored as JSON)
    # {"overall": {...}, "by_metric": {"correctness": {...}, ...}}
    results_summary: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict)

    # Per-case results (stored as JSON list)
    case_results: Mapped[list] = mapped_column(JSON, nullable=True, default=list)

    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    finished_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    # Relationships
    dataset = relationship("ValidationDataset", back_populates="runs")
