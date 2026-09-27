"""
Validation Service
==================
Contains the core logic for running ground-truth validation:
- Importing/creating validation datasets with cases
- Executing validation runs (comparing metric engine output vs expected labels)
- Computing accuracy, precision, recall, F1, MAE, and confusion matrices
- Seeding sample provisional validation cases
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.db.models.validation_case import ValidationDataset, ValidationCase, ValidationRun
from app.evaluation.metrics import get_metric, MetricEvaluationResult
from app.schemas.validation import (
    ValidationCaseCreate, MetricValidationResult,
    ValidationCaseResultItem, ExpectedLabel
)
from app.core.logging import logger


# ---------------------------------------------------------------------------
# Dataset & Case CRUD
# ---------------------------------------------------------------------------

def create_validation_dataset(
    db: Session,
    project_id: str,
    name: str,
    description: str = "",
    cases: Optional[List[ValidationCaseCreate]] = None,
) -> ValidationDataset:
    """Create a validation dataset with optional initial cases."""
    ds = ValidationDataset(
        project_id=project_id,
        name=name,
        description=description,
    )
    db.add(ds)
    db.flush()

    if cases:
        for case_data in cases:
            case = ValidationCase(
                dataset_id=ds.id,
                question=case_data.question,
                reference_answer=case_data.reference_answer,
                reference_context=case_data.reference_context,
                model_answer=case_data.model_answer,
                expected_labels={k: v.model_dump() for k, v in case_data.expected_labels.items()},
                review_status=case_data.review_status,
                reviewer_notes=case_data.reviewer_notes,
                category=case_data.category,
            )
            db.add(case)

    db.commit()
    db.refresh(ds)
    return ds


def get_validation_datasets(db: Session, project_id: str) -> List[ValidationDataset]:
    return db.query(ValidationDataset).filter(
        ValidationDataset.project_id == project_id
    ).order_by(ValidationDataset.created_at.desc()).all()


def get_validation_dataset_detail(db: Session, dataset_id: str) -> Optional[ValidationDataset]:
    return db.query(ValidationDataset).filter(ValidationDataset.id == dataset_id).first()


def update_validation_case(
    db: Session,
    case_id: str,
    expected_labels: Optional[Dict[str, Any]] = None,
    review_status: Optional[str] = None,
    reviewer_notes: Optional[str] = None,
    reviewed_by: Optional[str] = None,
) -> Optional[ValidationCase]:
    """Update a validation case's expected labels or review status."""
    case = db.query(ValidationCase).filter(ValidationCase.id == case_id).first()
    if not case:
        return None

    if expected_labels is not None:
        case.expected_labels = expected_labels
    if review_status is not None:
        case.review_status = review_status
    if reviewer_notes is not None:
        case.reviewer_notes = reviewer_notes
    if reviewed_by is not None:
        case.reviewed_by = reviewed_by
        case.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(case)
    return case


def delete_validation_dataset(db: Session, dataset_id: str) -> bool:
    ds = db.query(ValidationDataset).filter(ValidationDataset.id == dataset_id).first()
    if not ds:
        return False
    db.delete(ds)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Validation Run Execution
# ---------------------------------------------------------------------------

MIN_REVIEWED_FOR_VALIDATION = 5


def run_validation(
    db: Session,
    dataset_id: str,
    project_id: str,
    include_unreviewed: bool = False,
    force_mock: bool = True,
) -> ValidationRun:
    """
    Execute a full validation run:
    1. Load eligible cases from the dataset (all cases if include_unreviewed else only reviewed)
    2. For each case, run each metric the case has expected labels for
    3. Compare predicted vs expected labels
    4. Compute verified stats (strictly human-reviewed cases) and provisional stats separately
    5. Determine validation status based on actual reviewed data
    6. Persist the results
    """
    dataset = db.query(ValidationDataset).filter(ValidationDataset.id == dataset_id).first()
    if not dataset:
        raise ValueError(f"Validation dataset {dataset_id} not found")

    all_cases = db.query(ValidationCase).filter(ValidationCase.dataset_id == dataset_id).all()
    if not all_cases:
        raise ValueError("Validation dataset has no cases")

    cases_to_evaluate = all_cases if include_unreviewed else [c for c in all_cases if c.review_status == "reviewed"]
    if not cases_to_evaluate:
        raise ValueError("Dataset has no reviewed cases to evaluate. Check 'Include Provisional Cases' to run a provisional benchmark.")

    # Create run record
    run = ValidationRun(
        dataset_id=dataset_id,
        project_id=project_id,
        status="running",
        total_cases=len(cases_to_evaluate),
        include_unreviewed=include_unreviewed,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        case_results = []
        # Per-metric tracking
        metric_data: Dict[str, Dict[str, Any]] = {}
        reviewed_count = 0
        provisional_count = 0

        for case in cases_to_evaluate:
            is_reviewed = case.review_status == "reviewed"
            if is_reviewed:
                reviewed_count += 1
            else:
                provisional_count += 1

            labels = case.expected_labels or {}

            for metric_name, label_data in labels.items():
                expected_pass = label_data.get("passed")
                expected_score = label_data.get("score")

                # Run the metric
                try:
                    metric_obj = get_metric(metric_name)
                    eval_result: MetricEvaluationResult = metric_obj.evaluate(
                        question=case.question,
                        response_text=case.model_answer,
                        expected_answer=case.reference_answer,
                        context=case.reference_context,
                        force_mock=force_mock,
                    )
                    predicted_pass = eval_result.passed
                    predicted_score = eval_result.score
                    predicted_reason = eval_result.reason
                except Exception as e:
                    logger.error(f"Metric {metric_name} failed for case {case.id}: {e}")
                    predicted_pass = None
                    predicted_score = None
                    predicted_reason = f"Error: {str(e)}"

                # Determine agreement
                agreement = None
                if expected_pass is not None and predicted_pass is not None:
                    agreement = expected_pass == predicted_pass
                elif expected_pass is None and predicted_pass is None and expected_score is None and predicted_score is None:
                    # Both agreed on not_applicable (e.g. faithfulness without context)
                    agreement = None

                # Score error
                score_error = None
                if expected_score is not None and predicted_score is not None:
                    score_error = abs(predicted_score - expected_score)

                # Explanation
                explanation = ""
                if agreement is True:
                    explanation = "Metric prediction matches expected label."
                elif agreement is False:
                    explanation = f"Disagreement: expected {'pass' if expected_pass else 'fail'}, got {'pass' if predicted_pass else 'fail'}. {predicted_reason}"
                elif predicted_pass is None and predicted_score is None:
                    explanation = "Metric returned not_applicable (e.g. faithfulness without reference context). Excluded from binary confusion matrix."
                else:
                    explanation = "Cannot compare: missing expected or predicted verdict."

                case_results.append(ValidationCaseResultItem(
                    case_id=case.id,
                    question=case.question,
                    reference_answer=case.reference_answer,
                    reference_context=case.reference_context,
                    model_answer=case.model_answer,
                    metric=metric_name,
                    expected_pass=expected_pass,
                    expected_score=expected_score,
                    predicted_pass=predicted_pass,
                    predicted_score=predicted_score,
                    predicted_reason=predicted_reason,
                    agreement=agreement,
                    score_error=score_error,
                    review_status=case.review_status,
                    is_reviewed=is_reviewed,
                    explanation=explanation,
                    category=case.category,
                ))

                # Track for per-metric stats
                if metric_name not in metric_data:
                    metric_data[metric_name] = {
                        "reviewed_verdicts": [],
                        "reviewed_scores": [],
                        "provisional_verdicts": [],
                        "provisional_scores": [],
                        "reviewed_cases": 0,
                        "provisional_cases": 0,
                        "total_cases": 0,
                        "na_count": 0,
                    }

                metric_data[metric_name]["total_cases"] += 1
                if is_reviewed:
                    metric_data[metric_name]["reviewed_cases"] += 1
                else:
                    metric_data[metric_name]["provisional_cases"] += 1

                has_verdict = expected_pass is not None and predicted_pass is not None
                has_score = expected_score is not None and predicted_score is not None

                if has_verdict:
                    item = {"expected": expected_pass, "predicted": predicted_pass}
                    if is_reviewed:
                        metric_data[metric_name]["reviewed_verdicts"].append(item)
                    else:
                        metric_data[metric_name]["provisional_verdicts"].append(item)

                if has_score:
                    item = {
                        "expected": expected_score,
                        "predicted": predicted_score,
                        "error": abs(predicted_score - expected_score),
                    }
                    if is_reviewed:
                        metric_data[metric_name]["reviewed_scores"].append(item)
                    else:
                        metric_data[metric_name]["provisional_scores"].append(item)

                if not has_verdict and not has_score:
                    metric_data[metric_name]["na_count"] += 1

        # Compute aggregate metrics
        metric_results = []
        for metric_name, data in metric_data.items():
            metric_results.append(_compute_metric_stats(
                metric_name=metric_name,
                reviewed_verdicts=data["reviewed_verdicts"],
                reviewed_scores=data["reviewed_scores"],
                provisional_verdicts=data["provisional_verdicts"],
                provisional_scores=data["provisional_scores"],
                reviewed_count=data["reviewed_cases"],
                provisional_count=data["provisional_cases"],
                total_count=data["total_cases"],
                na_count=data["na_count"],
            ))

        # Overall summary calculations
        all_reviewed_verdicts = []
        all_provisional_verdicts = []
        for d in metric_data.values():
            all_reviewed_verdicts.extend(d["reviewed_verdicts"])
            all_provisional_verdicts.extend(d["provisional_verdicts"])

        reviewed_correct = sum(1 for v in all_reviewed_verdicts if v["expected"] == v["predicted"])
        provisional_correct = sum(1 for v in all_provisional_verdicts if v["expected"] == v["predicted"])
        total_correct = reviewed_correct + provisional_correct
        total_binary = len(all_reviewed_verdicts) + len(all_provisional_verdicts)

        verified_accuracy = (
            round((reviewed_correct / len(all_reviewed_verdicts)) * 100.0, 1)
            if all_reviewed_verdicts
            else None
        )
        provisional_agreement_rate = (
            round((total_correct / max(1, total_binary)) * 100.0, 1)
            if total_binary > 0
            else None
        )

        # Overall validation status based strictly on human-reviewed data
        if reviewed_count >= MIN_REVIEWED_FOR_VALIDATION:
            if verified_accuracy is not None and verified_accuracy >= 80.0:
                overall_status = "validated"
                overall_notice = f"Verified: {reviewed_count} human-reviewed benchmark cases meet validation standards ({verified_accuracy}% accuracy)."
            else:
                overall_status = "needs_calibration"
                overall_notice = f"Needs Calibration: {reviewed_count} reviewed cases evaluated; verified accuracy is {verified_accuracy}%."
        elif reviewed_count > 0:
            overall_status = "insufficient_data"
            overall_notice = f"Caution: Only {reviewed_count} human-reviewed case(s) present (minimum {MIN_REVIEWED_FOR_VALIDATION} required). Results are statistically insufficient for formal validation."
        elif len(all_provisional_verdicts) > 0:
            overall_status = "provisional"
            overall_notice = "Provisional Agreement: All evaluated cases are provisional/unreviewed. Metrics cannot be marked VALIDATED until reviewed by human evaluators."
        else:
            overall_status = "pending"
            overall_notice = "No test cases evaluated."

        results_summary = {
            "overall": {
                "total_cases": len(case_results),
                "total_comparisons": total_binary,
                "reviewed_cases": reviewed_count,
                "provisional_cases": provisional_count,
                "reviewed_comparisons": len(all_reviewed_verdicts),
                "provisional_comparisons": len(all_provisional_verdicts),
                "verified_accuracy": verified_accuracy,  # None if 0 reviewed
                "provisional_accuracy": provisional_agreement_rate,  # e.g. 93.1% if unreviewed included
                "accuracy": verified_accuracy,  # Standard accuracy is strictly verified accuracy
                "is_provisional": provisional_count > 0,
                "has_insufficient_reviewed": reviewed_count < MIN_REVIEWED_FOR_VALIDATION,
                "min_reviewed_required": MIN_REVIEWED_FOR_VALIDATION,
                "status": overall_status,
                "status_notice": overall_notice,
            },
            "by_metric": {mr.metric_name: mr.model_dump() for mr in metric_results},
        }

        # Update the run
        run.status = "completed"
        run.total_cases = len(case_results)
        run.reviewed_cases = reviewed_count
        run.results_summary = results_summary
        run.case_results = [cr.model_dump() for cr in case_results]
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)

        return run

    except Exception as e:
        logger.error(f"Validation run {run.id} failed: {e}")
        run.status = "failed"
        run.results_summary = {"error": str(e)}
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise


def _compute_confusion_and_metrics(
    verdicts: List[Dict[str, bool]],
    scores: List[Dict[str, float]]
) -> Dict[str, Any]:
    """Compute TP, FP, TN, FN, accuracy, precision, recall, F1, and MAE for a verdict list."""
    tp = fp = tn = fn = 0
    for v in verdicts:
        expected = v["expected"]
        predicted = v["predicted"]
        if expected and predicted:
            tp += 1
        elif not expected and predicted:
            fp += 1
        elif not expected and not predicted:
            tn += 1
        elif expected and not predicted:
            fn += 1

    total = len(verdicts)
    correct = tp + tn
    accuracy = round((correct / total) * 100.0, 1) if total > 0 else None
    precision = round((tp / (tp + fp)) * 100.0, 1) if (tp + fp) > 0 else None
    recall = round((tp / (tp + fn)) * 100.0, 1) if (tp + fn) > 0 else None
    f1 = None
    if precision is not None and recall is not None and (precision + recall) > 0:
        f1 = round((2 * precision * recall) / (precision + recall), 1)

    mae = None
    if scores:
        mae = round(sum(s["error"] for s in scores) / len(scores), 2)

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "mae": mae,
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
        "total_verdicts": total,
    }


def _compute_metric_stats(
    metric_name: str,
    reviewed_verdicts: List[Dict[str, bool]],
    reviewed_scores: List[Dict[str, float]],
    provisional_verdicts: List[Dict[str, bool]],
    provisional_scores: List[Dict[str, float]],
    reviewed_count: int,
    provisional_count: int,
    total_count: int,
    na_count: int,
) -> MetricValidationResult:
    """
    Compute verified stats (strictly from human-reviewed ground truth)
    and provisional stats (unreviewed) separately.
    Enforces validation status rules: never marked validated without >= 5 reviewed cases.
    """
    # 1. Verified metrics (strictly reviewed)
    verified = _compute_confusion_and_metrics(reviewed_verdicts, reviewed_scores)

    # 2. Provisional metrics (unreviewed)
    provisional = _compute_confusion_and_metrics(provisional_verdicts, provisional_scores)

    # 3. Status determination based strictly on human-reviewed data:
    if reviewed_count >= MIN_REVIEWED_FOR_VALIDATION:
        if verified["accuracy"] is not None and verified["accuracy"] >= 80.0:
            status = "validated"
            status_notice = f"Validated against {reviewed_count} human-reviewed cases ({verified['accuracy']}% verified accuracy)."
        else:
            status = "needs_calibration"
            status_notice = f"Needs Calibration: {reviewed_count} human-reviewed cases evaluated; verified accuracy is {verified['accuracy']}%."
    elif reviewed_count > 0:
        status = "insufficient_data"
        status_notice = f"Insufficient human-reviewed sample size ({reviewed_count}/{MIN_REVIEWED_FOR_VALIDATION} required). Cannot certify validation."
    elif provisional_count > 0:
        status = "provisional"
        status_notice = f"Provisional: Based on {provisional_count} unreviewed sample cases. Human expert review is required for validation."
    else:
        status = "pending"
        status_notice = "Pending: No test cases available for this metric."

    # 4. Denominator & sample size explanation
    eligible_binary_count = verified["total_verdicts"] + provisional["total_verdicts"]
    if na_count > 0:
        sample_explanation = (
            f"{total_count} cases evaluated: {eligible_binary_count} eligible for confusion matrix "
            f"({verified['total_verdicts']} reviewed, {provisional['total_verdicts']} provisional); "
            f"{na_count} case excluded as not applicable (e.g. no reference context)."
        )
    else:
        sample_explanation = (
            f"{total_count} cases evaluated: all {eligible_binary_count} eligible for confusion matrix "
            f"({verified['total_verdicts']} reviewed, {provisional['total_verdicts']} provisional)."
        )

    return MetricValidationResult(
        metric_name=metric_name,
        # Verified metrics (strictly human-reviewed ground truth)
        accuracy=verified["accuracy"],
        precision=verified["precision"],
        recall=verified["recall"],
        f1_score=verified["f1_score"],
        mae=verified["mae"],
        reviewed_count=reviewed_count,
        reviewed_sample_count=verified["total_verdicts"],
        true_positives=verified["true_positives"],
        false_positives=verified["false_positives"],
        true_negatives=verified["true_negatives"],
        false_negatives=verified["false_negatives"],
        # Total counts & Status
        sample_count=total_count,
        provisional_count=provisional_count,
        na_count=na_count,
        sample_size_explanation=sample_explanation,
        status=status,
        status_notice=status_notice,
        # Provisional metrics (shown separately when unreviewed cases exist)
        provisional_accuracy=provisional["accuracy"],
        provisional_precision=provisional["precision"],
        provisional_recall=provisional["recall"],
        provisional_f1_score=provisional["f1_score"],
        provisional_mae=provisional["mae"],
        provisional_true_positives=provisional["true_positives"],
        provisional_false_positives=provisional["false_positives"],
        provisional_true_negatives=provisional["true_negatives"],
        provisional_false_negatives=provisional["false_negatives"],
        provisional_sample_count=provisional["total_verdicts"],
    )


# ---------------------------------------------------------------------------
# Validation History
# ---------------------------------------------------------------------------

def get_validation_runs(db: Session, project_id: str) -> List[ValidationRun]:
    return db.query(ValidationRun).filter(
        ValidationRun.project_id == project_id
    ).order_by(ValidationRun.created_at.desc()).all()


def get_validation_run_detail(db: Session, run_id: str) -> Optional[ValidationRun]:
    return db.query(ValidationRun).filter(ValidationRun.id == run_id).first()


# ---------------------------------------------------------------------------
# Seed Sample Validation Cases (30 provisional cases)
# ---------------------------------------------------------------------------

SAMPLE_VALIDATION_CASES: List[ValidationCaseCreate] = [
    # --- CORRECTNESS CASES (8) ---
    ValidationCaseCreate(
        question="What is the capital of France?",
        reference_answer="Paris",
        model_answer="Paris",
        expected_labels={"correctness": ExpectedLabel(passed=True, score=100.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: exact match case",
        category="exact_match",
    ),
    ValidationCaseCreate(
        question="What is Python?",
        reference_answer="A high-level programming language.",
        model_answer="  A High-Level Programming Language.  ",
        expected_labels={"correctness": ExpectedLabel(passed=True, score=100.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: case-insensitive match test",
        category="case_insensitive",
    ),
    ValidationCaseCreate(
        question="What is an API?",
        reference_answer="Application Programming Interface enables software applications to communicate with each other using protocols.",
        model_answer="An Application Programming Interface (API) is a set of rules and protocols enabling software applications to communicate with each other.",
        expected_labels={"correctness": ExpectedLabel(passed=True, score=95.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: high overlap expected",
        category="high_overlap",
    ),
    ValidationCaseCreate(
        question="What is quantum computing?",
        reference_answer="Quantum computing leverages quantum mechanics principles like superposition and entanglement to perform complex computations.",
        model_answer="A recipe for making homemade Italian sourdough pizza with tomato sauce and mozzarella.",
        expected_labels={"correctness": ExpectedLabel(passed=False, score=20.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: completely off-topic response",
        category="total_mismatch",
    ),
    ValidationCaseCreate(
        question="What is 2+2?",
        reference_answer="4",
        model_answer="",
        expected_labels={"correctness": ExpectedLabel(passed=False, score=20.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: empty response should fail",
        category="empty_response",
    ),
    ValidationCaseCreate(
        question="Is the Earth flat?",
        reference_answer="No, the Earth is an oblate spheroid.",
        model_answer="Yes, the Earth is completely flat like a disc.",
        expected_labels={"correctness": ExpectedLabel(passed=False, score=20.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: contradicts expected answer",
        category="contradiction",
    ),
    ValidationCaseCreate(
        question="What is the meaning of life?",
        reference_answer=None,
        model_answer="The meaning of life is a philosophical question debated for centuries. Some say it is to seek happiness, others say it is to find purpose.",
        expected_labels={"correctness": ExpectedLabel(passed=True, score=85.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: no expected answer, coherent response",
        category="open_ended",
    ),
    ValidationCaseCreate(
        question="What is the Pythagorean theorem?",
        reference_answer="In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides: a² + b² = c².",
        model_answer="The Pythagorean theorem states that a² + b² = c², where c is the hypotenuse of a right-angled triangle.",
        expected_labels={"correctness": ExpectedLabel(passed=True, score=95.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: paraphrase with same content",
        category="paraphrase",
    ),

    # --- RELEVANCE CASES (8) ---
    ValidationCaseCreate(
        question="How do I sort a list in Python?",
        reference_answer=None,
        model_answer="You can sort a list in Python using the built-in sorted() function or by calling the .sort() method directly on the list.",
        expected_labels={"relevance": ExpectedLabel(passed=True, score=95.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: directly relevant answer",
        category="directly_relevant",
    ),
    ValidationCaseCreate(
        question="How do I sort a list in Python?",
        reference_answer=None,
        model_answer="The Eiffel Tower was constructed in Paris between 1887 and 1889 as the entrance arch for the World's Fair.",
        expected_labels={"relevance": ExpectedLabel(passed=False, score=45.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: completely irrelevant",
        category="completely_irrelevant",
    ),
    ValidationCaseCreate(
        question="What are the benefits of using TypeScript?",
        reference_answer=None,
        model_answer="JavaScript is a dynamic scripting language used in web browsers. It was created by Brendan Eich in 1995.",
        expected_labels={"relevance": ExpectedLabel(passed=False, score=80.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: tangentially relevant (JavaScript vs TypeScript)",
        category="tangentially_relevant",
    ),
    ValidationCaseCreate(
        question="What is Docker?",
        reference_answer=None,
        model_answer="Docker is a platform for developing, shipping, and running applications in containers. Containers are lightweight, portable environments.",
        expected_labels={"relevance": ExpectedLabel(passed=True, score=95.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: verbose but relevant",
        category="verbose_relevant",
    ),
    ValidationCaseCreate(
        question="What is the time complexity of binary search?",
        reference_answer=None,
        model_answer="The time complexity of binary search is O(log n).",
        expected_labels={"relevance": ExpectedLabel(passed=True, score=95.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: concise correct answer",
        category="concise_correct",
    ),
    ValidationCaseCreate(
        question="How do I perform a SQL JOIN?",
        reference_answer=None,
        model_answer="To bake a chocolate cake, preheat the oven to 350°F, mix flour, sugar, cocoa powder, and eggs together.",
        expected_labels={"relevance": ExpectedLabel(passed=False, score=45.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: wrong domain entirely",
        category="wrong_domain",
    ),
    ValidationCaseCreate(
        question="How do I connect to a PostgreSQL database using Python?",
        reference_answer=None,
        model_answer="You can use the psycopg2 library to connect to PostgreSQL from Python.",
        expected_labels={"relevance": ExpectedLabel(passed=True, score=95.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: brief but correct answer",
        category="partial_answer",
    ),
    ValidationCaseCreate(
        question="What is Kubernetes?",
        reference_answer=None,
        model_answer="That is a great question about Kubernetes. Kubernetes is indeed interesting.",
        expected_labels={"relevance": ExpectedLabel(passed=False, score=80.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: question repetition without substance",
        category="question_repetition",
    ),

    # --- FAITHFULNESS CASES (7) ---
    ValidationCaseCreate(
        question="What is photosynthesis?",
        reference_answer=None,
        reference_context=None,
        model_answer="Photosynthesis is the process by which plants convert sunlight into chemical energy.",
        expected_labels={"faithfulness": ExpectedLabel(passed=None, score=None)},
        review_status="provisional",
        reviewer_notes="Auto-generated: no context provided → not_applicable",
        category="no_context",
    ),
    ValidationCaseCreate(
        question="Tell me about NovaTech.",
        reference_context="NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration.",
        model_answer="NovaTech was founded in 2018 in San Francisco. It focuses on cloud-native security orchestration.",
        expected_labels={"faithfulness": ExpectedLabel(passed=True, score=100.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: fully supported by context",
        category="fully_supported",
    ),
    ValidationCaseCreate(
        question="What year was NovaTech founded?",
        reference_context="NovaTech offers enterprise firewall solutions. The CEO is Jane Doe.",
        model_answer="The founding year of NovaTech is not mentioned in the provided reference context.",
        expected_labels={"faithfulness": ExpectedLabel(passed=True, score=100.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: appropriate abstention",
        category="appropriate_abstention",
    ),
    ValidationCaseCreate(
        question="Tell me about NovaTech.",
        reference_context="NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration.",
        model_answer="NovaTech was founded in 1902 in Tokyo and is the world's largest manufacturer of orbital space elevators.",
        expected_labels={"faithfulness": ExpectedLabel(passed=False, score=0.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: fabricated claims contradict context",
        category="fabricated_claims",
    ),
    ValidationCaseCreate(
        question="Describe Apollo 11.",
        reference_context="Apollo 11 was the spaceflight that first landed humans on the Moon. Commander Neil Armstrong and lunar module pilot Buzz Aldrin landed the Apollo Lunar Module Eagle on July 20, 1969.",
        model_answer="Apollo 11 landed on the Moon on July 20, 1969. Neil Armstrong was commander. The mission carried a nuclear reactor for power.",
        expected_labels={"faithfulness": ExpectedLabel(passed=False, score=67.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: two correct claims, one fabricated",
        category="mixed_claims",
    ),
    ValidationCaseCreate(
        question="What does the company do?",
        reference_context="NovaTech Solutions delivers real-time telemetry and database monitoring tools to Fortune 500 customers across North America and Europe.",
        model_answer="The organization provides monitoring solutions for large enterprises worldwide.",
        expected_labels={"faithfulness": ExpectedLabel(passed=True, score=100.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: paraphrase supported by context",
        category="paraphrase_supported",
    ),
    ValidationCaseCreate(
        question="Tell me about the company.",
        reference_context="NovaTech Solutions is an independent enterprise cloud software company based in Seattle.",
        model_answer="The company was acquired by Microsoft in 2023 for $45 billion and renamed to Azure Cloud Services.",
        expected_labels={"faithfulness": ExpectedLabel(passed=False, score=0.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: complete fabrication",
        category="complete_fabrication",
    ),

    # --- HALLUCINATION CASES (7) ---
    ValidationCaseCreate(
        question="When did Apollo 11 land?",
        reference_context="Apollo 11 was the spaceflight that first landed humans on the Moon. Commander Neil Armstrong landed the Apollo Lunar Module Eagle on July 20, 1969.",
        model_answer="Apollo 11 landed on the Moon on July 20, 1969 with Neil Armstrong as commander.",
        expected_labels={"hallucination": ExpectedLabel(passed=True, score=0.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: fully grounded, zero hallucination expected",
        category="zero_hallucination",
    ),
    ValidationCaseCreate(
        question="When was NovaTech founded?",
        reference_context="NovaTech was founded in 2018 in San Francisco.",
        model_answer="NovaTech was founded in 1902 in Tokyo and developed the first steam locomotive engine for lunar transport.",
        expected_labels={"hallucination": ExpectedLabel(passed=False, score=100.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: heavy hallucination",
        category="full_hallucination",
    ),
    ValidationCaseCreate(
        question="What is the author's salary?",
        reference_context="The document describes database clustering algorithms.",
        model_answer="The document does not specify the author's personal salary.",
        expected_labels={"hallucination": ExpectedLabel(passed=True, score=0.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: correct abstention = zero hallucination",
        category="abstention_zero",
    ),
    ValidationCaseCreate(
        question="What does NovaTech do?",
        reference_context="NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration.",
        model_answer="NovaTech provides cloud security tools and has 10,000 employees working across 50 countries.",
        expected_labels={"hallucination": ExpectedLabel(passed=False, score=50.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: partial hallucination (employee count fabricated)",
        category="partial_hallucination",
    ),
    ValidationCaseCreate(
        question="What happened in 1610?",
        reference_context="In January 1610, Italian astronomer Galileo Galilei directed his newly constructed refracting telescope toward Jupiter and discovered the four largest moons of Jupiter.",
        model_answer="Galileo observed four moons around Jupiter using his telescope in 1610.",
        expected_labels={"hallucination": ExpectedLabel(passed=True, score=0.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: grounded paraphrase",
        category="grounded_paraphrase",
    ),
    ValidationCaseCreate(
        question="How popular is Python?",
        reference_context="Python is a popular general-purpose programming language widely used in data science and web development.",
        model_answer="Python is used by 97.3% of all data scientists worldwide and was rated the #1 language by 100% of Fortune 500 CTOs.",
        expected_labels={"hallucination": ExpectedLabel(passed=False, score=100.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: invented statistics",
        category="invented_statistics",
    ),
    ValidationCaseCreate(
        question="Who founded NovaTech?",
        reference_context="NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration.",
        model_answer="NovaTech was founded in 2018 in San Francisco by Dr. Emily Chen, a Stanford graduate.",
        expected_labels={"hallucination": ExpectedLabel(passed=False, score=50.0)},
        review_status="provisional",
        reviewer_notes="Auto-generated: subtle fabrication (founder name invented)",
        category="subtle_fabrication",
    ),
]


def seed_sample_validation_dataset(
    db: Session,
    project_id: str,
) -> ValidationDataset:
    """Seed a sample validation dataset with 30 provisional (unreviewed) cases."""
    return create_validation_dataset(
        db=db,
        project_id=project_id,
        name="Sample Ground Truth Dataset (Provisional)",
        description="30 auto-generated validation cases for testing the metric engine. "
                     "All cases are marked as PROVISIONAL and must be human-reviewed before "
                     "their labels are used for accuracy calculations.",
        cases=SAMPLE_VALIDATION_CASES,
    )
