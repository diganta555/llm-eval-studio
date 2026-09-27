import json
import csv
import io
from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.models import Dataset, TestCase
from app.schemas.dataset import (
    TestCaseCreate, DatasetImportPreview, DatasetRowValidationError
)

def parse_and_validate_dataset_content(
    content: str,
    file_type: str = "json"
) -> Tuple[List[TestCaseCreate], List[DatasetRowValidationError]]:
    """
    Parses JSON or CSV raw content, validates schema, enforces unique external_id,
    and returns parsed valid test cases and row-level validation errors.
    """
    valid_cases: List[TestCaseCreate] = []
    errors: List[DatasetRowValidationError] = []
    seen_ids = set()

    raw_rows: List[Dict[str, Any]] = []

    if file_type == "json":
        try:
            data = json.loads(content)
            if not isinstance(data, list):
                errors.append(DatasetRowValidationError(
                    row_index=0,
                    error="JSON root must be an array of test case objects."
                ))
                return valid_cases, errors
            raw_rows = data
        except Exception as e:
            errors.append(DatasetRowValidationError(
                row_index=0,
                error=f"Malformed JSON: {str(e)}"
            ))
            return valid_cases, errors

    elif file_type == "csv":
        try:
            reader = csv.DictReader(io.StringIO(content))
            raw_rows = list(reader)
        except Exception as e:
            errors.append(DatasetRowValidationError(
                row_index=0,
                error=f"Malformed CSV: {str(e)}"
            ))
            return valid_cases, errors
    else:
        errors.append(DatasetRowValidationError(
            row_index=0,
            error=f"Unsupported file format: {file_type}. Supported: json, csv."
        ))
        return valid_cases, errors

    if len(raw_rows) > 500:
        errors.append(DatasetRowValidationError(
            row_index=0,
            error="Dataset exceeds maximum allowed limit of 500 test cases per version."
        ))
        return valid_cases, errors

    for idx, row in enumerate(raw_rows, start=1):
        if not isinstance(row, dict):
            errors.append(DatasetRowValidationError(
                row_index=idx,
                error="Row item must be an object/dictionary."
            ))
            continue

        ext_id = str(row.get("external_id", "")).strip() or f"case-{idx}"
        question = str(row.get("question", "")).strip()
        expected = row.get("expected_answer")
        expected_str = str(expected).strip() if expected is not None and str(expected).strip() else None
        context = row.get("context")
        context_str = str(context).strip() if context is not None and str(context).strip() else None
        category = str(row.get("category", "general")).strip() or "general"
        
        meta = row.get("metadata") or row.get("case_metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {"raw": meta}
        elif not isinstance(meta, dict):
            meta = {}

        if not question:
            errors.append(DatasetRowValidationError(
                row_index=idx,
                external_id=ext_id,
                error="Field 'question' is required and cannot be empty."
            ))
            continue

        if ext_id in seen_ids:
            errors.append(DatasetRowValidationError(
                row_index=idx,
                external_id=ext_id,
                error=f"Duplicate external_id '{ext_id}' in dataset."
            ))
            continue

        seen_ids.add(ext_id)
        valid_cases.append(TestCaseCreate(
            external_id=ext_id,
            question=question,
            expected_answer=expected_str,
            context=context_str,
            category=category,
            case_metadata=meta,
            enabled=bool(row.get("enabled", True))
        ))

    return valid_cases, errors

def create_dataset_version(
    db: Session,
    project_id: str,
    name: str,
    test_cases: List[TestCaseCreate],
    source_filename: Optional[str] = None
) -> Dataset:
    """
    Creates a new immutable dataset version under a project.
    Calculates next version number automatically.
    """
    latest_dataset = (
        db.query(Dataset)
        .filter(Dataset.project_id == project_id, Dataset.name == name)
        .order_by(Dataset.version.desc())
        .first()
    )
    next_version = (latest_dataset.version + 1) if latest_dataset else 1

    dataset = Dataset(
        project_id=project_id,
        name=name,
        version=next_version,
        source_filename=source_filename
    )
    db.add(dataset)
    db.flush()

    for tc in test_cases:
        test_case_obj = TestCase(
            dataset_id=dataset.id,
            external_id=tc.external_id,
            question=tc.question,
            expected_answer=tc.expected_answer,
            context=tc.context,
            category=tc.category,
            case_metadata=tc.case_metadata,
            enabled=tc.enabled
        )
        db.add(test_case_obj)

    db.commit()
    db.refresh(dataset)
    return dataset
