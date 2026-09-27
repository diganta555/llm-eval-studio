from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import CaseResult, MetricResult, HumanReview, TestCase
from app.schemas.result import (
    CaseResultResponse, CaseResultDetailResponse, MetricResultResponse,
    HumanReviewCreate, HumanReviewResponse
)

router = APIRouter(prefix="/runs/{run_id}/results", tags=["results"])

@router.get("", response_model=List[CaseResultResponse])
def get_run_results(
    run_id: str,
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(CaseResult).filter(CaseResult.run_id == run_id)
    if status:
        query = query.filter(CaseResult.status == status)

    results = query.order_by(CaseResult.started_at.asc()).offset(skip).limit(limit).all()

    output = []
    for r in results:
        tc = r.test_case
        # Filter by category if requested
        if category and tc and tc.category != category:
            continue
        # Search query in question or response
        if search and tc:
            q_match = search.lower() in tc.question.lower()
            a_match = search.lower() in (r.output_text or "").lower()
            if not (q_match or a_match):
                continue

        metrics = [
            MetricResultResponse.model_validate(m) for m in r.metric_results
        ]
        reviews = [
            HumanReviewResponse.model_validate(hr) for hr in r.human_reviews
        ]

        output.append(CaseResultResponse(
            id=r.id,
            run_id=r.run_id,
            test_case_id=r.test_case_id,
            status=r.status,
            external_id=tc.external_id if tc else None,
            question=tc.question if tc else None,
            category=tc.category if tc else None,
            output_text=r.output_text,
            prompt_tokens=r.prompt_tokens,
            completion_tokens=r.completion_tokens,
            total_tokens=r.total_tokens,
            latency_ms=r.latency_ms,
            started_at=r.started_at,
            finished_at=r.finished_at,
            error_code=r.error_code,
            error_message=r.error_message,
            metric_results=metrics,
            human_reviews=reviews
        ))

    return output

@router.get("/{case_result_id}", response_model=CaseResultDetailResponse)
def get_case_result_detail(
    run_id: str,
    case_result_id: str,
    db: Session = Depends(get_db)
):
    case_result = (
        db.query(CaseResult)
        .filter(CaseResult.id == case_result_id, CaseResult.run_id == run_id)
        .first()
    )
    if not case_result:
        raise HTTPException(status_code=404, detail="Case result not found")

    tc = case_result.test_case
    metrics = [
        MetricResultResponse.model_validate(m) for m in case_result.metric_results
    ]
    reviews = [
        HumanReviewResponse.model_validate(hr) for hr in case_result.human_reviews
    ]

    return CaseResultDetailResponse(
        id=case_result.id,
        run_id=case_result.run_id,
        test_case_id=case_result.test_case_id,
        status=case_result.status,
        external_id=tc.external_id if tc else None,
        question=tc.question if tc else None,
        category=tc.category if tc else None,
        input_snapshot=case_result.input_snapshot or {},
        output_text=case_result.output_text,
        prompt_tokens=case_result.prompt_tokens,
        completion_tokens=case_result.completion_tokens,
        total_tokens=case_result.total_tokens,
        latency_ms=case_result.latency_ms,
        started_at=case_result.started_at,
        finished_at=case_result.finished_at,
        error_code=case_result.error_code,
        error_message=case_result.error_message,
        metric_results=metrics,
        human_reviews=reviews
    )

@router.post("/{case_result_id}/review", response_model=HumanReviewResponse, status_code=201)
def add_human_review(
    run_id: str,
    case_result_id: str,
    data: HumanReviewCreate,
    db: Session = Depends(get_db)
):
    case_result = (
        db.query(CaseResult)
        .filter(CaseResult.id == case_result_id, CaseResult.run_id == run_id)
        .first()
    )
    if not case_result:
        raise HTTPException(status_code=404, detail="Case result not found")

    review = HumanReview(
        case_result_id=case_result.id,
        reviewer_id=data.reviewer_id,
        metric_name=data.metric_name,
        human_score=data.human_score,
        comment=data.comment
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return HumanReviewResponse.model_validate(review)
