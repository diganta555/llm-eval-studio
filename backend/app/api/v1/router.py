from fastapi import APIRouter
from app.api.v1.projects import router as projects_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.models import router as models_router
from app.api.v1.prompts import router as prompts_router
from app.api.v1.runs import router as runs_router
from app.api.v1.results import router as results_router
from app.api.v1.exports import router as exports_router
from app.api.v1.comparisons import router as comparisons_router
from app.api.v1.validation import router as validation_router

api_router = APIRouter()

api_router.include_router(projects_router)
api_router.include_router(datasets_router)
api_router.include_router(models_router)
api_router.include_router(prompts_router)
api_router.include_router(runs_router)
api_router.include_router(results_router)
api_router.include_router(exports_router)
api_router.include_router(comparisons_router)
api_router.include_router(validation_router)

