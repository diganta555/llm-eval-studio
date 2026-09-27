from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.db.models import (
    EvaluationRun, Dataset, ModelConfig, PromptVersion, TestCase, CaseResult, MetricResult
)
from app.schemas.run import RunCreate, RunListResponse
from app.schemas.comparison import (
    RunComparisonResponse, MetricComparison, CaseComparisonRow
)

def create_evaluation_run(
    db: Session,
    request: RunCreate
) -> EvaluationRun:
    """
    Validates references, snapshots configuration (model parameters, prompt, dataset version),
    and creates a new run with status 'queued'.
    """
    dataset = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    if not dataset:
        raise ValueError(f"Dataset with ID {request.dataset_id} does not exist.")

    model_config = db.query(ModelConfig).filter(ModelConfig.id == request.model_config_id).first()
    if not model_config:
        raise ValueError(f"ModelConfig with ID {request.model_config_id} does not exist.")

    prompt_version = None
    if request.prompt_version_id:
        prompt_version = db.query(PromptVersion).filter(PromptVersion.id == request.prompt_version_id).first()

    total_cases = (
        db.query(TestCase)
        .filter(TestCase.dataset_id == dataset.id, TestCase.enabled == True)
        .count()
    )

    if total_cases == 0:
        raise ValueError("Selected dataset contains 0 enabled test cases.")

    # Build snapshot
    snapshot = {
        "dataset_name": dataset.name,
        "dataset_version": dataset.version,
        "model_name": model_config.model_name,
        "provider": model_config.provider,
        "parameters": model_config.parameters,
        "system_prompt": prompt_version.system_prompt if prompt_version else "You are a helpful, accurate, and concise AI assistant.",
        "user_template": prompt_version.user_template if prompt_version else "{question}",
        "metrics": request.metrics,
        "max_concurrency": request.max_concurrency,
        "created_at_iso": dataset.created_at.isoformat()
    }

    run = EvaluationRun(
        project_id=request.project_id,
        dataset_id=dataset.id,
        model_config_id=model_config.id,
        prompt_version_id=prompt_version.id if prompt_version else None,
        status="queued",
        total_cases=total_cases,
        completed_cases=0,
        failed_cases=0,
        configuration_snapshot=snapshot
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run

def list_runs_for_project(db: Session, project_id: Optional[str] = None) -> List[RunListResponse]:
    query = db.query(EvaluationRun)
    if project_id:
        query = query.filter(EvaluationRun.project_id == project_id)
    runs = query.order_by(EvaluationRun.created_at.desc()).all()

    result = []
    for r in runs:
        # Calculate metric averages for quick display in list table
        cases = db.query(CaseResult).filter(CaseResult.run_id == r.id).all()
        case_ids = [c.id for c in cases]
        
        metrics = (
            db.query(MetricResult)
            .filter(MetricResult.case_result_id.in_(case_ids))
            .all()
        ) if case_ids else []

        corr = [m.score for m in metrics if m.metric_name == "correctness" and m.score is not None]
        rel = [m.score for m in metrics if m.metric_name == "relevance" and m.score is not None]
        faith = [m.score for m in metrics if m.metric_name == "faithfulness" and m.score is not None]
        hall = [m.score for m in metrics if m.metric_name == "hallucination" and m.score is not None]

        latencies = [c.latency_ms for c in cases if c.latency_ms]
        tokens = [c.total_tokens for c in cases if c.total_tokens]

        result.append(RunListResponse(
            id=r.id,
            project_id=r.project_id,
            dataset_name=r.dataset.name if r.dataset else "Dataset",
            dataset_version=r.dataset.version if r.dataset else 1,
            model_name=r.model_config.model_name if r.model_config else "Model",
            provider=r.model_config.provider if r.model_config else "openai",
            status=r.status,
            total_cases=r.total_cases,
            completed_cases=r.completed_cases,
            failed_cases=r.failed_cases,
            avg_correctness=round(sum(corr)/len(corr), 1) if corr else None,
            avg_relevance=round(sum(rel)/len(rel), 1) if rel else None,
            avg_faithfulness=round(sum(faith)/len(faith), 1) if faith else None,
            avg_hallucination=round(sum(hall)/len(hall), 1) if hall else None,
            mean_latency_ms=round(sum(latencies)/len(latencies), 1) if latencies else 0.0,
            total_tokens=sum(tokens),
            started_at=r.started_at,
            finished_at=r.finished_at,
            created_at=r.created_at
        ))

    return result

def cancel_evaluation_run(db: Session, run_id: str) -> EvaluationRun:
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        raise ValueError(f"Run {run_id} not found.")
    if run.status in ["completed", "completed_with_errors", "failed", "cancelled"]:
        return run
    run.status = "cancelled"
    db.commit()
    db.refresh(run)
    return run

def compare_evaluation_runs(db: Session, run_a_id: str, run_b_id: str) -> RunComparisonResponse:
    """
    Compares two runs, verifies compatibility, computes metric deltas,
    and returns per-case regressions and improvements.
    """
    run_a = db.query(EvaluationRun).filter(EvaluationRun.id == run_a_id).first()
    run_b = db.query(EvaluationRun).filter(EvaluationRun.id == run_b_id).first()

    if not run_a or not run_b:
        raise ValueError("One or both specified runs could not be found.")

    compatible = (run_a.dataset_id == run_b.dataset_id)
    reason = None if compatible else "Runs were executed on different datasets. Scores may not be directly comparable."

    cases_a = {c.test_case_id: c for c in db.query(CaseResult).filter(CaseResult.run_id == run_a_id).all()}
    cases_b = {c.test_case_id: c for c in db.query(CaseResult).filter(CaseResult.run_id == run_b_id).all()}

    # All unique test case IDs
    all_case_ids = list(set(cases_a.keys()) | set(cases_b.keys()))
    test_cases_map = {tc.id: tc for tc in db.query(TestCase).filter(TestCase.id.in_(all_case_ids)).all()}

    # Metrics summary calculation
    metrics_a = db.query(MetricResult).filter(MetricResult.case_result_id.in_([c.id for c in cases_a.values()])).all()
    metrics_b = db.query(MetricResult).filter(MetricResult.case_result_id.in_([c.id for c in cases_b.values()])).all()

    def get_avg(m_list, name):
        vals = [m.score for m in m_list if m.metric_name == name and m.score is not None]
        return round(sum(vals)/len(vals), 2) if vals else None

    metric_names = ["correctness", "relevance", "faithfulness", "hallucination"]
    metric_comparisons: List[MetricComparison] = []

    for m_name in metric_names:
        score_a = get_avg(metrics_a, m_name)
        score_b = get_avg(metrics_b, m_name)
        delta = None
        delta_pct = None
        improved = None

        if score_a is not None and score_b is not None:
            delta = round(score_b - score_a, 2)
            if score_a != 0:
                delta_pct = round((delta / score_a) * 100.0, 1)

            # Hallucination: lower is better!
            if m_name == "hallucination":
                improved = delta < 0
            else:
                improved = delta > 0

        metric_comparisons.append(MetricComparison(
            metric_name=m_name,
            run_a_score=score_a,
            run_b_score=score_b,
            delta=delta,
            delta_percent=delta_pct,
            improved=improved
        ))

    # Latencies
    lat_a = [c.latency_ms for c in cases_a.values() if c.latency_ms]
    lat_b = [c.latency_ms for c in cases_b.values() if c.latency_ms]
    mean_lat_a = round(sum(lat_a)/len(lat_a), 1) if lat_a else 0.0
    mean_lat_b = round(sum(lat_b)/len(lat_b), 1) if lat_b else 0.0

    tok_a = sum(c.total_tokens for c in cases_a.values() if c.total_tokens)
    tok_b = sum(c.total_tokens for c in cases_b.values() if c.total_tokens)

    # Detailed case comparisons
    case_rows: List[CaseComparisonRow] = []
    for tc_id in all_case_ids:
        tc = test_cases_map.get(tc_id)
        ca = cases_a.get(tc_id)
        cb = cases_b.get(tc_id)

        scores_a = {m.metric_name: m.score for m in (ca.metric_results if ca else [])}
        scores_b = {m.metric_name: m.score for m in (cb.metric_results if cb else [])}

        corr_a = scores_a.get("correctness")
        corr_b = scores_b.get("correctness")
        regressed = False
        improved = False
        if corr_a is not None and corr_b is not None:
            if corr_b < corr_a - 5:
                regressed = True
            elif corr_b > corr_a + 5:
                improved = True

        case_rows.append(CaseComparisonRow(
            test_case_id=tc_id,
            external_id=tc.external_id if tc else "unknown",
            question=tc.question if tc else "Unknown",
            run_a_output=ca.output_text if ca else None,
            run_b_output=cb.output_text if cb else None,
            run_a_latency_ms=ca.latency_ms if ca else 0.0,
            run_b_latency_ms=cb.latency_ms if cb else 0.0,
            run_a_tokens=ca.total_tokens if ca else None,
            run_b_tokens=cb.total_tokens if cb else None,
            metric_scores_a=scores_a,
            metric_scores_b=scores_b,
            regressed=regressed,
            improved=improved
        ))

    return RunComparisonResponse(
        run_a_id=run_a.id,
        run_b_id=run_b.id,
        compatible=compatible,
        compatibility_reason=reason,
        run_a_model=run_a.model_config.model_name if run_a.model_config else "Model A",
        run_b_model=run_b.model_config.model_name if run_b.model_config else "Model B",
        dataset_name=run_a.dataset.name if run_a.dataset else "Dataset",
        dataset_version=run_a.dataset.version if run_a.dataset else 1,
        metrics=metric_comparisons,
        mean_latency_a_ms=mean_lat_a,
        mean_latency_b_ms=mean_lat_b,
        latency_delta_ms=round(mean_lat_b - mean_lat_a, 1),
        total_tokens_a=tok_a,
        total_tokens_b=tok_b,
        token_delta=tok_b - tok_a,
        cases=case_rows
    )

def delete_evaluation_run(db: Session, run_id: str) -> bool:
    """Deletes an evaluation run and all associated results cleanly."""
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        raise ValueError(f"EvaluationRun with ID {run_id} not found.")

    case_results = db.query(CaseResult).filter(CaseResult.run_id == run_id).all()
    case_result_ids = [c.id for c in case_results]

    if case_result_ids:
        db.query(MetricResult).filter(MetricResult.case_result_id.in_(case_result_ids)).delete(synchronize_session=False)
        try:
            from app.db.models.human_review import HumanReview
            db.query(HumanReview).filter(HumanReview.case_result_id.in_(case_result_ids)).delete(synchronize_session=False)
        except Exception:
            pass

    db.query(CaseResult).filter(CaseResult.run_id == run_id).delete(synchronize_session=False)
    db.delete(run)
    db.commit()
    return True
