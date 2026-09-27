import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Dataset, TestCase, Project
from app.schemas.dataset import (
    DatasetCreate, DatasetResponse, DatasetDetailResponse, TestCaseResponse,
    DatasetImportPreview, DatasetRowValidationError
)
from app.services.dataset_service import (
    parse_and_validate_dataset_content, create_dataset_version
)

router = APIRouter(tags=["datasets"])

@router.post("/datasets/preview", response_model=DatasetImportPreview)
async def preview_dataset(
    file: Optional[UploadFile] = File(None),
    raw_content: Optional[str] = Form(None),
    file_type: str = Form("json")
):
    content = ""
    if file:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8", errors="ignore")
        if file.filename.endswith(".csv"):
            file_type = "csv"
    elif raw_content:
        content = raw_content
    else:
        raise HTTPException(status_code=400, detail="Must provide either a file upload or raw_content.")

    valid_cases, errors = parse_and_validate_dataset_content(content, file_type)
    return DatasetImportPreview(
        total_rows=len(valid_cases) + len(errors),
        valid_rows=len(valid_cases),
        invalid_rows=len(errors),
        preview_cases=valid_cases[:10],
        validation_errors=errors
    )

@router.post("/projects/{project_id}/datasets", response_model=DatasetResponse, status_code=201)
def create_dataset_for_project(
    project_id: str,
    data: DatasetCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset = create_dataset_version(
        db=db,
        project_id=project_id,
        name=data.name,
        test_cases=data.test_cases,
        source_filename=data.source_filename
    )
    return DatasetResponse(
        id=dataset.id,
        project_id=dataset.project_id,
        name=dataset.name,
        version=dataset.version,
        test_case_count=len(data.test_cases),
        source_filename=dataset.source_filename,
        created_at=dataset.created_at
    )

@router.post("/projects/{project_id}/datasets/upload", response_model=DatasetResponse, status_code=201)
async def upload_dataset_file(
    project_id: str,
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content_bytes = await file.read()
    content = content_bytes.decode("utf-8", errors="ignore")
    file_type = "csv" if file.filename.endswith(".csv") else "json"

    valid_cases, errors = parse_and_validate_dataset_content(content, file_type)
    if not valid_cases:
        err_msg = "; ".join(e.error for e in errors[:3]) or "No valid test cases found in file."
        raise HTTPException(status_code=400, detail=f"Validation failed: {err_msg}")

    dataset = create_dataset_version(
        db=db,
        project_id=project_id,
        name=name,
        test_cases=valid_cases,
        source_filename=file.filename
    )
    return DatasetResponse(
        id=dataset.id,
        project_id=dataset.project_id,
        name=dataset.name,
        version=dataset.version,
        test_case_count=len(valid_cases),
        source_filename=dataset.source_filename,
        created_at=dataset.created_at
    )

@router.post("/projects/{project_id}/datasets/seed-demo", response_model=DatasetResponse, status_code=201)
def seed_demo_dataset(project_id: str, db: Session = Depends(get_db)):
    """Convenience endpoint to load sample-data/demo_dataset.json into the project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    sample_path = os.path.join(os.path.dirname(__file__), "../../../sample-data/demo_dataset.json")
    if not os.path.exists(sample_path):
        sample_path = "/home/atnagid/Documents/LLM EVALS/sample-data/demo_dataset.json"

    if not os.path.exists(sample_path):
        raise HTTPException(status_code=404, detail="Sample dataset file not found on disk.")

    with open(sample_path, "r", encoding="utf-8") as f:
        content = f.read()

    valid_cases, _ = parse_and_validate_dataset_content(content, "json")
    dataset = create_dataset_version(
        db=db,
        project_id=project_id,
        name="Demo Knowledge & Reasoning Benchmark",
        test_cases=valid_cases,
        source_filename="demo_dataset.json"
    )
    return DatasetResponse(
        id=dataset.id,
        project_id=dataset.project_id,
        name=dataset.name,
        version=dataset.version,
        test_case_count=len(valid_cases),
        source_filename=dataset.source_filename,
        created_at=dataset.created_at
    )

@router.get("/projects/{project_id}/datasets", response_model=List[DatasetResponse])
def list_datasets_for_project(project_id: str, db: Session = Depends(get_db)):
    datasets = (
        db.query(Dataset)
        .filter(Dataset.project_id == project_id)
        .order_by(Dataset.name.asc(), Dataset.version.desc())
        .all()
    )
    results = []
    for d in datasets:
        count = db.query(TestCase).filter(TestCase.dataset_id == d.id).count()
        results.append(DatasetResponse(
            id=d.id,
            project_id=d.project_id,
            name=d.name,
            version=d.version,
            test_case_count=count,
            source_filename=d.source_filename,
            created_at=d.created_at
        ))
    return results

@router.get("/datasets/{id}", response_model=DatasetDetailResponse)
def get_dataset_detail(id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    cases = (
        db.query(TestCase)
        .filter(TestCase.dataset_id == id)
        .order_by(TestCase.created_at.asc())
        .all()
    )
    return DatasetDetailResponse(
        id=dataset.id,
        project_id=dataset.project_id,
        name=dataset.name,
        version=dataset.version,
        test_case_count=len(cases),
        source_filename=dataset.source_filename,
        created_at=dataset.created_at,
        test_cases=[TestCaseResponse.model_validate(c) for c in cases]
    )

@router.get("/datasets/{id}/cases", response_model=List[TestCaseResponse])
def get_dataset_cases(id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    cases = (
        db.query(TestCase)
        .filter(TestCase.dataset_id == id)
        .order_by(TestCase.created_at.asc())
        .all()
    )
    return [TestCaseResponse.model_validate(c) for c in cases]
