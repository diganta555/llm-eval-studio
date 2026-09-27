import io
import csv
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import EvaluationRun, CaseResult, MetricResult
from app.services.aggregation_service import aggregate_run_results

router = APIRouter(tags=["exports"])

@router.get("/runs/{run_id}/export")
def export_run_results(
    run_id: str,
    format: str = Query("csv", pattern="^(csv|json)$"),
    db: Session = Depends(get_db)
):
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    cases = db.query(CaseResult).filter(CaseResult.run_id == run_id).all()
    
    if format == "json":
        summary = aggregate_run_results(db=db, run_id=run_id)
        case_items = []
        for c in cases:
            tc = c.test_case
            case_items.append({
                "case_id": c.id,
                "external_id": tc.external_id if tc else "",
                "question": tc.question if tc else "",
                "expected_answer": tc.expected_answer if tc else None,
                "context": tc.context if tc else None,
                "status": c.status,
                "output_text": c.output_text,
                "latency_ms": c.latency_ms,
                "tokens": {
                    "prompt": c.prompt_tokens,
                    "completion": c.completion_tokens,
                    "total": c.total_tokens
                },
                "metrics": {
                    m.metric_name: {
                        "score": m.score,
                        "passed": m.passed,
                        "reason": m.reason,
                        "rubric_version": m.rubric_version
                    } for m in c.metric_results
                }
            })

        export_data = {
            "summary": summary.model_dump(mode="json") if summary else {},
            "configuration": run.configuration_snapshot or {},
            "results": case_items
        }

        content = json.dumps(export_data, indent=2, default=str)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=run_{run_id}.json"}
        )

    # CSV Format
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    headers = [
        "external_id", "question", "expected_answer", "model_output",
        "status", "latency_ms", "prompt_tokens", "completion_tokens", "total_tokens",
        "correctness_score", "relevance_score", "faithfulness_score", "hallucination_score",
        "error_message"
    ]
    writer.writerow(headers)

    for c in cases:
        tc = c.test_case
        scores = {m.metric_name: m.score for m in c.metric_results}
        row = [
            tc.external_id if tc else "",
            tc.question if tc else "",
            tc.expected_answer if tc and tc.expected_answer else "",
            c.output_text or "",
            c.status,
            c.latency_ms,
            c.prompt_tokens or "",
            c.completion_tokens or "",
            c.total_tokens or "",
            scores.get("correctness", ""),
            scores.get("relevance", ""),
            scores.get("faithfulness", ""),
            scores.get("hallucination", ""),
            c.error_message or ""
        ]
        writer.writerow(row)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=run_{run_id}.csv"}
    )
