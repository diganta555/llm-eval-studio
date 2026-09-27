from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.run import (
    RunCreate, RunStatusResponse, RunSummaryResponse, RunListResponse
)
from app.services.run_service import (
    create_evaluation_run, list_runs_for_project, cancel_evaluation_run, delete_evaluation_run
)
from app.services.aggregation_service import aggregate_run_results
from app.evaluation.runner import execute_evaluation_run

router = APIRouter(prefix="/runs", tags=["runs"])

@router.post("", response_model=RunStatusResponse, status_code=202)
def start_evaluation_run(
    data: RunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    try:
        run = create_evaluation_run(db=db, request=data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Trigger background execution
    background_tasks.add_task(execute_evaluation_run, run.id)

    return RunStatusResponse(
        run_id=run.id,
        status=run.status,
        total_cases=run.total_cases,
        completed_cases=0,
        failed_cases=0,
        progress_percent=0.0,
        started_at=None,
        finished_at=None
    )

@router.get("", response_model=List[RunListResponse])
def get_runs(
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return list_runs_for_project(db=db, project_id=project_id)

@router.get("/{id}", response_model=RunSummaryResponse)
def get_run_details(id: str, db: Session = Depends(get_db)):
    summary = aggregate_run_results(db=db, run_id=id)
    if not summary:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return summary

@router.delete("/{id}", status_code=200)
def delete_run(id: str, db: Session = Depends(get_db)):
    try:
        delete_evaluation_run(db=db, run_id=id)
        return {"success": True, "message": f"Run {id} deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{id}/cancel", response_model=RunStatusResponse)
def cancel_run(id: str, db: Session = Depends(get_db)):
    try:
        run = cancel_evaluation_run(db=db, run_id=id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    progress = round((run.completed_cases + run.failed_cases) / run.total_cases * 100.0, 1) if run.total_cases > 0 else 0.0
    return RunStatusResponse(
        run_id=run.id,
        status=run.status,
        total_cases=run.total_cases,
        completed_cases=run.completed_cases,
        failed_cases=run.failed_cases,
        progress_percent=progress,
        started_at=run.started_at,
        finished_at=run.finished_at,
        error_summary=run.error_summary
    )
