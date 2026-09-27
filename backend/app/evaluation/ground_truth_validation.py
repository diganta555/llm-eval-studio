"""
Ground Truth Validation Module
==============================
Contains 32 carefully designed validation cases with known expected outcomes.
Each case specifies the metric to test, the expected score range, and the expected
pass/fail verdict. This allows us to measure the accuracy and trustworthiness
of our metric implementations without relying on live LLM scores as ground truth.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.evaluation.metrics import get_metric, MetricEvaluationResult

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class GroundTruthCase(BaseModel):
    id: str
    metric: str  # correctness | relevance | faithfulness | hallucination
    category: str  # e.g. "exact_match", "off_topic", "abstention", etc.
    question: str
    response_text: str
    expected_answer: Optional[str] = None
    context: Optional[str] = None
    expected_pass: bool
    expected_score_min: float
    expected_score_max: float
    description: str  # human-readable explanation of WHY this score is expected


class ValidationCaseResult(BaseModel):
    case_id: str
    metric: str
    category: str
    description: str
    expected_pass: bool
    expected_score_min: float
    expected_score_max: float
    actual_score: Optional[float]
    actual_pass: Optional[bool]
    actual_reason: str
    score_in_range: bool
    verdict_match: bool
    overall_ok: bool  # both score_in_range AND verdict_match


class ValidationSummary(BaseModel):
    total_cases: int
    passed_cases: int
    failed_cases: int
    accuracy_pct: float
    by_metric: Dict[str, Dict[str, Any]]
    results: List[ValidationCaseResult]


# ---------------------------------------------------------------------------
# Ground Truth Dataset  (32 cases)
# ---------------------------------------------------------------------------

GROUND_TRUTH_CASES: List[GroundTruthCase] = [
    # ======================================================================
    # CORRECTNESS  (8 cases)
    # ======================================================================
    GroundTruthCase(
        id="GT-COR-001",
        metric="correctness",
        category="exact_match",
        question="What is the capital of France?",
        response_text="Paris",
        expected_answer="Paris",
        expected_pass=True,
        expected_score_min=100.0,
        expected_score_max=100.0,
        description="Exact string match should score 100 deterministically."
    ),
    GroundTruthCase(
        id="GT-COR-002",
        metric="correctness",
        category="case_insensitive_match",
        question="What is Python?",
        response_text="  A High-Level Programming Language.  ",
        expected_answer="a high-level programming language.",
        expected_pass=True,
        expected_score_min=100.0,
        expected_score_max=100.0,
        description="Case-insensitive trimmed match should also score 100."
    ),
    GroundTruthCase(
        id="GT-COR-003",
        metric="correctness",
        category="high_overlap",
        question="What is an API?",
        response_text="An Application Programming Interface (API) is a set of rules and protocols enabling software applications to communicate with each other.",
        expected_answer="Application Programming Interface enables software applications to communicate with each other using protocols.",
        expected_pass=True,
        expected_score_min=90.0,
        expected_score_max=100.0,
        description="High keyword overlap with expected answer should score >= 90."
    ),
    GroundTruthCase(
        id="GT-COR-004",
        metric="correctness",
        category="partial_overlap",
        question="Explain machine learning.",
        response_text="Machine learning is a branch of AI that uses data to train algorithms.",
        expected_answer="Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed, using statistical techniques to identify patterns in data.",
        expected_pass=True,
        expected_score_min=60.0,
        expected_score_max=100.0,
        description="Partial overlap covers main ideas but misses detail."
    ),
    GroundTruthCase(
        id="GT-COR-005",
        metric="correctness",
        category="total_mismatch",
        question="What is quantum computing?",
        response_text="A recipe for making homemade Italian sourdough pizza with tomato sauce and mozzarella.",
        expected_answer="Quantum computing leverages quantum mechanics principles like superposition and entanglement to perform complex computations.",
        expected_pass=False,
        expected_score_min=0.0,
        expected_score_max=30.0,
        description="Completely off-topic response should score very low."
    ),
    GroundTruthCase(
        id="GT-COR-006",
        metric="correctness",
        category="empty_response",
        question="What is 2+2?",
        response_text="",
        expected_answer="4",
        expected_pass=False,
        expected_score_min=0.0,
        expected_score_max=30.0,
        description="Empty response should score low."
    ),
    GroundTruthCase(
        id="GT-COR-007",
        metric="correctness",
        category="contradicting_answer",
        question="Is the Earth flat?",
        response_text="Yes, the Earth is completely flat like a disc.",
        expected_answer="No, the Earth is an oblate spheroid.",
        expected_pass=False,
        expected_score_min=0.0,
        expected_score_max=55.0,
        description="Directly contradicting the expected answer should fail."
    ),
    GroundTruthCase(
        id="GT-COR-008",
        metric="correctness",
        category="no_expected_answer",
        question="What is the meaning of life?",
        response_text="The meaning of life is a philosophical question debated for centuries. Some say it is to seek happiness, others say it is to find purpose.",
        expected_answer=None,
        expected_pass=True,
        expected_score_min=70.0,
        expected_score_max=100.0,
        description="With no expected answer, a coherent response should pass."
    ),

    # ======================================================================
    # RELEVANCE  (8 cases)
    # ======================================================================
    GroundTruthCase(
        id="GT-REL-001",
        metric="relevance",
        category="directly_relevant",
        question="How do I sort a list in Python?",
        response_text="You can sort a list in Python using the built-in sorted() function or by calling the .sort() method directly on the list.",
        expected_pass=True,
        expected_score_min=85.0,
        expected_score_max=100.0,
        description="Directly addresses the specific question with concrete Python methods."
    ),
    GroundTruthCase(
        id="GT-REL-002",
        metric="relevance",
        category="completely_irrelevant",
        question="How do I sort a list in Python?",
        response_text="The Eiffel Tower was constructed in Paris between 1887 and 1889 as the entrance arch for the World's Fair.",
        expected_pass=False,
        expected_score_min=0.0,
        expected_score_max=55.0,
        description="About the Eiffel Tower when asked about Python sorting - completely irrelevant."
    ),
    GroundTruthCase(
        id="GT-REL-003",
        metric="relevance",
        category="tangentially_relevant",
        question="What are the benefits of using TypeScript?",
        response_text="JavaScript is a dynamic scripting language used in web browsers. It was created by Brendan Eich in 1995.",
        expected_pass=False,
        expected_score_min=30.0,
        expected_score_max=85.0,
        description="Talks about JavaScript (related) but doesn't address TypeScript benefits."
    ),
    GroundTruthCase(
        id="GT-REL-004",
        metric="relevance",
        category="overly_verbose",
        question="What is Docker?",
        response_text="Docker is a platform for developing, shipping, and running applications in containers. Containers are lightweight, portable environments. Docker uses a client-server architecture. The Docker daemon manages containers. Docker Hub is a registry for sharing images. Docker Compose orchestrates multi-container apps.",
        expected_pass=True,
        expected_score_min=80.0,
        expected_score_max=100.0,
        description="Verbose but topically relevant - should still pass."
    ),
    GroundTruthCase(
        id="GT-REL-005",
        metric="relevance",
        category="partial_answer",
        question="How do I connect to a PostgreSQL database using Python?",
        response_text="You can use the psycopg2 library to connect to PostgreSQL from Python.",
        expected_pass=True,
        expected_score_min=80.0,
        expected_score_max=100.0,
        description="Brief but directly answers the question with the right library."
    ),
    GroundTruthCase(
        id="GT-REL-006",
        metric="relevance",
        category="question_repetition",
        question="What is Kubernetes?",
        response_text="That is a great question about Kubernetes. Kubernetes is indeed interesting.",
        expected_pass=False,
        expected_score_min=40.0,
        expected_score_max=100.0,
        description="Repeats the question without providing substantive information."
    ),
    GroundTruthCase(
        id="GT-REL-007",
        metric="relevance",
        category="wrong_domain",
        question="How do I perform a SQL JOIN?",
        response_text="To bake a chocolate cake, preheat the oven to 350°F, mix flour, sugar, cocoa powder, and eggs together.",
        expected_pass=False,
        expected_score_min=0.0,
        expected_score_max=55.0,
        description="Cooking instructions when asked about SQL - total domain mismatch."
    ),
    GroundTruthCase(
        id="GT-REL-008",
        metric="relevance",
        category="concise_correct",
        question="What is the time complexity of binary search?",
        response_text="The time complexity of binary search is O(log n).",
        expected_pass=True,
        expected_score_min=80.0,
        expected_score_max=100.0,
        description="Short, precise, directly relevant answer."
    ),

    # ======================================================================
    # FAITHFULNESS  (8 cases)
    # ======================================================================
    GroundTruthCase(
        id="GT-FAI-001",
        metric="faithfulness",
        category="no_context",
        question="What is photosynthesis?",
        response_text="Photosynthesis is the process by which plants convert sunlight into chemical energy.",
        context=None,
        expected_pass=True,
        expected_score_min=-1.0,  # score will be None for not_applicable
        expected_score_max=-1.0,
        description="No context provided - must be marked not_applicable with score=None."
    ),
    GroundTruthCase(
        id="GT-FAI-002",
        metric="faithfulness",
        category="empty_context",
        question="What is photosynthesis?",
        response_text="Photosynthesis converts light to energy.",
        context="   ",
        expected_pass=True,
        expected_score_min=-1.0,
        expected_score_max=-1.0,
        description="Empty whitespace context - must also be not_applicable."
    ),
    GroundTruthCase(
        id="GT-FAI-003",
        metric="faithfulness",
        category="fully_supported",
        question="Tell me about NovaTech.",
        response_text="NovaTech was founded in 2018 in San Francisco. It focuses on cloud-native security orchestration.",
        context="NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration.",
        expected_pass=True,
        expected_score_min=80.0,
        expected_score_max=100.0,
        description="Every claim is directly supported by the context."
    ),
    GroundTruthCase(
        id="GT-FAI-004",
        metric="faithfulness",
        category="appropriate_abstention",
        question="What year was NovaTech founded?",
        response_text="The founding year of NovaTech is not mentioned in the provided reference context.",
        context="NovaTech offers enterprise firewall solutions. The CEO is Jane Doe.",
        expected_pass=True,
        expected_score_min=80.0,
        expected_score_max=100.0,
        description="Correctly abstains when info is absent from context."
    ),
    GroundTruthCase(
        id="GT-FAI-005",
        metric="faithfulness",
        category="fabricated_claims",
        question="Tell me about NovaTech.",
        response_text="NovaTech was founded in 1902 in Tokyo and is the world's largest manufacturer of orbital space elevators.",
        context="NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration.",
        expected_pass=False,
        expected_score_min=0.0,
        expected_score_max=60.0,
        description="Contradicts the context with fabricated year, city, and product."
    ),
    GroundTruthCase(
        id="GT-FAI-006",
        metric="faithfulness",
        category="mixed_claims",
        question="Describe Apollo 11.",
        response_text="Apollo 11 landed on the Moon on July 20, 1969. Neil Armstrong was commander. The mission carried a nuclear reactor for power.",
        context="Apollo 11 was the spaceflight that first landed humans on the Moon. Commander Neil Armstrong and lunar module pilot Buzz Aldrin landed the Apollo Lunar Module Eagle on July 20, 1969.",
        expected_pass=False,
        expected_score_min=30.0,
        expected_score_max=80.0,
        description="Two correct claims, one fabricated (nuclear reactor)."
    ),
    GroundTruthCase(
        id="GT-FAI-007",
        metric="faithfulness",
        category="paraphrase_supported",
        question="What does the company do?",
        response_text="The organization provides monitoring solutions for large enterprises worldwide.",
        context="NovaTech Solutions delivers real-time telemetry and database monitoring tools to Fortune 500 customers across North America and Europe.",
        expected_pass=True,
        expected_score_min=60.0,
        expected_score_max=100.0,
        description="Paraphrased but semantically aligned with context."
    ),
    GroundTruthCase(
        id="GT-FAI-008",
        metric="faithfulness",
        category="complete_fabrication",
        question="Tell me about the company.",
        response_text="The company was acquired by Microsoft in 2023 for $45 billion and renamed to Azure Cloud Services.",
        context="NovaTech Solutions is an independent enterprise cloud software company based in Seattle.",
        expected_pass=False,
        expected_score_min=0.0,
        expected_score_max=50.0,
        description="Entirely fabricated acquisition details with no basis in context."
    ),

    # ======================================================================
    # HALLUCINATION  (8 cases)
    # ======================================================================
    GroundTruthCase(
        id="GT-HAL-001",
        metric="hallucination",
        category="zero_hallucination",
        question="When did Apollo 11 land?",
        response_text="Apollo 11 landed on the Moon on July 20, 1969 with Neil Armstrong as commander.",
        context="Apollo 11 was the spaceflight that first landed humans on the Moon. Commander Neil Armstrong landed the Apollo Lunar Module Eagle on July 20, 1969.",
        expected_pass=True,
        expected_score_min=0.0,
        expected_score_max=15.0,
        description="Fully grounded in context - zero hallucination expected."
    ),
    GroundTruthCase(
        id="GT-HAL-002",
        metric="hallucination",
        category="full_hallucination",
        question="When was NovaTech founded?",
        response_text="NovaTech was founded in 1902 in Tokyo and developed the first steam locomotive engine for lunar transport.",
        context="NovaTech was founded in 2018 in San Francisco.",
        expected_pass=False,
        expected_score_min=40.0,
        expected_score_max=100.0,
        description="Wrong year, wrong city, fabricated product - heavy hallucination."
    ),
    GroundTruthCase(
        id="GT-HAL-003",
        metric="hallucination",
        category="abstention_zero_hallucination",
        question="What is the author's salary?",
        response_text="The document does not specify the author's personal salary.",
        context="The document describes database clustering algorithms.",
        expected_pass=True,
        expected_score_min=0.0,
        expected_score_max=5.0,
        description="Correct abstention is the opposite of hallucination."
    ),
    GroundTruthCase(
        id="GT-HAL-004",
        metric="hallucination",
        category="partial_hallucination",
        question="What does NovaTech do?",
        response_text="NovaTech provides cloud security tools and has 10,000 employees working across 50 countries.",
        context="NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration.",
        expected_pass=False,
        expected_score_min=20.0,
        expected_score_max=100.0,
        description="Cloud security is correct but employee count and countries are fabricated."
    ),
    GroundTruthCase(
        id="GT-HAL-005",
        metric="hallucination",
        category="no_reference",
        question="What is gravity?",
        response_text="Gravity is a fundamental force of nature that attracts objects with mass toward each other.",
        context=None,
        expected_answer="Gravity is the force of attraction between objects with mass.",
        expected_pass=True,
        expected_score_min=0.0,
        expected_score_max=15.0,
        description="No reference context, but answer aligns with expected answer - low hallucination."
    ),
    GroundTruthCase(
        id="GT-HAL-006",
        metric="hallucination",
        category="subtle_fabrication",
        question="Who founded NovaTech?",
        response_text="NovaTech was founded in 2018 in San Francisco by Dr. Emily Chen, a Stanford graduate.",
        context="NovaTech was founded in 2018 in San Francisco. It specializes in cloud-native security orchestration.",
        expected_pass=False,
        expected_score_min=15.0,
        expected_score_max=100.0,
        description="Year and city correct, but founder name is fabricated."
    ),
    GroundTruthCase(
        id="GT-HAL-007",
        metric="hallucination",
        category="grounded_paraphrase",
        question="What happened in 1610?",
        response_text="Galileo observed four moons around Jupiter using his telescope in 1610.",
        context="In January 1610, Italian astronomer Galileo Galilei directed his newly constructed refracting telescope toward Jupiter and discovered the four largest moons of Jupiter.",
        expected_pass=True,
        expected_score_min=0.0,
        expected_score_max=15.0,
        description="Paraphrase that is fully supported by context."
    ),
    GroundTruthCase(
        id="GT-HAL-008",
        metric="hallucination",
        category="invented_statistics",
        question="How popular is Python?",
        response_text="Python is used by 97.3% of all data scientists worldwide and was rated the #1 language by 100% of Fortune 500 CTOs.",
        context="Python is a popular general-purpose programming language widely used in data science and web development.",
        expected_pass=False,
        expected_score_min=30.0,
        expected_score_max=100.0,
        description="Fabricated precise statistics that appear nowhere in context."
    ),
]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_ground_truth_validation(force_mock: bool = True) -> ValidationSummary:
    """
    Runs all 32 ground truth cases through the metric engine and compares
    actual outputs to expected score ranges and verdicts.

    Args:
        force_mock: If True (default), uses deterministic mock judge to ensure
                    reproducible results. Set False to validate with live LLM judge.
    """
    results: List[ValidationCaseResult] = []
    metric_stats: Dict[str, Dict[str, int]] = {}

    for case in GROUND_TRUTH_CASES:
        metric_obj = get_metric(case.metric)

        # Run the metric
        eval_result: MetricEvaluationResult = metric_obj.evaluate(
            question=case.question,
            response_text=case.response_text,
            expected_answer=case.expected_answer,
            context=case.context,
            force_mock=force_mock,
        )

        actual_score = eval_result.score
        actual_pass = eval_result.passed

        # Special handling for faithfulness not_applicable cases
        if case.expected_score_min == -1.0 and case.expected_score_max == -1.0:
            # We expect score=None (not_applicable)
            score_in_range = actual_score is None
            verdict_match = actual_pass is None or actual_pass is True  # either None or True is acceptable
        else:
            score_in_range = (
                actual_score is not None
                and case.expected_score_min <= actual_score <= case.expected_score_max
            )
            verdict_match = actual_pass == case.expected_pass

        overall_ok = score_in_range and verdict_match

        results.append(ValidationCaseResult(
            case_id=case.id,
            metric=case.metric,
            category=case.category,
            description=case.description,
            expected_pass=case.expected_pass,
            expected_score_min=case.expected_score_min,
            expected_score_max=case.expected_score_max,
            actual_score=actual_score,
            actual_pass=actual_pass,
            actual_reason=eval_result.reason,
            score_in_range=score_in_range,
            verdict_match=verdict_match,
            overall_ok=overall_ok,
        ))

        # Aggregate per-metric stats
        if case.metric not in metric_stats:
            metric_stats[case.metric] = {"total": 0, "passed": 0, "failed": 0}
        metric_stats[case.metric]["total"] += 1
        if overall_ok:
            metric_stats[case.metric]["passed"] += 1
        else:
            metric_stats[case.metric]["failed"] += 1

    total = len(results)
    passed = sum(1 for r in results if r.overall_ok)
    failed = total - passed

    by_metric = {}
    for m_name, stats in metric_stats.items():
        by_metric[m_name] = {
            "total": stats["total"],
            "passed": stats["passed"],
            "failed": stats["failed"],
            "accuracy_pct": round(stats["passed"] / max(1, stats["total"]) * 100, 1),
        }

    return ValidationSummary(
        total_cases=total,
        passed_cases=passed,
        failed_cases=failed,
        accuracy_pct=round(passed / max(1, total) * 100, 1),
        by_metric=by_metric,
        results=results,
    )
