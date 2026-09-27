import time
import traceback
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.db.models import EvaluationRun, TestCase, CaseResult, MetricResult
from app.db.session import SessionLocal
from app.providers import get_provider
from app.evaluation.metrics import get_metric
from app.core.logging import logger
from app.core.security import sanitize_error_message

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def render_prompt(template: str, question: str, context: Optional[str] = None) -> str:
    """Safely renders prompt template with question and context variables."""
    rendered = template.replace("{question}", question)
    rendered = rendered.replace("{context}", context or "")
    return rendered

def execute_evaluation_run(run_id: str):
    """
    Background worker task to execute an evaluation run.
    Uses its own DB session to ensure isolation and live status updates.
    """
    db: Session = SessionLocal()
    try:
        run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
        if not run:
            logger.error(f"Evaluation run {run_id} not found.")
            return

        if run.status == "cancelled":
            logger.info(f"Evaluation run {run_id} was cancelled before starting.")
            return

        run.status = "running"
        run.started_at = utc_now()
        db.commit()
        db.refresh(run)

        config_snapshot = run.configuration_snapshot or {}
        model_name = config_snapshot.get("model_name", "gpt-4o-mini")
        provider_type = config_snapshot.get("provider", "openai")
        model_params = config_snapshot.get("parameters", {})
        selected_metrics = config_snapshot.get("metrics", ["correctness", "relevance", "faithfulness", "hallucination"])
        
        system_prompt = config_snapshot.get("system_prompt", "You are a helpful, accurate, and concise AI assistant.")
        user_template = config_snapshot.get("user_template", "{question}")

        # Instantiate provider
        # If provider is mock or no openai key configured, falls back smoothly to mock
        try:
            target_provider = get_provider(provider_type)
        except Exception as e:
            logger.warning(f"Could not load provider {provider_type}, falling back to mock provider: {e}")
            target_provider = get_provider("mock")

        # Fetch enabled test cases for dataset
        test_cases = (
            db.query(TestCase)
            .filter(TestCase.dataset_id == run.dataset_id, TestCase.enabled == True)
            .order_by(TestCase.created_at.asc())
            .all()
        )

        run.total_cases = len(test_cases)
        db.commit()

        completed_count = 0
        failed_count = 0

        for case in test_cases:
            # Check for cancellation before each case
            db.refresh(run)
            if run.status == "cancelled":
                logger.info(f"Evaluation run {run_id} was cancelled mid-run.")
                break

            rendered_user = render_prompt(user_template, case.question, case.context)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": rendered_user}
            ]

            input_snapshot = {
                "question": case.question,
                "expected_answer": case.expected_answer,
                "context": case.context,
                "category": case.category,
                "rendered_prompt": rendered_user,
                "system_prompt": system_prompt
            }

            case_result = CaseResult(
                run_id=run.id,
                test_case_id=case.id,
                status="running",
                input_snapshot=input_snapshot,
                started_at=utc_now()
            )
            db.add(case_result)
            db.commit()
            db.refresh(case_result)

            try:
                # 1. Target LLM Generation
                gen_result = target_provider.generate(
                    messages=messages,
                    model_name=model_name,
                    parameters=model_params,
                    timeout=45.0
                )

                if gen_result.error:
                    case_result.status = "failed"
                    case_result.error_code = "GENERATION_ERROR"
                    case_result.error_message = gen_result.error
                    case_result.latency_ms = gen_result.latency_ms
                    case_result.finished_at = utc_now()
                    failed_count += 1
                else:
                    case_result.output_text = gen_result.text
                    case_result.latency_ms = gen_result.latency_ms
                    case_result.prompt_tokens = gen_result.prompt_tokens
                    case_result.completion_tokens = gen_result.completion_tokens
                    case_result.total_tokens = gen_result.total_tokens
                    case_result.provider_request_id = gen_result.request_id

                    # 2. Metric Evaluation
                    is_mock_run = gen_result.is_mock or provider_type == "mock"
                    for metric_name in selected_metrics:
                        try:
                            metric_instance = get_metric(metric_name)
                            m_result = metric_instance.evaluate(
                                question=case.question,
                                response_text=gen_result.text,
                                expected_answer=case.expected_answer,
                                context=case.context,
                                force_mock=is_mock_run
                            )

                            db_metric = MetricResult(
                                case_result_id=case_result.id,
                                metric_name=m_result.metric_name,
                                score=m_result.score,
                                score_scale_min=m_result.score_scale_min,
                                score_scale_max=m_result.score_scale_max,
                                passed=m_result.passed,
                                reason=m_result.reason,
                                evaluator_type=m_result.evaluator_type,
                                evaluator_model=m_result.evaluator_model,
                                rubric_version=m_result.rubric_version,
                                raw_output=m_result.raw_output
                            )
                            db.add(db_metric)
                        except Exception as me:
                            logger.error(f"Error evaluating metric {metric_name} for case {case.id}: {me}")
                            db_metric = MetricResult(
                                case_result_id=case_result.id,
                                metric_name=metric_name,
                                score=None,
                                passed=False,
                                reason=f"Evaluator error: {sanitize_error_message(me)}",
                                evaluator_type="error",
                                rubric_version="1.0"
                            )
                            db.add(db_metric)

                    case_result.status = "completed"
                    case_result.finished_at = utc_now()
                    completed_count += 1

            except Exception as e:
                logger.error(f"Fatal error processing test case {case.id}: {traceback.format_exc()}")
                case_result.status = "failed"
                case_result.error_code = "RUNTIME_EXCEPTION"
                case_result.error_message = sanitize_error_message(e)
                case_result.finished_at = utc_now()
                failed_count += 1

            # Update run progress in real time
            run.completed_cases = completed_count
            run.failed_cases = failed_count
            db.commit()

        # Finalize run status
        db.refresh(run)
        if run.status != "cancelled":
            if failed_count == 0 and completed_count > 0:
                run.status = "completed"
            elif completed_count > 0 and failed_count > 0:
                run.status = "completed_with_errors"
            else:
                run.status = "failed"

        run.finished_at = utc_now()
        db.commit()
        logger.info(f"Evaluation run {run_id} completed with status {run.status}")

    except Exception as e:
        logger.error(f"Error in runner execution for run {run_id}: {traceback.format_exc()}")
        try:
            run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
            if run:
                run.status = "failed"
                run.error_summary = sanitize_error_message(e)
                run.finished_at = utc_now()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
