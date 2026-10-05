from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.crisis_note import CrisisNote, NoteAction, Priority
from app.models.map import Conflict, ConflictStatus
from app.schemas import ConflictCreate, ConflictResolve, ConflictResponse, ConflictUpdate
from app.services import corruption
from app.services.notes import log_crisis_update, require_characters

router = APIRouter(prefix="/conflicts", tags=["conflicts"])


def _get_conflict(db: Session, conflict_id: int) -> Conflict:
    conflict = db.get(Conflict, conflict_id)
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found.")
    return conflict


def _names(conflict: Conflict) -> str:
    return ", ".join(p.name for p in conflict.parties)


@router.get("", response_model=list[ConflictResponse])
def list_conflicts(
    status_filter: ConflictStatus | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
) -> list[Conflict]:
    query = db.query(Conflict).options(selectinload(Conflict.parties))
    if status_filter is not None:
        query = query.filter(Conflict.status == status_filter)
    return query.order_by(Conflict.created_at.desc()).all()


@router.get("/{conflict_id}", response_model=ConflictResponse)
def get_conflict(conflict_id: int, db: Session = Depends(get_db)) -> Conflict:
    return _get_conflict(db, conflict_id)


@router.post("", response_model=ConflictResponse, status_code=status.HTTP_201_CREATED)
def create_conflict(body: ConflictCreate, db: Session = Depends(get_db)) -> Conflict:
    parties = require_characters(db, body.party_ids)
    if len(parties) < 2:
        raise HTTPException(status_code=422, detail="A conflict needs at least two parties.")
    conflict = Conflict(name=body.name, status=ConflictStatus.ONGOING, parties=parties)
    if body.timer_minutes:
        conflict.deadline_at = corruption.now_utc() + timedelta(minutes=body.timer_minutes)
    db.add(conflict)
    db.flush()

    if body.note_id is not None:
        note = db.get(CrisisNote, body.note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found.")
        note.conflict_id = conflict.id
        note.action = NoteAction.CONFLICT

    log_crisis_update(
        db,
        characters=parties,
        title=f"Conflict started: {conflict.name}",
        description=f"{_names(conflict)} entered the conflict “{conflict.name}”.",
        action=NoteAction.CONFLICT,
        conflict_id=conflict.id,
    )
    db.commit()
    db.refresh(conflict)
    return conflict


@router.patch("/{conflict_id}", response_model=ConflictResponse)
def update_conflict(
    conflict_id: int, body: ConflictUpdate, db: Session = Depends(get_db)
) -> Conflict:
    conflict = _get_conflict(db, conflict_id)
    if body.name is not None:
        conflict.name = body.name
    if body.party_ids is not None:
        conflict.parties = require_characters(db, body.party_ids)
    if "deadline_at" in body.model_fields_set:
        conflict.deadline_at = body.deadline_at
    db.commit()
    db.refresh(conflict)
    return conflict


@router.post("/{conflict_id}/resolve", response_model=ConflictResponse)
def resolve_conflict(
    conflict_id: int, body: ConflictResolve, db: Session = Depends(get_db)
) -> Conflict:
    conflict = _get_conflict(db, conflict_id)
    if conflict.status == ConflictStatus.RESOLVED:
        raise HTTPException(status_code=409, detail="This conflict is already resolved.")
    party_ids = {p.id for p in conflict.parties}
    if body.winner_id is not None and body.winner_id not in party_ids:
        raise HTTPException(status_code=422, detail="The winner must be one of the parties.")

    conflict.status = ConflictStatus.RESOLVED
    conflict.winner_id = body.winner_id
    conflict.outcome_summary = body.outcome_summary
    conflict.resolved_at = corruption.now_utc()

    winner = next((p for p in conflict.parties if p.id == body.winner_id), None)
    verdict = f"{winner.name} prevailed." if winner else "No clear victor."
    log_crisis_update(
        db,
        characters=list(conflict.parties),
        title=f"Conflict resolved: {conflict.name}",
        description=f"{verdict} {body.outcome_summary}",
        action=NoteAction.CONFLICT,
        priority=Priority.MEDIUM,
        conflict_id=conflict.id,
    )
    db.commit()
    db.refresh(conflict)
    return conflict


@router.delete("/{conflict_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_conflict(conflict_id: int, db: Session = Depends(get_db)) -> None:
    db.delete(_get_conflict(db, conflict_id))
    db.commit()
