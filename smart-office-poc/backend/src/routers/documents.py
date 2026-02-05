from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
import uuid
import json
from datetime import datetime, timedelta
from pathlib import Path
import aiofiles

router = APIRouter(
    prefix="/api/documents",
    tags=["documents"]
)

BASE_DIR = Path(__file__).resolve().parents[2]
ASSETS_DIR = BASE_DIR / "data" / "assets"

@router.get("")
@router.get("/")
def get_documents(
    q: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Document).filter(models.Document.is_template == False)
    if q:
        q = q.strip()
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    models.Document.title.ilike(like),
                    models.Document.content.ilike(like)
                )
            )
    return query.offset(skip).limit(limit).all()

@router.post("")
@router.post("/", response_model=models.DocumentResponse)
def create_document(doc: models.DocumentCreate, db: Session = Depends(get_db)):
    db_doc = models.Document(
        id=str(uuid.uuid4()),
        title=doc.title,
        content=json.dumps(doc.content),
        is_template=doc.is_template,
        version=1
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    # Parse content back to JSON for response
    db_doc.content = json.loads(db_doc.content)
    return db_doc

@router.get("/{doc_id}", response_model=models.DocumentResponse)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    db_doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Parse content back to JSON for response
    # Note: In a real app we might want pydantic validator to do this
    db_doc.content = json.loads(db_doc.content)
    return db_doc

@router.put("/{doc_id}")
def update_document(doc_id: str, update: models.DocumentUpdate, db: Session = Depends(get_db)):
    db_doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Optimistic Concurrency Control
    if update.base_version != db_doc.version:
        raise HTTPException(
            status_code=409, 
            detail=f"Conflict: Document has been modified. Server version: {db_doc.version}, Client base: {update.base_version}"
        )
    
    db_doc.content = json.dumps(update.content)
    if update.title:
        db_doc.title = update.title
    db_doc.version += 1
    db_doc.last_modified_by = "user" # TODO: Real user
    
    db.commit()
    db.refresh(db_doc)
    return {"version": db_doc.version}

@router.delete("/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    db_doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(db_doc)
    db.commit()
    return {"ok": True}

@router.post("/{doc_id}/lock")
def acquire_lock(doc_id: str, user: str | None = None, db: Session = Depends(get_db)):
    db_doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not user:
        user = "unknown"

    now = datetime.utcnow()
    # Check if locked and not expired (lock valid for 5 mins)
    if db_doc.locked_by and db_doc.lock_expiry and db_doc.lock_expiry > now:
        if db_doc.locked_by != user:
             raise HTTPException(status_code=423, detail=f"Locked by {db_doc.locked_by}")
    
    db_doc.locked_by = user
    db_doc.lock_expiry = now + timedelta(minutes=5)
    db.commit()
    return {"locked_by": user, "expires_at": db_doc.lock_expiry}

@router.post("/{doc_id}/unlock")
def release_lock(doc_id: str, user: str | None = None, force: bool = False, db: Session = Depends(get_db)):
    db_doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if db_doc.locked_by and user and db_doc.locked_by != user and not force:
        raise HTTPException(status_code=423, detail=f"Locked by {db_doc.locked_by}")
    
    db_doc.locked_by = None
    db_doc.lock_expiry = None
    db.commit()
    return {"ok": True}

@router.post("/{doc_id}/assets")
async def upload_asset(
    doc_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    db_doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filename = Path(file.filename).name
    doc_dir = ASSETS_DIR / doc_id
    doc_dir.mkdir(parents=True, exist_ok=True)
    dest_path = doc_dir / filename

    async with aiofiles.open(dest_path, "wb") as out:
        content = await file.read()
        await out.write(content)

    return {
        "filename": filename,
        "url": f"/static/assets/{doc_id}/{filename}"
    }
