import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import MagicMock, patch

from app.db.base import Base
from app.db.models import (
    Project, Dataset, TestCase, ModelConfig, EvaluationRun, CaseResult
)
from app.schemas.run import RunCreate
from app.services.run_service import create_evaluation_run
from app.services.dataset_service import parse_and_validate_dataset_content
from app.evaluation.runner import execute_evaluation_run
from app.providers.base import GenerationResult

@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

class TestErrorHandlingAndEdgeCases:
    def test_empty_dataset_run_creation_rejected(self, db_session):
        proj = Project(name="Test Project")
        db_session.add(proj)
        db_session.commit()

        # Dataset with 0 test cases
        ds = Dataset(project_id=proj.id, name="Empty Dataset", version=1)
        model = ModelConfig(project_id=proj.id, name="Test Model", provider="mock", model_name="mock-model")
        db_session.add_all([ds, model])
        db_session.commit()

        req = RunCreate(
            project_id=proj.id,
            dataset_id=ds.id,
            model_config_id=model.id,
            metrics=["correctness"]
        )

        with pytest.raises(ValueError, match="0 enabled test cases"):
            create_evaluation_run(db_session, req)

    def test_malformed_dataset_json_validation_errors(self):
        # Missing required 'question' field
        raw_invalid_json = '[{"external_id": "test-1", "expected_answer": "42"}]'
        cases, errors = parse_and_validate_dataset_content(raw_invalid_json, "json")
        assert len(errors) > 0
        assert "question" in errors[0].error.lower()

    def test_malformed_csv_validation_errors(self):
        raw_csv_missing_question = "external_id,expected_answer\n1,Paris"
        cases, errors = parse_and_validate_dataset_content(raw_csv_missing_question, "csv")
        assert len(errors) > 0
        assert any("question" in err.error.lower() for err in errors)

    def test_partial_evaluation_failure_handling(self, db_session):
        """Simulates 1 successful generation and 1 provider error (e.g. timeout / rate limit)."""
        proj = Project(name="Partial Error Project")
        db_session.add(proj)
        db_session.commit()

        ds = Dataset(project_id=proj.id, name="Test DS", version=1)
        db_session.add(ds)
        db_session.commit()

        tc1 = TestCase(dataset_id=ds.id, external_id="case-1", question="Q1", expected_answer="A1")
        tc2 = TestCase(dataset_id=ds.id, external_id="case-2", question="Q2", expected_answer="A2")
        model = ModelConfig(project_id=proj.id, name="Mock Model", provider="mock", model_name="mock-model")
        db_session.add_all([tc1, tc2, model])
        db_session.commit()

        req = RunCreate(
            project_id=proj.id,
            dataset_id=ds.id,
            model_config_id=model.id,
            metrics=["correctness"]
        )
        run = create_evaluation_run(db_session, req)

        # Mock provider where case 1 succeeds, case 2 fails with timeout
        mock_provider = MagicMock()
        mock_provider.generate.side_effect = [
            GenerationResult(text="Valid answer 1", latency_ms=500.0, prompt_tokens=10, completion_tokens=10, total_tokens=20, is_mock=True),
            GenerationResult(text="", error="Provider request timed out after 45.0s", latency_ms=45000.0, is_mock=True)
        ]

        TestingSessionLocal = sessionmaker(bind=db_session.get_bind())

        with patch("app.evaluation.runner.SessionLocal", side_effect=TestingSessionLocal), \
             patch("app.evaluation.runner.get_provider", return_value=mock_provider):
            execute_evaluation_run(run.id)

        # Query using a fresh session from the engine
        fresh_db = TestingSessionLocal()
        refreshed_run = fresh_db.query(EvaluationRun).filter(EvaluationRun.id == run.id).first()

        assert refreshed_run.status == "completed_with_errors"
        assert refreshed_run.completed_cases == 1
        assert refreshed_run.failed_cases == 1

        case_results = fresh_db.query(CaseResult).filter(CaseResult.run_id == run.id).all()
        assert len(case_results) == 2

        failed_case = next(c for c in case_results if c.status == "failed")
        assert failed_case.error_code == "GENERATION_ERROR"
        assert "timed out" in failed_case.error_message
        fresh_db.close()
