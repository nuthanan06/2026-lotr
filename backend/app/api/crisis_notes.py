from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.crisis_note import (
    Character,
    CrisisNote,
    CrisisPeriod,
    NoteType,
    Priority,
    note_characters,
)
from app.models.map import Conflict
from app.schemas import (
    AnalyticsSummary,
    CrisisNoteCreate,
    CrisisNoteResponse,
    CrisisNoteUpdate,
    NotesByCharacter,
    PriorityCount,
)
from app.services.notes import require_characters, set_note_characters

router = APIRouter(prefix="/notes", tags=["notes"])


def _check_conflict(db: Session, conflict_id: int | None) -> None:
    if conflict_id is not None and not db.get(Conflict, conflict_id):
        raise HTTPException(status_code=404, detail="Conflict not found.")


@router.get("/analytics", response_model=AnalyticsSummary)
def get_analytics(
    period_id: int | None = Query(None),
    db: Session = Depends(get_db),
) -> AnalyticsSummary:
    period_filter = [CrisisNote.period_id == period_id] if period_id is not None else []

    if period_id is not None and not db.get(CrisisPeriod, period_id):
        raise HTTPException(status_code=404, detail="Period not found.")

    total = db.query(func.count(CrisisNote.id)).filter(*period_filter).scalar() or 0

    by_char_rows = db.execute(
        select(Character.name, func.count(CrisisNote.id).label("cnt"))
        .join(CrisisNote, CrisisNote.character_id == Character.id)
        .where(*period_filter)
        .group_by(Character.name)
        .order_by(func.count(CrisisNote.id).desc())
    ).all()

    by_priority_rows = db.execute(
        select(CrisisNote.priority, func.count(CrisisNote.id).label("cnt"))
        .where(*period_filter)
        .group_by(CrisisNote.priority)
    ).all()

    private_count = (
        db.query(func.count(CrisisNote.id))
        .filter(*period_filter, CrisisNote.note_type == NoteType.PRIVATE_DIRECTIVE)
        .scalar()
        or 0
    )
    public_count = (
        db.query(func.count(CrisisNote.id))
        .filter(*period_filter, CrisisNote.note_type == NoteType.PUBLIC_DIRECTIVE)
        .scalar()
        or 0
    )

    return AnalyticsSummary(
        total_notes=total,
        notes_by_character=[NotesByCharacter(character_name=r[0], count=r[1]) for r in by_char_rows],
        priority_distribution=[PriorityCount(priority=r[0], count=r[1]) for r in by_priority_rows],
        private_directive_count=private_count,
        public_directive_count=public_count,
    )


@router.get("", response_model=list[CrisisNoteResponse])
def list_notes(
    period_id: int | None = Query(None),
    archived_only: bool = Query(False),
    character_id: int | None = Query(None),
    priority: Priority | None = Query(None),
    note_type: NoteType | None = Query(None),
    conflict_id: int | None = Query(None),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[CrisisNote]:
    query = db.query(CrisisNote).options(
        selectinload(CrisisNote.character),
        selectinload(CrisisNote.authors),
        selectinload(CrisisNote.targets),
    )
    if period_id is not None:
        query = query.filter(CrisisNote.period_id == period_id)
    elif archived_only:
        query = query.join(CrisisPeriod).filter(CrisisPeriod.is_active.is_(False))
    if character_id is not None:
        # A note belongs to a character's log if it's filed under them or
        # they're linked to it as a co-author or target.
        linked = select(note_characters.c.note_id).where(
            note_characters.c.character_id == character_id
        )
        query = query.filter(
            or_(CrisisNote.character_id == character_id, CrisisNote.id.in_(linked))
        )
    if conflict_id is not None:
        query = query.filter(CrisisNote.conflict_id == conflict_id)
    if priority is not None:
        query = query.filter(CrisisNote.priority == priority)
    if note_type is not None:
        query = query.filter(CrisisNote.note_type == note_type)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            CrisisNote.title.ilike(pattern) | CrisisNote.description.ilike(pattern)
        )
    return query.order_by(CrisisNote.created_at.desc()).all()


@router.post("", response_model=CrisisNoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(body: CrisisNoteCreate, db: Session = Depends(get_db)) -> CrisisNote:
    active_period = db.query(CrisisPeriod).filter(CrisisPeriod.is_active.is_(True)).first()
    if not active_period:
        raise HTTPException(status_code=422, detail="No active period. Create a period first.")

    if body.period_id is not None and body.period_id != active_period.id:
        # The client's view of the active period is stale (e.g. it was
        # archived while they had the form open) — refuse rather than
        # silently filing the note under a different period than they saw.
        raise HTTPException(
            status_code=409,
            detail="The active period has changed since you opened this form. Refresh and try again.",
        )

    character = db.get(Character, body.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found.")
    require_characters(db, [*body.author_ids, *body.target_ids])
    _check_conflict(db, body.conflict_id)

    note = CrisisNote(
        character_id=body.character_id,
        period_id=active_period.id,
        title=body.title,
        description=body.description,
        crisis_staff_notes=body.crisis_staff_notes,
        priority=body.priority,
        note_type=body.note_type,
        action=body.action,
        conflict_id=body.conflict_id,
        deadline_at=(
            datetime.now(timezone.utc) + timedelta(minutes=body.timer_minutes)
            if body.timer_minutes
            else None
        ),
    )
    db.add(note)
    db.flush()
    set_note_characters(db, note, body.author_ids, body.target_ids)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=CrisisNoteResponse)
def update_note(note_id: int, body: CrisisNoteUpdate, db: Session = Depends(get_db)) -> CrisisNote:
    note = db.get(CrisisNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    updates = body.model_dump(exclude_unset=True)
    if "character_id" in updates:
        character = db.get(Character, updates["character_id"])
        if not character:
            raise HTTPException(status_code=404, detail="Character not found.")
    if "conflict_id" in updates:
        _check_conflict(db, updates["conflict_id"])

    author_ids = updates.pop("author_ids", None)
    target_ids = updates.pop("target_ids", None)
    resolved = updates.pop("resolved", None)
    if resolved is not None:
        note.resolved_at = datetime.now(timezone.utc) if resolved else None
    for field, value in updates.items():
        setattr(note, field, value)
    if author_ids is not None or target_ids is not None:
        require_characters(db, [*(author_ids or []), *(target_ids or [])])
        db.flush()
        set_note_characters(
            db,
            note,
            author_ids if author_ids is not None else [a.id for a in note.authors],
            target_ids if target_ids is not None else [t.id for t in note.targets],
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not save this note — check the submitted values.")
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_note(note_id: int, db: Session = Depends(get_db)) -> None:
    note = db.get(CrisisNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    db.delete(note)
    db.commit()
