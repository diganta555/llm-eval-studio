import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.db.models import Project, ModelConfig, PromptVersion
from app.api.v1.router import api_router
from app.services.dataset_service import parse_and_validate_dataset_content, create_dataset_version

setup_logging()

# Registry of all models that should exist in every project.
# When adding a new provider/model, just add a new entry here.
DEFAULT_MODEL_REGISTRY = [
    {
        "name": "OpenAI GPT-4o-mini",
        "provider": "openai",
        "model_name": "gpt-4o-mini",
        "parameters": {"temperature": 0.0, "max_tokens": 1000, "top_p": 1.0},
        "secret_reference": "OPENAI_API_KEY"
    },
    {
        "name": "OpenAI GPT-4o",
        "provider": "openai",
        "model_name": "gpt-4o",
        "parameters": {"temperature": 0.0, "max_tokens": 1000, "top_p": 1.0},
        "secret_reference": "OPENAI_API_KEY"
    },
    {
        "name": "Anthropic Claude 3.5 Sonnet",
        "provider": "anthropic",
        "model_name": "claude-3-5-sonnet-20241022",
        "parameters": {"temperature": 0.0, "max_tokens": 1000, "top_p": 1.0},
        "secret_reference": "ANTHROPIC_API_KEY"
    },
    {
        "name": "Anthropic Claude 3 Haiku",
        "provider": "anthropic",
        "model_name": "claude-3-haiku-20240307",
        "parameters": {"temperature": 0.0, "max_tokens": 1000, "top_p": 1.0},
        "secret_reference": "ANTHROPIC_API_KEY"
    },
    {
        "name": "Mock Evaluator (Offline / Fast Demo)",
        "provider": "mock",
        "model_name": "mock-eval-model",
        "parameters": {"temperature": 0.0, "max_tokens": 1000, "top_p": 1.0},
        "secret_reference": None
    },
]

def seed_initial_data():
    """Seeds default project, sample models, prompt, and demo dataset on first start."""
    db = SessionLocal()
    try:
        project = db.query(Project).first()
        if not project:
            logger.info("Initializing database with default project and seed resources...")
            project = Project(
                name="Core Eval Project",
                description="Default evaluation environment for benchmarks, prompt testing, and model comparison."
            )
            db.add(project)
            db.commit()
            db.refresh(project)

            # Seed all default model configs from registry
            for model_def in DEFAULT_MODEL_REGISTRY:
                cfg = ModelConfig(
                    project_id=project.id,
                    name=model_def["name"],
                    provider=model_def["provider"],
                    model_name=model_def["model_name"],
                    parameters=model_def["parameters"],
                    secret_reference=model_def["secret_reference"]
                )
                db.add(cfg)

            # Add Default Prompt Version
            prompt = PromptVersion(
                project_id=project.id,
                name="Standard Production Prompt",
                version=1,
                system_prompt="You are a helpful, accurate, and concise AI assistant. Answer facts directly.",
                user_template="{question}\nContext: {context}"
            )
            db.add(prompt)
            db.commit()

            # Seed demo dataset if file exists
            sample_candidates = [
                os.path.join(os.path.dirname(__file__), "../../sample-data/demo_dataset.json"),
                "/home/atnagid/Documents/LLM EVALS/sample-data/demo_dataset.json"
            ]
            for path in sample_candidates:
                if os.path.exists(path):
                    with open(path, "r", encoding="utf-8") as f:
                        cases, _ = parse_and_validate_dataset_content(f.read(), "json")
                        create_dataset_version(
                            db=db,
                            project_id=project.id,
                            name="Demo Knowledge & Reasoning Benchmark",
                            test_cases=cases,
                            source_filename="demo_dataset.json"
                        )
                    logger.info("Sample demo dataset successfully imported.")
                    break
    except Exception as e:
        logger.error(f"Error during initial data seeding: {e}")
    finally:
        db.close()

def backfill_missing_models():
    """Ensures all models in DEFAULT_MODEL_REGISTRY exist in every project.
    Runs on every startup so newly added models are always available."""
    db = SessionLocal()
    try:
        projects = db.query(Project).all()
        for project in projects:
            existing = (
                db.query(ModelConfig)
                .filter(ModelConfig.project_id == project.id)
                .all()
            )
            existing_keys = {
                (m.provider, m.model_name) for m in existing
            }
            added = 0
            for model_def in DEFAULT_MODEL_REGISTRY:
                key = (model_def["provider"], model_def["model_name"])
                if key not in existing_keys:
                    cfg = ModelConfig(
                        project_id=project.id,
                        name=model_def["name"],
                        provider=model_def["provider"],
                        model_name=model_def["model_name"],
                        parameters=model_def["parameters"],
                        secret_reference=model_def["secret_reference"]
                    )
                    db.add(cfg)
                    added += 1
            if added:
                db.commit()
                logger.info(f"Backfilled {added} missing model config(s) into project '{project.name}'.")
    except Exception as e:
        logger.error(f"Error during model backfill: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    seed_initial_data()
    backfill_missing_models()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="LLM Evaluation Studio: Workbench for scoring models across correctness, relevance, faithfulness, and hallucination.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "env": settings.APP_ENV,
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "anthropic_configured": bool(settings.ANTHROPIC_API_KEY)
    }

@app.get(f"{settings.API_V1_PREFIX}/system-status")
def system_status():
    return {
        "app_name": settings.APP_NAME,
        "version": "0.1.0",
        "database": "connected",
        "openai_api_key_configured": bool(settings.OPENAI_API_KEY),
        "anthropic_api_key_configured": bool(settings.ANTHROPIC_API_KEY),
        "default_model": settings.OPENAI_MODEL,
        "judge_model": settings.JUDGE_MODEL,
        "mock_mode_available": True
    }

app.include_router(api_router, prefix=settings.API_V1_PREFIX)
