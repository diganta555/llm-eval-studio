import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.models import EvaluationRun, CaseResult, MetricResult
from app.schemas.run import MetricSummary, RunSummaryResponse

def calculate_percentile(values: List[float], percentile: float) -> float:
    """Calculates nearest-rank or linear interpolation percentile."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    d0 = sorted_vals[int(f)] * (c - k)
    d1 = sorted_vals[int(c)] * (k - f)
    return round(d0 + d1, 2)

def aggregate_run_results(db: Session, run_id: str) -> Optional[RunSummaryResponse]:
    """
    Computes all run-level aggregations conforming to Section 12 rules:
    - Excludes not_applicable from score denominators
    - Accurate p50/p95 latency
    - Token tracking and failure counts
    """
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        return None

    cases = (
        db.query(CaseResult)
        .filter(CaseResult.run_id == run_id)
        .all()
    )

    total_cases = run.total_cases or len(cases)
    completed_cases = sum(1 for c in cases if c.status == "completed")
    failed_cases = sum(1 for c in cases if c.status == "failed")

    # Latencies of cases
    latencies = [c.latency_ms for c in cases if c.latency_ms is not None and c.latency_ms > 0]
    mean_latency = round(sum(latencies) / len(latencies), 2) if latencies else 0.0
    median_latency = calculate_percentile(latencies, 50.0)
    p95_latency = calculate_percentile(latencies, 95.0)

    # Token aggregates
    prompt_tokens_list = [c.prompt_tokens for c in cases if c.prompt_tokens is not None]
    completion_tokens_list = [c.completion_tokens for c in cases if c.completion_tokens is not None]
    total_tokens_list = [c.total_tokens for c in cases if c.total_tokens is not None]

    total_prompt_tokens = sum(prompt_tokens_list)
    total_completion_tokens = sum(completion_tokens_list)
    total_tokens = sum(total_tokens_list)
    avg_tokens = round(total_tokens / len(total_tokens_list), 1) if total_tokens_list else 0.0

    # Metrics summary
    case_ids = [c.id for c in cases]
    metric_results = (
        db.query(MetricResult)
        .filter(MetricResult.case_result_id.in_(case_ids))
        .all()
    ) if case_ids else []

    metrics_by_name: Dict[str, List[MetricResult]] = {}
    for m in metric_results:
        metrics_by_name.setdefault(m.metric_name, []).append(m)

    metrics_summary: List[MetricSummary] = []
    for metric_name, m_list in sorted(metrics_by_name.items()):
        # Exclude not applicable (score is None) from average denominator
        valid_scores = [m.score for m in m_list if m.score is not None]
        na_count = sum(1 for m in m_list if m.score is None)
        passed_count = sum(1 for m in m_list if m.passed is True)

        avg_score = round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else None
        min_score = min(valid_scores) if valid_scores else None
        max_score = max(valid_scores) if valid_scores else None
        pass_rate = round((passed_count / len(valid_scores)) * 100.0, 1) if valid_scores else 0.0

        metrics_summary.append(MetricSummary(
            metric_name=metric_name,
            average_score=avg_score,
            min_score=min_score,
            max_score=max_score,
            evaluated_count=len(valid_scores),
            not_applicable_count=na_count,
            passed_count=passed_count,
            pass_rate=pass_rate
        ))

    # Duration calculation
    duration_seconds = None
    if run.started_at and run.finished_at:
        duration_seconds = round((run.finished_at - run.started_at).total_seconds(), 2)

    progress_percent = round((completed_cases + failed_cases) / total_cases * 100.0, 1) if total_cases > 0 else 0.0

    return RunSummaryResponse(
        run_id=run.id,
        project_id=run.project_id,
        dataset_id=run.dataset_id,
        dataset_name=run.dataset.name if run.dataset else "Dataset",
        dataset_version=run.dataset.version if run.dataset else 1,
        model_config_id=run.model_config_id,
        model_name=run.model_config.model_name if run.model_config else "Model",
        provider=run.model_config.provider if run.model_config else "openai",
        prompt_version_id=run.prompt_version_id,
        prompt_name=run.prompt_version.name if run.prompt_version else "Default Prompt",
        status=run.status,
        total_cases=total_cases,
        completed_cases=completed_cases,
        failed_cases=failed_cases,
        progress_percent=progress_percent,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_seconds=duration_seconds,
        mean_latency_ms=mean_latency,
        median_latency_ms=median_latency,
        p95_latency_ms=p95_latency,
        total_prompt_tokens=total_prompt_tokens,
        total_completion_tokens=total_completion_tokens,
        total_tokens=total_tokens,
        avg_tokens_per_case=avg_tokens,
        metrics_summary=metrics_summary,
        configuration_snapshot=run.configuration_snapshot or {},
        error_summary=run.error_summary,
        created_at=run.created_at
    )
