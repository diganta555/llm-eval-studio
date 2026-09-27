"""
Ground Truth Validation API
============================
Endpoints for managing validation datasets, cases, running validation,
and retrieving validation history.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.validation_case import ValidationDataset, ValidationCase, ValidationRun
from app.schemas.validation import (
    ValidationDatasetCreate,
    ValidationDatasetResponse,
    ValidationDatasetDetailResponse,
    ValidationCaseResponse,
    ValidationCaseUpdate,
    ValidationRunRequest,
    ValidationRunResponse,
    ValidationRunDetailResponse,
    MetricValidationResult,
    ValidationCaseResultItem,
)
from app.services.validation_service import (
    create_validation_dataset,
    get_validation_datasets,
    get_validation_dataset_detail,
    update_validation_case,
    delete_validation_dataset,
    run_validation,
    get_validation_runs,
    get_validation_run_detail,
    seed_sample_validation_dataset,
)

router = APIRouter(prefix="/validation", tags=["Ground Truth Validation"])


# ---------------------------------------------------------------------------
# Dataset endpoints
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/datasets", response_model=List[ValidationDatasetResponse])
def list_validation_datasets(project_id: str, db: Session = Depends(get_db)):
    """List all validation datasets for a project."""
    datasets = get_validation_datasets(db, project_id)
    result = []
    for ds in datasets:
        cases = db.query(ValidationCase).filter(ValidationCase.dataset_id == ds.id).all()
        reviewed = sum(1 for c in cases if c.review_status == "reviewed")
        result.append(ValidationDatasetResponse(
            id=ds.id,
            project_id=ds.project_id,
            name=ds.name,
            description=ds.description,
            version=ds.version,
            case_count=len(cases),
            reviewed_count=reviewed,
            created_at=ds.created_at,
        ))
    return result


@router.post("/projects/{project_id}/datasets", response_model=ValidationDatasetResponse)
def create_dataset(project_id: str, payload: ValidationDatasetCreate, db: Session = Depends(get_db)):
    """Create a new validation dataset with optional cases."""
    ds = create_validation_dataset(
        db=db,
        project_id=project_id,
        name=payload.name,
        description=payload.description or "",
        cases=payload.cases,
    )
    cases = db.query(ValidationCase).filter(ValidationCase.dataset_id == ds.id).all()
    reviewed = sum(1 for c in cases if c.review_status == "reviewed")
    return ValidationDatasetResponse(
        id=ds.id,
        project_id=ds.project_id,
        name=ds.name,
        description=ds.description,
        version=ds.version,
        case_count=len(cases),
        reviewed_count=reviewed,
        created_at=ds.created_at,
    )


@router.post("/projects/{project_id}/datasets/seed-sample", response_model=ValidationDatasetResponse)
def seed_sample_dataset(project_id: str, db: Session = Depends(get_db)):
    """Seed a sample validation dataset with 30 provisional cases."""
    ds = seed_sample_validation_dataset(db=db, project_id=project_id)
    cases = db.query(ValidationCase).filter(ValidationCase.dataset_id == ds.id).all()
    reviewed = sum(1 for c in cases if c.review_status == "reviewed")
    return ValidationDatasetResponse(
        id=ds.id,
        project_id=ds.project_id,
        name=ds.name,
        description=ds.description,
        version=ds.version,
        case_count=len(cases),
        reviewed_count=reviewed,
        created_at=ds.created_at,
    )


@router.get("/datasets/{dataset_id}", response_model=ValidationDatasetDetailResponse)
def get_dataset_detail(dataset_id: str, db: Session = Depends(get_db)):
    """Get full details of a validation dataset including all cases."""
    ds = get_validation_dataset_detail(db, dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Validation dataset not found")

    cases = db.query(ValidationCase).filter(ValidationCase.dataset_id == ds.id).all()
    reviewed = sum(1 for c in cases if c.review_status == "reviewed")
    return ValidationDatasetDetailResponse(
        id=ds.id,
        project_id=ds.project_id,
        name=ds.name,
        description=ds.description,
        version=ds.version,
        case_count=len(cases),
        reviewed_count=reviewed,
        created_at=ds.created_at,
        cases=[ValidationCaseResponse(
            id=c.id,
            dataset_id=c.dataset_id,
            question=c.question,
            reference_answer=c.reference_answer,
            reference_context=c.reference_context,
            model_answer=c.model_answer,
            expected_labels=c.expected_labels or {},
            review_status=c.review_status,
            reviewer_notes=c.reviewer_notes,
            reviewed_by=c.reviewed_by,
            reviewed_at=c.reviewed_at,
            category=c.category,
            created_at=c.created_at,
        ) for c in cases],
    )


@router.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Delete a validation dataset and all its cases."""
    if not delete_validation_dataset(db, dataset_id):
        raise HTTPException(status_code=404, detail="Validation dataset not found")
    return {"success": True, "message": "Validation dataset deleted"}


# ---------------------------------------------------------------------------
# Case endpoints
# ---------------------------------------------------------------------------

@router.put("/cases/{case_id}", response_model=ValidationCaseResponse)
def update_case(case_id: str, payload: ValidationCaseUpdate, db: Session = Depends(get_db)):
    """Update a validation case's expected labels or review status."""
    labels = None
    if payload.expected_labels:
        labels = {k: v.model_dump() for k, v in payload.expected_labels.items()}

    case = update_validation_case(
        db=db,
        case_id=case_id,
        expected_labels=labels,
        review_status=payload.review_status,
        reviewer_notes=payload.reviewer_notes,
        reviewed_by=payload.reviewed_by,
    )
    if not case:
        raise HTTPException(status_code=404, detail="Validation case not found")

    return ValidationCaseResponse(
        id=case.id,
        dataset_id=case.dataset_id,
        question=case.question,
        reference_answer=case.reference_answer,
        reference_context=case.reference_context,
        model_answer=case.model_answer,
        expected_labels=case.expected_labels or {},
        review_status=case.review_status,
        reviewer_notes=case.reviewer_notes,
        reviewed_by=case.reviewed_by,
        reviewed_at=case.reviewed_at,
        category=case.category,
        created_at=case.created_at,
    )


# ---------------------------------------------------------------------------
# Run endpoints
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/runs", response_model=ValidationRunResponse)
def start_validation_run(project_id: str, payload: ValidationRunRequest, db: Session = Depends(get_db)):
    """Start a new validation run against a dataset."""
    try:
        run = run_validation(
            db=db,
            dataset_id=payload.dataset_id,
            project_id=project_id,
            include_unreviewed=payload.include_unreviewed,
            force_mock=payload.force_mock,
        )
        return ValidationRunResponse(
            id=run.id,
            dataset_id=run.dataset_id,
            project_id=run.project_id,
            status=run.status,
            total_cases=run.total_cases,
            reviewed_cases=run.reviewed_cases,
            include_unreviewed=run.include_unreviewed,
            results_summary=run.results_summary or {},
            started_at=run.started_at,
            finished_at=run.finished_at,
            created_at=run.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation run failed: {str(e)}")


@router.get("/projects/{project_id}/runs", response_model=List[ValidationRunResponse])
def list_validation_runs(project_id: str, db: Session = Depends(get_db)):
    """List all validation runs for a project."""
    runs = get_validation_runs(db, project_id)
    return [
        ValidationRunResponse(
            id=r.id,
            dataset_id=r.dataset_id,
            project_id=r.project_id,
            status=r.status,
            total_cases=r.total_cases,
            reviewed_cases=r.reviewed_cases,
            include_unreviewed=r.include_unreviewed,
            results_summary=r.results_summary or {},
            started_at=r.started_at,
            finished_at=r.finished_at,
            created_at=r.created_at,
        )
        for r in runs
    ]


@router.get("/runs/{run_id}", response_model=ValidationRunDetailResponse)
def get_run_detail(run_id: str, db: Session = Depends(get_db)):
    """Get full details of a validation run including per-case results."""
    run = get_validation_run_detail(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Validation run not found")

    # Parse case_results from JSON
    case_results = []
    for cr_data in (run.case_results or []):
        case_results.append(ValidationCaseResultItem(**cr_data))

    # Reconstruct metric_results from results_summary
    metric_results = []
    by_metric = (run.results_summary or {}).get("by_metric", {})
    for metric_name, data in by_metric.items():
        metric_results.append(MetricValidationResult(**data))

    return ValidationRunDetailResponse(
        id=run.id,
        dataset_id=run.dataset_id,
        project_id=run.project_id,
        status=run.status,
        total_cases=run.total_cases,
        reviewed_cases=run.reviewed_cases,
        include_unreviewed=run.include_unreviewed,
        results_summary=run.results_summary or {},
        started_at=run.started_at,
        finished_at=run.finished_at,
        created_at=run.created_at,
        case_results=case_results,
        metric_results=metric_results,
    )
