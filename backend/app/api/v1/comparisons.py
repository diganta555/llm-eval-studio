from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.comparison import ComparisonRequest, RunComparisonResponse
from app.services.run_service import compare_evaluation_runs

router = APIRouter(prefix="/comparisons", tags=["comparisons"])

@router.post("", response_model=RunComparisonResponse)
def compare_runs(data: ComparisonRequest, db: Session = Depends(get_db)):
    if len(data.run_ids) < 2:
        raise HTTPException(status_code=400, detail="Must provide at least two run IDs to compare.")
    try:
        comparison = compare_evaluation_runs(
            db=db,
            run_a_id=data.run_ids[0],
            run_b_id=data.run_ids[1]
        )
        return comparison
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
