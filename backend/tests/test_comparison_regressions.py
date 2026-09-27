import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

from app.db.base import Base
from app.db.models import (
    Project, Dataset, TestCase, ModelConfig, EvaluationRun, CaseResult, MetricResult
)
from app.services.run_service import compare_evaluation_runs

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def create_mock_project_and_dataset(db):
    proj = Project(name="QA Test Project", description="Test")
    db.add(proj)
    db.commit()

    ds = Dataset(project_id=proj.id, name="Benchmark Dataset", version=1)
    db.add(ds)
    db.commit()

    tc1 = TestCase(dataset_id=ds.id, external_id="case-1", question="Q1", expected_answer="A1", category="general")
    tc2 = TestCase(dataset_id=ds.id, external_id="case-2", question="Q2", expected_answer="A2", category="general")
    db.add_all([tc1, tc2])
    db.commit()

    model_a = ModelConfig(project_id=proj.id, name="Baseline Model", provider="mock", model_name="model-a")
    model_b = ModelConfig(project_id=proj.id, name="Candidate Model", provider="mock", model_name="model-b")
    db.add_all([model_a, model_b])
    db.commit()

    return proj, ds, [tc1, tc2], model_a, model_b

class TestComparisonAndRegressionCalculations:
    def test_baseline_vs_degraded_candidate_regressions(self, db_session):
        proj, ds, test_cases, model_a, model_b = create_mock_project_and_dataset(db_session)

        # Baseline Run (High Quality: 95% Correctness, 10% Hallucination, 1200ms latency, 100 tokens)
        run_a = EvaluationRun(
            project_id=proj.id, dataset_id=ds.id, model_config_id=model_a.id,
            status="completed", total_cases=2, completed_cases=2
        )
        db_session.add(run_a)
        db_session.commit()

        # Run A Cases
        cr_a1 = CaseResult(run_id=run_a.id, test_case_id=test_cases[0].id, status="completed", latency_ms=1000.0, total_tokens=50, output_text="Good output 1")
        cr_a2 = CaseResult(run_id=run_a.id, test_case_id=test_cases[1].id, status="completed", latency_ms=1400.0, total_tokens=50, output_text="Good output 2")
        db_session.add_all([cr_a1, cr_a2])
        db_session.commit()

        db_session.add_all([
            MetricResult(case_result_id=cr_a1.id, metric_name="correctness", score=95.0, passed=True, reason="ok"),
            MetricResult(case_result_id=cr_a1.id, metric_name="hallucination", score=10.0, passed=True, reason="ok"),
            MetricResult(case_result_id=cr_a2.id, metric_name="correctness", score=95.0, passed=True, reason="ok"),
            MetricResult(case_result_id=cr_a2.id, metric_name="hallucination", score=10.0, passed=True, reason="ok"),
        ])
        db_session.commit()

        # Degraded Candidate Run (Degraded Quality: 40% Correctness, 60% Hallucination, 2400ms latency, 200 tokens)
        run_b = EvaluationRun(
            project_id=proj.id, dataset_id=ds.id, model_config_id=model_b.id,
            status="completed", total_cases=2, completed_cases=2
        )
        db_session.add(run_b)
        db_session.commit()

        # Run B Cases: Case 1 heavily degraded (40 vs 95 -> drop > 5pts -> regressed), Case 2 moderately degraded (60 vs 95)
        cr_b1 = CaseResult(run_id=run_b.id, test_case_id=test_cases[0].id, status="completed", latency_ms=2000.0, total_tokens=100, output_text="Degraded output 1")
        cr_b2 = CaseResult(run_id=run_b.id, test_case_id=test_cases[1].id, status="completed", latency_ms=2800.0, total_tokens=100, output_text="Degraded output 2")
        db_session.add_all([cr_b1, cr_b2])
        db_session.commit()

        db_session.add_all([
            MetricResult(case_result_id=cr_b1.id, metric_name="correctness", score=40.0, passed=False, reason="bad"),
            MetricResult(case_result_id=cr_b1.id, metric_name="hallucination", score=60.0, passed=False, reason="hallucinated"),
            MetricResult(case_result_id=cr_b2.id, metric_name="correctness", score=60.0, passed=False, reason="bad"),
            MetricResult(case_result_id=cr_b2.id, metric_name="hallucination", score=60.0, passed=False, reason="hallucinated"),
        ])
        db_session.commit()

        # Compare Runs
        comp = compare_evaluation_runs(db_session, run_a.id, run_b.id)

        assert comp.compatible is True
        assert comp.compatibility_reason is None

        # Correctness comparison: 95.0 vs 50.0 -> delta = -45.0, delta_percent = -47.4%, improved = False
        corr_comp = next(m for m in comp.metrics if m.metric_name == "correctness")
        assert corr_comp.run_a_score == 95.0
        assert corr_comp.run_b_score == 50.0
        assert corr_comp.delta == -45.0
        assert corr_comp.improved is False

        # Hallucination comparison: 10.0 vs 60.0 -> delta = +50.0 -> improved MUST be False because lower is better!
        hall_comp = next(m for m in comp.metrics if m.metric_name == "hallucination")
        assert hall_comp.run_a_score == 10.0
        assert hall_comp.run_b_score == 60.0
        assert hall_comp.delta == 50.0
        assert hall_comp.improved is False

        # Latency shift: 1200ms vs 2400ms -> latency_delta_ms = +1200.0
        assert comp.mean_latency_a_ms == 1200.0
        assert comp.mean_latency_b_ms == 2400.0
        assert comp.latency_delta_ms == 1200.0

        # Token shift: 100 vs 200 -> token_delta = +100
        assert comp.total_tokens_a == 100
        assert comp.total_tokens_b == 200
        assert comp.token_delta == 100

        # Verify Regression Flags on Case Rows (> 5 pt drop)
        assert len(comp.cases) == 2
        for case_row in comp.cases:
            assert case_row.regressed is True
            assert case_row.improved is False

    def test_improved_candidate_regression_flags(self, db_session):
        proj, ds, test_cases, model_a, model_b = create_mock_project_and_dataset(db_session)

        run_a = EvaluationRun(project_id=proj.id, dataset_id=ds.id, model_config_id=model_a.id, status="completed")
        run_b = EvaluationRun(project_id=proj.id, dataset_id=ds.id, model_config_id=model_b.id, status="completed")
        db_session.add_all([run_a, run_b])
        db_session.commit()

        # Run A: Correctness 60
        cr_a = CaseResult(run_id=run_a.id, test_case_id=test_cases[0].id, status="completed")
        # Run B: Correctness 95 (Rise > 5pts -> improved = True)
        cr_b = CaseResult(run_id=run_b.id, test_case_id=test_cases[0].id, status="completed")
        db_session.add_all([cr_a, cr_b])
        db_session.commit()

        db_session.add_all([
            MetricResult(case_result_id=cr_a.id, metric_name="correctness", score=60.0, passed=False),
            MetricResult(case_result_id=cr_b.id, metric_name="correctness", score=95.0, passed=True),
        ])
        db_session.commit()

        comp = compare_evaluation_runs(db_session, run_a.id, run_b.id)
        assert comp.cases[0].improved is True
        assert comp.cases[0].regressed is False

    def test_incompatible_datasets_comparison(self, db_session):
        proj, ds1, test_cases, model_a, model_b = create_mock_project_and_dataset(db_session)
        ds2 = Dataset(project_id=proj.id, name="Different Dataset", version=1)
        db_session.add(ds2)
        db_session.commit()

        run_a = EvaluationRun(project_id=proj.id, dataset_id=ds1.id, model_config_id=model_a.id, status="completed")
        run_b = EvaluationRun(project_id=proj.id, dataset_id=ds2.id, model_config_id=model_b.id, status="completed")
        db_session.add_all([run_a, run_b])
        db_session.commit()

        comp = compare_evaluation_runs(db_session, run_a.id, run_b.id)
        assert comp.compatible is False
        assert "different datasets" in comp.compatibility_reason.lower()

    def test_zero_and_missing_values_in_comparison(self, db_session):
        proj, ds, test_cases, model_a, model_b = create_mock_project_and_dataset(db_session)

        run_a = EvaluationRun(project_id=proj.id, dataset_id=ds.id, model_config_id=model_a.id, status="completed")
        run_b = EvaluationRun(project_id=proj.id, dataset_id=ds.id, model_config_id=model_b.id, status="completed")
        db_session.add_all([run_a, run_b])
        db_session.commit()

        # Run A has 0 score, Run B has 50 score
        cr_a = CaseResult(run_id=run_a.id, test_case_id=test_cases[0].id, status="completed")
        cr_b = CaseResult(run_id=run_b.id, test_case_id=test_cases[0].id, status="completed")
        db_session.add_all([cr_a, cr_b])
        db_session.commit()

        db_session.add_all([
            MetricResult(case_result_id=cr_a.id, metric_name="correctness", score=0.0, passed=False),
            MetricResult(case_result_id=cr_b.id, metric_name="correctness", score=50.0, passed=True),
        ])
        db_session.commit()

        # When score_a == 0.0, delta_percent should not raise ZeroDivisionError and should be handled cleanly
        comp = compare_evaluation_runs(db_session, run_a.id, run_b.id)
        corr_comp = next(m for m in comp.metrics if m.metric_name == "correctness")
        assert corr_comp.run_a_score == 0.0
        assert corr_comp.run_b_score == 50.0
        assert corr_comp.delta == 50.0
        assert corr_comp.delta_percent is None  # Handled safely without ZeroDivisionError
