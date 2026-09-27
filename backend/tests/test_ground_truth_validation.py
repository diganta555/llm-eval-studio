import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.db.models import Project

client = TestClient(app)

@pytest.fixture(scope="module")
def test_project_id():
    db = SessionLocal()
    proj = db.query(Project).first()
    if not proj:
        proj = Project(name="Validation Test Project", description="Test project for GT validation")
        db.add(proj)
        db.commit()
        db.refresh(proj)
    p_id = proj.id
    db.close()
    return p_id


def test_seed_sample_validation_dataset(test_project_id):
    """Test seeding 30 provisional cases for a project."""
    response = client.post(f"/api/v1/validation/projects/{test_project_id}/datasets/seed-sample")
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["case_count"] == 30
    assert data["name"] == "Sample Ground Truth Dataset (Provisional)"


def test_list_and_detail_validation_datasets(test_project_id):
    """Test listing validation datasets and retrieving full detail."""
    list_res = client.get(f"/api/v1/validation/projects/{test_project_id}/datasets")
    assert list_res.status_code == 200
    datasets = list_res.json()
    assert len(datasets) >= 1
    dataset_id = datasets[0]["id"]

    detail_res = client.get(f"/api/v1/validation/datasets/{dataset_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == dataset_id
    assert len(detail["cases"]) == 30


def test_case_result_consistency_30_evaluated_30_rows(test_project_id):
    """
    Test requirement 6: Total evaluated cases and displayed result rows must be consistent.
    All 30 cases (including case 17 without context) must be present in case_results.
    """
    # Seed a fresh dataset
    seed_res = client.post(f"/api/v1/validation/projects/{test_project_id}/datasets/seed-sample")
    dataset_id = seed_res.json()["id"]

    run_payload = {
        "dataset_id": dataset_id,
        "include_unreviewed": True,
        "force_mock": True,
    }
    run_res = client.post(f"/api/v1/validation/projects/{test_project_id}/runs", json=run_payload)
    assert run_res.status_code == 200
    run_id = run_res.json()["id"]

    detail_res = client.get(f"/api/v1/validation/runs/{run_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()

    # Total cases evaluated must equal total case results returned
    assert detail["total_cases"] == 30
    assert len(detail["case_results"]) == 30
    assert detail["results_summary"]["overall"]["total_cases"] == 30

    # Verify that case 17 (no_context) is present and marked with explanation
    no_context_case = next((cr for cr in detail["case_results"] if cr["category"] == "no_context"), None)
    assert no_context_case is not None
    assert no_context_case["metric"] == "faithfulness"
    assert no_context_case["predicted_pass"] is None
    assert "not_applicable" in no_context_case["explanation"]


def test_provisional_status_when_no_reviewed_cases(test_project_id):
    """
    Test requirements 1, 2, 4, 8:
    When 0 of 30 cases are reviewed, metrics must NEVER be marked VALIDATED.
    They must be marked PROVISIONAL, verified accuracy must be None, and 93.1%
    must be labeled as provisional_accuracy.
    """
    seed_res = client.post(f"/api/v1/validation/projects/{test_project_id}/datasets/seed-sample")
    dataset_id = seed_res.json()["id"]

    run_payload = {
        "dataset_id": dataset_id,
        "include_unreviewed": True,
        "force_mock": True,
    }
    run_res = client.post(f"/api/v1/validation/projects/{test_project_id}/runs", json=run_payload)
    assert run_res.status_code == 200
    run_id = run_res.json()["id"]

    detail_res = client.get(f"/api/v1/validation/runs/{run_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()

    overall = detail["results_summary"]["overall"]
    assert overall["reviewed_cases"] == 0
    assert overall["is_provisional"] is True
    assert overall["status"] == "provisional"
    assert overall["verified_accuracy"] is None
    assert overall["provisional_accuracy"] == 93.1  # 27 / 29 = 93.1% provisional agreement!

    # Check each metric status: MUST NOT BE VALIDATED
    for mr in detail["metric_results"]:
        assert mr["status"] == "provisional"
        assert mr["status"] != "validated"
        assert mr["reviewed_count"] == 0
        assert mr["accuracy"] is None  # Verified accuracy is None
        assert mr["true_positives"] == 0
        assert mr["false_positives"] == 0
        assert mr["true_negatives"] == 0
        assert mr["false_negatives"] == 0
        # Provisional metrics are populated
        assert mr["provisional_accuracy"] is not None
        assert mr["sample_size_explanation"] != ""


def test_insufficient_reviewed_cases_status(test_project_id):
    """
    Test requirements 1, 8, 9:
    When only 1 of 30 cases is reviewed (< 5 threshold), status must be
    INSUFFICIENT_DATA and NOT VALIDATED.
    """
    seed_res = client.post(f"/api/v1/validation/projects/{test_project_id}/datasets/seed-sample")
    dataset_id = seed_res.json()["id"]

    # Review exactly 1 case
    detail_res = client.get(f"/api/v1/validation/datasets/{dataset_id}")
    case = detail_res.json()["cases"][0]
    client.put(f"/api/v1/validation/cases/{case['id']}", json={
        "review_status": "reviewed",
        "reviewed_by": "QA Lead",
    })

    # Run validation
    run_payload = {
        "dataset_id": dataset_id,
        "include_unreviewed": True,
        "force_mock": True,
    }
    run_res = client.post(f"/api/v1/validation/projects/{test_project_id}/runs", json=run_payload)
    assert run_res.status_code == 200
    run_id = run_res.json()["id"]

    detail_res = client.get(f"/api/v1/validation/runs/{run_id}")
    detail = detail_res.json()
    overall = detail["results_summary"]["overall"]

    assert overall["reviewed_cases"] == 1
    assert overall["status"] == "insufficient_data"
    assert "insufficient" in overall["status_notice"].lower()

    # The metric for case 0 (correctness) has 1 reviewed case -> insufficient_data
    correctness = next(m for m in detail["metric_results"] if m["metric_name"] == "correctness")
    assert correctness["status"] == "insufficient_data"
    assert correctness["reviewed_count"] == 1
    assert correctness["accuracy"] == 100.0  # 1/1 verified
    assert "insufficient" in correctness["status_notice"].lower()


def test_adequate_reviewed_cases_reaches_validated(test_project_id):
    """
    Test requirement 1 & 8:
    When >= 5 cases are reviewed for a metric and accuracy >= 80%,
    the metric transitions to VALIDATED.
    """
    seed_res = client.post(f"/api/v1/validation/projects/{test_project_id}/datasets/seed-sample")
    dataset_id = seed_res.json()["id"]

    detail_res = client.get(f"/api/v1/validation/datasets/{dataset_id}")
    cases = detail_res.json()["cases"]

    # Review 5 correctness cases (first 5 cases are correctness)
    for i in range(5):
        client.put(f"/api/v1/validation/cases/{cases[i]['id']}", json={
            "review_status": "reviewed",
            "reviewed_by": "Senior QA Engineer",
        })

    run_payload = {
        "dataset_id": dataset_id,
        "include_unreviewed": True,
        "force_mock": True,
    }
    run_res = client.post(f"/api/v1/validation/projects/{test_project_id}/runs", json=run_payload)
    run_id = run_res.json()["id"]

    detail_res = client.get(f"/api/v1/validation/runs/{run_id}")
    detail = detail_res.json()

    correctness = next(m for m in detail["metric_results"] if m["metric_name"] == "correctness")
    assert correctness["status"] == "validated"
    assert correctness["reviewed_count"] == 5
    assert correctness["accuracy"] is not None
    assert correctness["true_positives"] + correctness["true_negatives"] + correctness["false_positives"] + correctness["false_negatives"] == 5

    # Other metrics with 0 reviewed cases remain provisional
    relevance = next(m for m in detail["metric_results"] if m["metric_name"] == "relevance")
    assert relevance["status"] == "provisional"
    assert relevance["reviewed_count"] == 0


def test_confusion_matrix_denominators_and_sample_sizes(test_project_id):
    """
    Test requirements 5 & 7:
    Confusion matrix denominators match eligible cases for each metric.
    Faithfulness explains why 1 case is excluded due to lack of reference context.
    """
    seed_res = client.post(f"/api/v1/validation/projects/{test_project_id}/datasets/seed-sample")
    dataset_id = seed_res.json()["id"]

    run_res = client.post(f"/api/v1/validation/projects/{test_project_id}/runs", json={
        "dataset_id": dataset_id,
        "include_unreviewed": True,
        "force_mock": True,
    })
    run_id = run_res.json()["id"]

    detail_res = client.get(f"/api/v1/validation/runs/{run_id}")
    detail = detail_res.json()

    metrics = {m["metric_name"]: m for m in detail["metric_results"]}

    # Correctness: 8 cases, 8 eligible
    c = metrics["correctness"]
    assert c["sample_count"] == 8
    assert c["provisional_true_positives"] + c["provisional_false_positives"] + c["provisional_true_negatives"] + c["provisional_false_negatives"] == 8

    # Relevance: 8 cases, 8 eligible
    r = metrics["relevance"]
    assert r["sample_count"] == 8
    assert r["provisional_true_positives"] + r["provisional_false_positives"] + r["provisional_true_negatives"] + r["provisional_false_negatives"] == 8

    # Faithfulness: 7 cases, 6 eligible, 1 NA
    f = metrics["faithfulness"]
    assert f["sample_count"] == 7
    assert f["na_count"] == 1
    assert f["provisional_true_positives"] + f["provisional_false_positives"] + f["provisional_true_negatives"] + f["provisional_false_negatives"] == 6
    assert "not applicable" in f["sample_size_explanation"].lower()

    # Hallucination: 7 cases, 7 eligible
    h = metrics["hallucination"]
    assert h["sample_count"] == 7
    assert h["provisional_true_positives"] + h["provisional_false_positives"] + h["provisional_true_negatives"] + h["provisional_false_negatives"] == 7
