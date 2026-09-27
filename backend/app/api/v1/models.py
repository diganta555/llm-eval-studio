import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import ModelConfig, Project
from app.schemas.model_config import (
    ModelConfigCreate, ModelConfigResponse, ModelConnectionTestRequest, ModelConnectionTestResponse
)
from app.core.config import settings
from app.providers import get_provider

router = APIRouter(tags=["models"])

@router.post("/projects/{project_id}/models", response_model=ModelConfigResponse, status_code=201)
def create_model_config(
    project_id: str,
    data: ModelConfigCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    model_config = ModelConfig(
        project_id=project_id,
        name=data.name,
        provider=data.provider,
        model_name=data.model_name,
        parameters=data.parameters,
        secret_reference=data.secret_reference
    )
    db.add(model_config)
    db.commit()
    db.refresh(model_config)

    has_key = True
    if data.provider == "openai":
        has_key = bool(settings.OPENAI_API_KEY)
    elif data.provider in ("anthropic", "claude"):
        has_key = bool(settings.ANTHROPIC_API_KEY)

    return ModelConfigResponse(
        id=model_config.id,
        project_id=model_config.project_id,
        name=model_config.name,
        provider=model_config.provider,
        model_name=model_config.model_name,
        parameters=model_config.parameters,
        secret_reference=model_config.secret_reference,
        has_api_key=has_key,
        created_at=model_config.created_at
    )

@router.get("/projects/{project_id}/models", response_model=List[ModelConfigResponse])
def list_models_for_project(project_id: str, db: Session = Depends(get_db)):
    configs = (
        db.query(ModelConfig)
        .filter(ModelConfig.project_id == project_id)
        .order_by(ModelConfig.created_at.desc())
        .all()
    )
    results = []
    for c in configs:
        has_key = True
        if c.provider == "openai":
            has_key = bool(settings.OPENAI_API_KEY)
        elif c.provider in ("anthropic", "claude"):
            has_key = bool(settings.ANTHROPIC_API_KEY)

        results.append(ModelConfigResponse(
            id=c.id,
            project_id=c.project_id,
            name=c.name,
            provider=c.provider,
            model_name=c.model_name,
            parameters=c.parameters,
            secret_reference=c.secret_reference,
            has_api_key=has_key,
            created_at=c.created_at
        ))
    return results

@router.delete("/projects/{project_id}/models/{model_id}", status_code=200)
def delete_model_config(project_id: str, model_id: str, db: Session = Depends(get_db)):
    from app.db.models import EvaluationRun

    model_config = (
        db.query(ModelConfig)
        .filter(ModelConfig.id == model_id, ModelConfig.project_id == project_id)
        .first()
    )
    if not model_config:
        raise HTTPException(status_code=404, detail="Model configuration not found")

    # Check if any evaluation runs reference this model (FK is RESTRICT)
    run_count = (
        db.query(EvaluationRun)
        .filter(EvaluationRun.model_config_id == model_id)
        .count()
    )
    if run_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {run_count} evaluation run(s) use this model. Delete those runs first."
        )

    db.delete(model_config)
    db.commit()
    return {"success": True, "message": f"Model config '{model_config.name}' deleted successfully"}

@router.post("/models/test-connection", response_model=ModelConnectionTestResponse)
def test_model_connection(data: ModelConnectionTestRequest):
    start = time.perf_counter()
    try:
        provider = get_provider(data.provider, api_key=data.api_key)
        res = provider.generate(
            messages=[{"role": "user", "content": "Respond with 'Connection verified.'"}],
            model_name=data.model_name,
            parameters={"temperature": 0.0, "max_tokens": 10},
            timeout=10.0
        )
        latency = round((time.perf_counter() - start) * 1000, 2)
        if res.error:
            return ModelConnectionTestResponse(
                success=False,
                latency_ms=latency,
                message=f"Connection failed: {res.error}"
            )
        mode_label = "[Mock Mode]" if res.is_mock else f"[Live {data.provider.upper()}]"
        return ModelConnectionTestResponse(
            success=True,
            latency_ms=latency,
            message=f"{mode_label} Connection successful to {data.model_name}.",
            sample_response=res.text.strip()
        )
    except Exception as e:
        latency = round((time.perf_counter() - start) * 1000, 2)
        return ModelConnectionTestResponse(
            success=False,
            latency_ms=latency,
            message=f"Connection error: {str(e)}"
        )
