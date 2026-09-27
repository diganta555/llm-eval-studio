from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class ModelConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider: str = Field(default="openai", pattern="^(openai|anthropic|claude|mock)$")
    model_name: str = Field(default="gpt-4o-mini", min_length=1, max_length=100)
    parameters: Dict[str, Any] = Field(default_factory=lambda: {
        "temperature": 0.0,
        "max_tokens": 1000,
        "top_p": 1.0,
    })
    secret_reference: Optional[str] = Field(default="OPENAI_API_KEY", max_length=100)

class ModelConfigCreate(ModelConfigBase):
    pass

class ModelConfigResponse(ModelConfigBase):
    id: str
    project_id: str
    has_api_key: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class ModelConnectionTestRequest(BaseModel):
    provider: str = "openai"
    model_name: str = "gpt-4o-mini"
    api_key: Optional[str] = None

class ModelConnectionTestResponse(BaseModel):
    success: bool
    latency_ms: float
    message: str
    sample_response: Optional[str] = None
