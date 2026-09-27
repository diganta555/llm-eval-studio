from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class PromptVersionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    system_prompt: str = Field(default="You are a helpful, accurate, and concise AI assistant.", max_length=10000)
    user_template: str = Field(default="{question}", max_length=10000)

class PromptVersionCreate(PromptVersionBase):
    pass

class PromptVersionResponse(PromptVersionBase):
    id: str
    project_id: str
    version: int
    created_at: datetime

    class Config:
        from_attributes = True
