import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan")
    model_configs = relationship("ModelConfig", back_populates="project", cascade="all, delete-orphan")
    prompt_versions = relationship("PromptVersion", back_populates="project", cascade="all, delete-orphan")
    runs = relationship("EvaluationRun", back_populates="project", cascade="all, delete-orphan")
