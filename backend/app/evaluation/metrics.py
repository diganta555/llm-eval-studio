from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from app.evaluation.rubric import (
    CORRECTNESS_RUBRIC_V1,
    RELEVANCE_RUBRIC_V1,
    FAITHFULNESS_RUBRIC_V1,
    HALLUCINATION_RUBRIC_V1,
)
from app.evaluation.judge import evaluate_with_judge, JudgeEvaluationOutput

class MetricEvaluationResult(BaseModel):
    metric_name: str
    score: Optional[float] = None
    score_scale_min: float = 0.0
    score_scale_max: float = 100.0
    passed: Optional[bool] = None
    reason: str
    evaluator_type: str
    evaluator_model: Optional[str] = None
    rubric_version: str
    raw_output: Dict[str, Any] = Field(default_factory=dict)

class BaseMetric(ABC):
    name: str
    version: str = "1.0"
    evaluator_type: str = "llm_judge"
    direction: str = "higher_is_better"  # or "lower_is_better"

    @abstractmethod
    def evaluate(
        self,
        question: str,
        response_text: str,
        expected_answer: Optional[str] = None,
        context: Optional[str] = None,
        judge_model: Optional[str] = None,
        api_key: Optional[str] = None,
        force_mock: bool = False
    ) -> MetricEvaluationResult:
        pass

class CorrectnessMetric(BaseMetric):
    name = "correctness"
    version = "1.0"
    direction = "higher_is_better"

    def evaluate(
        self,
        question: str,
        response_text: str,
        expected_answer: Optional[str] = None,
        context: Optional[str] = None,
        judge_model: Optional[str] = None,
        api_key: Optional[str] = None,
        force_mock: bool = False
    ) -> MetricEvaluationResult:
        # Deterministic check: exact or normalized match
        if expected_answer and response_text.strip().lower() == expected_answer.strip().lower():
            return MetricEvaluationResult(
                metric_name=self.name,
                score=100.0,
                score_scale_min=0.0,
                score_scale_max=100.0,
                passed=True,
                reason="Exact string match with expected answer.",
                evaluator_type="deterministic",
                evaluator_model=None,
                rubric_version=self.version,
                raw_output={"match_type": "exact"}
            )

        judge_res: JudgeEvaluationOutput = evaluate_with_judge(
            metric_name=self.name,
            rubric=CORRECTNESS_RUBRIC_V1,
            question=question,
            response_text=response_text,
            expected_answer=expected_answer,
            context=context,
            judge_model=judge_model,
            api_key=api_key,
            force_mock=force_mock
        )

        return MetricEvaluationResult(
            metric_name=self.name,
            score=judge_res.score,
            score_scale_min=0.0,
            score_scale_max=100.0,
            passed=judge_res.passed,
            reason=judge_res.reason,
            evaluator_type="llm_judge",
            evaluator_model=judge_model or "default_judge",
            rubric_version=self.version,
            raw_output={"evidence": [e.model_dump() for e in judge_res.evidence]}
        )

class RelevanceMetric(BaseMetric):
    name = "relevance"
    version = "1.0"
    direction = "higher_is_better"

    def evaluate(
        self,
        question: str,
        response_text: str,
        expected_answer: Optional[str] = None,
        context: Optional[str] = None,
        judge_model: Optional[str] = None,
        api_key: Optional[str] = None,
        force_mock: bool = False
    ) -> MetricEvaluationResult:
        judge_res: JudgeEvaluationOutput = evaluate_with_judge(
            metric_name=self.name,
            rubric=RELEVANCE_RUBRIC_V1,
            question=question,
            response_text=response_text,
            expected_answer=expected_answer,
            context=context,
            judge_model=judge_model,
            api_key=api_key,
            force_mock=force_mock
        )

        return MetricEvaluationResult(
            metric_name=self.name,
            score=judge_res.score,
            score_scale_min=0.0,
            score_scale_max=100.0,
            passed=judge_res.passed,
            reason=judge_res.reason,
            evaluator_type="llm_judge",
            evaluator_model=judge_model or "default_judge",
            rubric_version=self.version,
            raw_output={"evidence": [e.model_dump() for e in judge_res.evidence]}
        )

class FaithfulnessMetric(BaseMetric):
    name = "faithfulness"
    version = "1.0"
    direction = "higher_is_better"

    def evaluate(
        self,
        question: str,
        response_text: str,
        expected_answer: Optional[str] = None,
        context: Optional[str] = None,
        judge_model: Optional[str] = None,
        api_key: Optional[str] = None,
        force_mock: bool = False
    ) -> MetricEvaluationResult:
        # Crucial requirement: If no reference context is provided, mark as not_applicable!
        if not context or not context.strip():
            return MetricEvaluationResult(
                metric_name=self.name,
                score=None,
                score_scale_min=0.0,
                score_scale_max=100.0,
                passed=None,
                reason="No reference context provided. Metric not applicable.",
                evaluator_type="deterministic",
                evaluator_model=None,
                rubric_version=self.version,
                raw_output={"status": "not_applicable"}
            )

        judge_res: JudgeEvaluationOutput = evaluate_with_judge(
            metric_name=self.name,
            rubric=FAITHFULNESS_RUBRIC_V1,
            question=question,
            response_text=response_text,
            expected_answer=expected_answer,
            context=context,
            judge_model=judge_model,
            api_key=api_key,
            force_mock=force_mock
        )

        return MetricEvaluationResult(
            metric_name=self.name,
            score=judge_res.score,
            score_scale_min=0.0,
            score_scale_max=100.0,
            passed=judge_res.passed,
            reason=judge_res.reason,
            evaluator_type="llm_judge",
            evaluator_model=judge_model or "default_judge",
            rubric_version=self.version,
            raw_output={"evidence": [e.model_dump() for e in judge_res.evidence]}
        )

class HallucinationMetric(BaseMetric):
    name = "hallucination"
    version = "1.0"
    direction = "lower_is_better"  # 0 is best, 100 is worst!

    def evaluate(
        self,
        question: str,
        response_text: str,
        expected_answer: Optional[str] = None,
        context: Optional[str] = None,
        judge_model: Optional[str] = None,
        api_key: Optional[str] = None,
        force_mock: bool = False
    ) -> MetricEvaluationResult:
        judge_res: JudgeEvaluationOutput = evaluate_with_judge(
            metric_name=self.name,
            rubric=HALLUCINATION_RUBRIC_V1,
            question=question,
            response_text=response_text,
            expected_answer=expected_answer,
            context=context,
            judge_model=judge_model,
            api_key=api_key,
            force_mock=force_mock
        )

        return MetricEvaluationResult(
            metric_name=self.name,
            score=judge_res.score,
            score_scale_min=0.0,
            score_scale_max=100.0,
            passed=judge_res.passed,
            reason=judge_res.reason,
            evaluator_type="llm_judge",
            evaluator_model=judge_model or "default_judge",
            rubric_version=self.version,
            raw_output={"evidence": [e.model_dump() for e in judge_res.evidence]}
        )

# Metric registry
METRIC_REGISTRY: Dict[str, BaseMetric] = {
    "correctness": CorrectnessMetric(),
    "relevance": RelevanceMetric(),
    "faithfulness": FaithfulnessMetric(),
    "hallucination": HallucinationMetric(),
}

def get_metric(name: str) -> BaseMetric:
    name_lower = name.lower()
    if name_lower not in METRIC_REGISTRY:
        raise ValueError(f"Unknown metric '{name}'. Available: {list(METRIC_REGISTRY.keys())}")
    return METRIC_REGISTRY[name_lower]
