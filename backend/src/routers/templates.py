from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
import uuid
import json
import re

router = APIRouter(
    prefix="/api/templates",
    tags=["templates"]
)

@router.get("")
@router.get("/")
def get_templates(db: Session = Depends(get_db)):
    return db.query(models.Document).filter(models.Document.is_template == True).all()

@router.post("")
@router.post("/")
def create_template(doc: models.DocumentCreate, db: Session = Depends(get_db)):
    db_doc = models.Document(
        id=str(uuid.uuid4()),
        title=doc.title,
        content=json.dumps(doc.content),
        is_template=True,
        version=1
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    db_doc.content = json.loads(db_doc.content)
    return db_doc

class InstantiateRequest(models.BaseModel):
    user_variables: dict[str, str]

def _replace_placeholders(value, variables: dict[str, str]):
    if isinstance(value, str):
        for key, replacement in variables.items():
            pattern = r"\{\{\s*" + re.escape(key) + r"\s*\}\}"
            value = re.sub(pattern, replacement, value)
        return value
    if isinstance(value, list):
        return [_replace_placeholders(item, variables) for item in value]
    if isinstance(value, dict):
        return {k: _replace_placeholders(v, variables) for k, v in value.items()}
    return value

@router.post("/instantiate/{template_id}", response_model=models.DocumentResponse)
def instantiate_template(template_id: str, request: InstantiateRequest, db: Session = Depends(get_db)):
    template = db.query(models.Document).filter(models.Document.id == template_id, models.Document.is_template == True).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # 1. Parse JSON content
    if isinstance(template.content, str):
        content_obj = json.loads(template.content)
    else:
        content_obj = template.content

    # 2. Replace placeholders in the structured content
    filled_content = _replace_placeholders(content_obj, request.user_variables)

    # 3. Create new document
    new_doc = models.Document(
        id=str(uuid.uuid4()),
        title=f"{template.title} (Copy)",
        content=json.dumps(filled_content),
        is_template=False,
        version=1
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    new_doc.content = filled_content
    return new_doc
