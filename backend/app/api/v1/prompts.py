from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import PromptVersion, Project
from app.schemas.prompt_version import PromptVersionCreate, PromptVersionResponse

router = APIRouter(tags=["prompts"])

@router.post("/projects/{project_id}/prompts", response_model=PromptVersionResponse, status_code=201)
def create_prompt_version(
    project_id: str,
    data: PromptVersionCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    latest = (
        db.query(PromptVersion)
        .filter(PromptVersion.project_id == project_id, PromptVersion.name == data.name)
        .order_by(PromptVersion.version.desc())
        .first()
    )
    next_ver = (latest.version + 1) if latest else 1

    prompt = PromptVersion(
        project_id=project_id,
        name=data.name,
        version=next_ver,
        system_prompt=data.system_prompt,
        user_template=data.user_template
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt

@router.get("/projects/{project_id}/prompts", response_model=List[PromptVersionResponse])
def list_prompts_for_project(project_id: str, db: Session = Depends(get_db)):
    return (
        db.query(PromptVersion)
        .filter(PromptVersion.project_id == project_id)
        .order_by(PromptVersion.name.asc(), PromptVersion.version.desc())
        .all()
    )
