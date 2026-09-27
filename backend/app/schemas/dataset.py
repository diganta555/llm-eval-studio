from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class TestCaseBase(BaseModel):
    external_id: str = Field(..., min_length=1, max_length=100)
    question: str = Field(..., min_length=1, max_length=10000)
    expected_answer: Optional[str] = Field(default=None, max_length=10000)
    context: Optional[str] = Field(default=None, max_length=30000)
    category: Optional[str] = Field(default="general", max_length=100)
    case_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    enabled: bool = True

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseResponse(TestCaseBase):
    id: str
    dataset_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class DatasetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    source_filename: Optional[str] = Field(default=None, max_length=255)

class DatasetCreate(DatasetBase):
    test_cases: List[TestCaseCreate] = Field(..., min_length=1)

class DatasetResponse(DatasetBase):
    id: str
    project_id: str
    version: int
    test_case_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class DatasetDetailResponse(DatasetResponse):
    test_cases: List[TestCaseResponse] = []

class DatasetRowValidationError(BaseModel):
    row_index: int
    external_id: Optional[str] = None
    error: str

class DatasetImportPreview(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    preview_cases: List[TestCaseCreate]
    validation_errors: List[DatasetRowValidationError]
