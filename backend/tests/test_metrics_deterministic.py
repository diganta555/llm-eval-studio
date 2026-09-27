import pytest
from app.evaluation.metrics import (
    CorrectnessMetric,
    RelevanceMetric,
    FaithfulnessMetric,
    HallucinationMetric,
    get_metric,
    METRIC_REGISTRY
)

class TestMetricRegistry:
    def test_registry_contains_required_metrics(self):
        required = ["correctness", "relevance", "faithfulness", "hallucination"]
        for m in required:
            assert m in METRIC_REGISTRY
            instance = get_metric(m)
            assert instance.name == m

    def test_unknown_metric_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown metric 'invalid_metric'"):
            get_metric("invalid_metric")


class TestDeterministicCorrectnessMetric:
    @pytest.fixture
    def metric(self):
        return CorrectnessMetric()

    def test_exact_match_scores_100_deterministic(self, metric):
        res = metric.evaluate(
            question="What is the capital of France?",
            response_text="Paris",
            expected_answer="Paris",
            force_mock=True
        )
        assert res.score == 100.0
        assert res.passed is True
        assert res.evaluator_type == "deterministic"
        assert "Exact string match" in res.reason

    def test_normalized_case_exact_match(self, metric):
        res = metric.evaluate(
            question="What is Python?",
            response_text="  A High-Level Programming Language.  ",
            expected_answer="a high-level programming language.",
            force_mock=True
        )
        assert res.score == 100.0
        assert res.passed is True
        assert res.evaluator_type == "deterministic"

    def test_high_keyword_overlap_scores_95(self, metric):
        res = metric.evaluate(
            question="What is an API?",
            response_text="An Application Programming Interface (API) is a set of rules and protocols enabling software applications to communicate with each other.",
            expected_answer="Application Programming Interface enables software applications to communicate with each other using protocols.",
            force_mock=True
        )
        assert res.score == 95.0
        assert res.passed is True
        assert res.evaluator_type == "llm_judge"

    def test_complete_mismatch_scores_20(self, metric):
        res = metric.evaluate(
            question="What is quantum computing?",
            response_text="A recipe for making homemade Italian sourdough pizza with tomato sauce and mozzarella.",
            expected_answer="Quantum computing leverages quantum mechanics principles like superposition and entanglement to perform complex computations.",
            force_mock=True
        )
        assert res.score == 20.0
        assert res.passed is False
        assert "deviates significantly" in res.reason


class TestDeterministicRelevanceMetric:
    @pytest.fixture
    def metric(self):
        return RelevanceMetric()

    def test_direct_relevant_response_scores_95(self, metric):
        res = metric.evaluate(
            question="How do I sort a list in Python?",
            response_text="You can sort a list in Python using the built-in sorted() function or by calling the .sort() method directly on the list.",
            force_mock=True
        )
        assert res.score == 95.0
        assert res.passed is True
        assert "directly and concisely addresses" in res.reason

    def test_irrelevant_offtopic_response_scores_45(self, metric):
        res = metric.evaluate(
            question="How do I sort a list in Python?",
            response_text="The Eiffel Tower was constructed in Paris between 1887 and 1889 as the entrance arch for the World's Fair.",
            force_mock=True
        )
        assert res.score == 45.0
        assert res.passed is False
        assert "wanders off-topic" in res.reason


class TestDeterministicFaithfulnessMetric:
    @pytest.fixture
    def metric(self):
        return FaithfulnessMetric()

    def test_no_context_returns_none_and_not_applicable(self, metric):
        """CRITICAL: Without reference context, faithfulness MUST be marked not applicable."""
        res = metric.evaluate(
            question="What is photosynthesis?",
            response_text="Photosynthesis is the process by which plants convert sunlight into chemical energy.",
            context=None,
            force_mock=True
        )
        assert res.score is None
        assert res.passed is None
        assert res.evaluator_type == "deterministic"
        assert "No reference context provided" in res.reason
        assert res.raw_output.get("status") == "not_applicable"

    def test_empty_string_context_returns_none_and_not_applicable(self, metric):
        res = metric.evaluate(
            question="What is photosynthesis?",
            response_text="Photosynthesis is the process by which plants convert sunlight into chemical energy.",
            context="   ",
            force_mock=True
        )
        assert res.score is None
        assert res.passed is None
        assert res.evaluator_type == "deterministic"

    def test_supported_claims_by_context_scores_100(self, metric):
        context = "NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration."
        response = "NovaTech was founded in 2018 in San Francisco. It focuses on cloud-native security orchestration."
        res = metric.evaluate(
            question="Tell me about NovaTech.",
            response_text=response,
            context=context,
            force_mock=True
        )
        assert res.score == 100.0
        assert res.passed is True

    def test_appropriate_abstention_scores_100(self, metric):
        context = "NovaTech offers enterprise firewall solutions. The CEO is Jane Doe."
        response = "The founding year of NovaTech is not mentioned in the provided reference context."
        res = metric.evaluate(
            question="What year was NovaTech founded?",
            response_text=response,
            context=context,
            force_mock=True
        )
        assert res.score == 100.0
        assert res.passed is True
        assert "abstained" in res.reason.lower()


class TestDeterministicHallucinationMetric:
    @pytest.fixture
    def metric(self):
        return HallucinationMetric()

    def test_metric_direction_is_lower_is_better(self, metric):
        assert metric.direction == "lower_is_better"

    def test_grounded_response_has_zero_hallucination(self, metric):
        context = "Apollo 11 landed on the Moon on July 20, 1969. Neil Armstrong was the mission commander."
        response = "Apollo 11 landed on the Moon on July 20, 1969 with Neil Armstrong as commander."
        res = metric.evaluate(
            question="When did Apollo 11 land?",
            response_text=response,
            context=context,
            force_mock=True
        )
        assert res.score == 0.0
        assert res.passed is True
        assert "No unsupported" in res.reason

    def test_fabricated_claims_have_high_hallucination_score(self, metric):
        context = "NovaTech was founded in 2018 in San Francisco."
        response = "NovaTech was founded in 1902 in Tokyo and developed the first steam locomotive engine for lunar transport."
        res = metric.evaluate(
            question="When was NovaTech founded?",
            response_text=response,
            context=context,
            force_mock=True
        )
        assert res.score > 50.0
        assert res.passed is False

    def test_abstention_has_zero_hallucination(self, metric):
        context = "The document describes database clustering algorithms."
        response = "The document does not specify the author's personal salary."
        res = metric.evaluate(
            question="What is the author's salary?",
            response_text=response,
            context=context,
            force_mock=True
        )
        assert res.score == 0.0
        assert res.passed is True
