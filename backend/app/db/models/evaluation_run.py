import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id: Mapped[str] = mapped_column(String(36), ForeignKey("datasets.id", ondelete="RESTRICT"), nullable=False)
    model_config_id: Mapped[str] = mapped_column(String(36), ForeignKey("model_configs.id", ondelete="RESTRICT"), nullable=False)
    prompt_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("prompt_versions.id", ondelete="SET NULL"), nullable=True)

    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    total_cases: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_cases: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_cases: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Snapshot of configuration at the moment of evaluation
    configuration_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    error_summary: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    # Relationships
    project = relationship("Project", back_populates="runs")
    dataset = relationship("Dataset", back_populates="runs")
    model_config = relationship("ModelConfig", back_populates="runs")
    prompt_version = relationship("PromptVersion", back_populates="runs")
    case_results = relationship("CaseResult", back_populates="run", cascade="all, delete-orphan")
