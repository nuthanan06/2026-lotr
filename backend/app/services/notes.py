"""Shared helpers for writing crisis notes from the map endpoints."""

from __future__ import annotations

from collections.abc import Iterable

from fastapi import HTTPException
from sqlalchemy import delete, insert
from sqlalchemy.orm import Session

from app.models.crisis_note import (
    Character,
    CrisisNote,
    CrisisPeriod,
    NoteAction,
    NoteRole,
    NoteType,
    Priority,
    note_characters,
)


def active_period(db: Session) -> CrisisPeriod:
    period = db.query(CrisisPeriod).filter(CrisisPeriod.is_active.is_(True)).first()
    if not period:
        raise HTTPException(
            status_code=422,
            detail="No active crisis update. Start one on the Directives tab first.",
        )
    return period


def require_characters(db: Session, ids: Iterable[int]) -> list[Character]:
    ids = list(dict.fromkeys(ids))
    found = db.query(Character).filter(Character.id.in_(ids)).all() if ids else []
    if len(found) != len(ids):
        raise HTTPException(status_code=404, detail="One or more characters were not found.")
    by_id = {c.id: c for c in found}
    return [by_id[i] for i in ids]


def set_note_characters(
    db: Session, note: CrisisNote, author_ids: Iterable[int], target_ids: Iterable[int]
) -> None:
    """Replace a note's co-author/target links. The character the note is
    filed under (note.character_id) is implicitly an author and isn't stored
    again here."""
    db.execute(delete(note_characters).where(note_characters.c.note_id == note.id))
    rows = [
        {"note_id": note.id, "character_id": cid, "role": NoteRole.AUTHOR}
        for cid in dict.fromkeys(author_ids)
        if cid != note.character_id
    ] + [
        {"note_id": note.id, "character_id": cid, "role": NoteRole.TARGET}
        for cid in dict.fromkeys(target_ids)
    ]
    if rows:
        db.execute(insert(note_characters), rows)


def log_crisis_update(
    db: Session,
    *,
    characters: list[Character],
    title: str,
    description: str,
    action: NoteAction,
    priority: Priority = Priority.HIGH,
    conflict_id: int | None = None,
) -> CrisisNote:
    """Record a system-generated note against every given character: filed
    under the first, with the rest linked as targets so it shows in all of
    their logs."""
    note = CrisisNote(
        character_id=characters[0].id,
        period_id=active_period(db).id,
        title=title,
        description=description,
        priority=priority,
        note_type=NoteType.CRISIS_UPDATE,
        action=action,
        conflict_id=conflict_id,
    )
    db.add(note)
    db.flush()
    set_note_characters(db, note, [], [c.id for c in characters[1:]])
    return note
