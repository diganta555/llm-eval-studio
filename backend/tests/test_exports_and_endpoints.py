import io
import csv
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.db.models import (
    Project, Dataset, TestCase, ModelConfig, EvaluationRun, CaseResult, MetricResult
)

@pytest.fixture
def client_and_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine)
    db = TestingSessionLocal()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client, db
    app.dependency_overrides.clear()
    db.close()

class TestExportsAndAPIEndpoints:
    def test_csv_export_accuracy_against_db(self, client_and_db):
        client, db = client_and_db

        proj = Project(name="Export Test Proj")
        db.add(proj)
        db.commit()

        ds = Dataset(project_id=proj.id, name="Export Benchmark", version=1)
        db.add(ds)
        db.commit()

        tc = TestCase(dataset_id=ds.id, external_id="exp-001", question="What is 2+2?", expected_answer="4", category="math")
        model = ModelConfig(project_id=proj.id, name="GPT-4o-mini", provider="mock", model_name="gpt-4o-mini")
        db.add_all([tc, model])
        db.commit()

        run = EvaluationRun(project_id=proj.id, dataset_id=ds.id, model_config_id=model.id, status="completed", total_cases=1, completed_cases=1)
        db.add(run)
        db.commit()

        cr = CaseResult(run_id=run.id, test_case_id=tc.id, status="completed", output_text="The answer is 4.", latency_ms=450.0, prompt_tokens=15, completion_tokens=5, total_tokens=20)
        db.add(cr)
        db.commit()

        db.add_all([
            MetricResult(case_result_id=cr.id, metric_name="correctness", score=100.0, passed=True),
            MetricResult(case_result_id=cr.id, metric_name="relevance", score=95.0, passed=True),
            MetricResult(case_result_id=cr.id, metric_name="faithfulness", score=None, passed=None),
            MetricResult(case_result_id=cr.id, metric_name="hallucination", score=0.0, passed=True),
        ])
        db.commit()

        response = client.get(f"/api/v1/runs/{run.id}/export?format=csv")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

        csv_reader = csv.DictReader(io.StringIO(response.text))
        rows = list(csv_reader)
        assert len(rows) == 1

        row = rows[0]
        assert row["external_id"] == "exp-001"
        assert row["question"] == "What is 2+2?"
        assert row["expected_answer"] == "4"
        assert row["model_output"] == "The answer is 4."
        assert row["status"] == "completed"
        assert float(row["latency_ms"]) == 450.0
        assert int(row["total_tokens"]) == 20
        assert float(row["correctness_score"]) == 100.0
        assert float(row["relevance_score"]) == 95.0
        assert row["faithfulness_score"] == ""  # Score is None, should export as empty string
        assert float(row["hallucination_score"]) == 0.0

    def test_json_export_accuracy_against_db(self, client_and_db):
        client, db = client_and_db

        proj = Project(name="JSON Export Proj")
        db.add(proj)
        db.commit()

        ds = Dataset(project_id=proj.id, name="JSON Benchmark", version=1)
        db.add(ds)
        db.commit()

        tc = TestCase(dataset_id=ds.id, external_id="json-001", question="What is HTTP?", expected_answer="Hypertext Transfer Protocol")
        model = ModelConfig(project_id=proj.id, name="Mock Model", provider="mock", model_name="mock-model")
        db.add_all([tc, model])
        db.commit()

        run = EvaluationRun(project_id=proj.id, dataset_id=ds.id, model_config_id=model.id, status="completed", total_cases=1, completed_cases=1)
        db.add(run)
        db.commit()

        cr = CaseResult(run_id=run.id, test_case_id=tc.id, status="completed", output_text="HTTP stands for Hypertext Transfer Protocol.", latency_ms=300.0, total_tokens=18)
        db.add(cr)
        db.commit()

        db.add(MetricResult(case_result_id=cr.id, metric_name="correctness", score=95.0, passed=True, reason="Factually accurate"))
        db.commit()

        response = client.get(f"/api/v1/runs/{run.id}/export?format=json")
        assert response.status_code == 200
        assert "application/json" in response.headers["content-type"]

        data = response.json()
        assert "summary" in data
        assert "results" in data
        assert len(data["results"]) == 1
        assert data["results"][0]["external_id"] == "json-001"
        assert data["results"][0]["metrics"]["correctness"]["score"] == 95.0
        assert data["results"][0]["metrics"]["correctness"]["passed"] is True

    def test_delete_run_api_endpoint(self, client_and_db):
        client, db = client_and_db

        proj = Project(name="Delete Test Proj")
        db.add(proj)
        db.commit()

        ds = Dataset(project_id=proj.id, name="Delete Benchmark", version=1)
        model = ModelConfig(project_id=proj.id, name="Mock Model", provider="mock", model_name="mock-model")
        db.add_all([ds, model])
        db.commit()

        run = EvaluationRun(project_id=proj.id, dataset_id=ds.id, model_config_id=model.id, status="failed")
        db.add(run)
        db.commit()

        # Delete run
        del_res = client.delete(f"/api/v1/runs/{run.id}")
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

        # Verify 404 on subsequent get
        get_res = client.get(f"/api/v1/runs/{run.id}")
        assert get_res.status_code == 404
