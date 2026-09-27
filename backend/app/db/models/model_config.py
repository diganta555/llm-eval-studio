import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class ModelConfig(Base):
    __tablename__ = "model_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="openai")  # openai, mock
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, default="gpt-4o-mini")
    parameters: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)  # temperature, max_tokens, etc.
    secret_reference: Mapped[str] = mapped_column(String(100), nullable=True)  # Name of env var (e.g. OPENAI_API_KEY)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    # Relationships
    project = relationship("Project", back_populates="model_configs")
    runs = relationship("EvaluationRun", back_populates="model_config")
