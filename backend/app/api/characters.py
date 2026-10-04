from __future__ import annotations

import io
import json
from datetime import datetime

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.crisis_note import Character, CrisisNote, NoteAction
from app.models.map import ConflictStatus, GameState, Movement, Region
from app.schemas import (
    BulkUploadResult,
    CharacterCreate,
    CharacterResponse,
    CharacterUpdate,
    MapCharacterResponse,
    MovementResponse,
    MoveRequest,
)
from app.services import corruption
from app.services.game import load_game_state
from app.services.geo import region_at
from app.services.groups import assign, default_group
from app.services.notes import active_period

router = APIRouter(prefix="/characters", tags=["characters"])


def _to_map_character(
    c: Character, game: GameState, regions: list[Region], at: datetime
) -> MapCharacterResponse:
    region = region_at(regions, c.x, c.y)
    return MapCharacterResponse(
        id=c.id,
        name=c.name,
        created_at=c.created_at,
        race=c.race,
        avatar_url=c.avatar_url,
        x=c.x,
        y=c.y,
        region_id=region.id if region else None,
        army_mobilized=c.army_mobilized,
        has_ring=game.ring_holder_id == c.id,
        group_id=c.group_id,
        corruption=corruption.current(c, game, at),
        corruption_a=corruption.curve_a(c),
        corruption_a_is_custom=c.corruption_a is not None,
        ring_hours=corruption.hours_held(c, game, at),
        accruing=corruption.is_accruing(c, game),
        corruption_rate_per_hour=corruption.rate_per_hour(c, game, at),
        as_of=at,
        ongoing_conflict_ids=[k.id for k in c.conflicts if k.status == ConflictStatus.ONGOING],
    )


def _get_character(db: Session, character_id: int) -> Character:
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found.")
    return character


def _map_character(db: Session, character: Character) -> MapCharacterResponse:
    return _to_map_character(
        character, load_game_state(db), db.query(Region).all(), corruption.now_utc()
    )


@router.get("", response_model=list[MapCharacterResponse])
def list_characters(db: Session = Depends(get_db)) -> list[MapCharacterResponse]:
    game = load_game_state(db)
    regions = db.query(Region).all()
    at = corruption.now_utc()
    characters = (
        db.query(Character)
        .options(selectinload(Character.conflicts))
        .order_by(Character.name)
        .all()
    )
    return [_to_map_character(c, game, regions, at) for c in characters]


@router.get("/{character_id}", response_model=MapCharacterResponse)
def get_character(character_id: int, db: Session = Depends(get_db)) -> MapCharacterResponse:
    return _map_character(db, _get_character(db, character_id))


@router.patch("/{character_id}", response_model=MapCharacterResponse)
def update_character(
    character_id: int, body: CharacterUpdate, db: Session = Depends(get_db)
) -> MapCharacterResponse:
    character = _get_character(db, character_id)
    updates = body.model_dump(exclude_unset=True)
    if updates.get("race") is not None and updates["race"] not in corruption.RACES:
        raise HTTPException(
            status_code=422, detail=f"Race must be one of: {', '.join(corruption.RACES)}."
        )
    game = load_game_state(db)
    race = updates.pop("race", None)
    if race is not None or "corruption_a" in updates:
        # A new curve keeps today's corruption; only the future rise changes.
        a = updates.pop("corruption_a") if "corruption_a" in updates else character.corruption_a
        corruption.set_curve(character, game, a, race)
    value = updates.pop("corruption", None)
    if value is not None:
        corruption.set_value(character, game, value)
    for field, value in updates.items():
        if value is not None or field == "avatar_url":
            setattr(character, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A character with that name already exists.")
    db.refresh(character)
    return _map_character(db, character)


@router.post("/{character_id}/move", response_model=MapCharacterResponse)
def move_character(
    character_id: int, body: MoveRequest, db: Session = Depends(get_db)
) -> MapCharacterResponse:
    character = _get_character(db, character_id)
    if (body.note_id is None) == (body.note is None):
        raise HTTPException(
            status_code=422,
            detail="A move needs a crisis note: pick an existing note or write a new one.",
        )

    if body.note_id is not None:
        note = db.get(CrisisNote, body.note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found.")
    else:
        assert body.note is not None
        note = CrisisNote(
            character_id=character.id,
            period_id=active_period(db).id,
            title=body.note.title,
            description=body.note.description,
            priority=body.note.priority,
            note_type=body.note.note_type,
            action=NoteAction.MOVE,
        )
        db.add(note)
        db.flush()

    regions = db.query(Region).all()
    from_region = region_at(regions, character.x, character.y)
    to_region = region_at(regions, body.x, body.y)
    if body.discover_region and to_region is not None:
        to_region.discovered = True

    db.add(
        Movement(
            character_id=character.id,
            from_x=character.x,
            from_y=character.y,
            to_x=body.x,
            to_y=body.y,
            from_region_id=from_region.id if from_region else None,
            to_region_id=to_region.id if to_region else None,
            note_id=note.id,
        )
    )
    character.x = body.x
    character.y = body.y
    db.commit()
    db.refresh(character)
    return _map_character(db, character)


@router.get("/{character_id}/movements", response_model=list[MovementResponse])
def list_movements(character_id: int, db: Session = Depends(get_db)) -> list[MovementResponse]:
    _get_character(db, character_id)
    movements = (
        db.query(Movement)
        .options(
            selectinload(Movement.from_region),
            selectinload(Movement.to_region),
            selectinload(Movement.note),
        )
        .filter(Movement.character_id == character_id)
        .order_by(Movement.created_at.desc())
        .all()
    )
    return [
        MovementResponse(
            id=m.id,
            character_id=m.character_id,
            from_x=m.from_x,
            from_y=m.from_y,
            to_x=m.to_x,
            to_y=m.to_y,
            from_region_name=m.from_region.name if m.from_region else None,
            to_region_name=m.to_region.name if m.to_region else None,
            note_id=m.note_id,
            note_title=m.note.title if m.note else None,
            created_at=m.created_at,
        )
        for m in movements
    ]


@router.post("", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED)
def create_character(body: CharacterCreate, db: Session = Depends(get_db)) -> Character:
    existing = db.query(Character).filter(Character.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="A character with that name already exists.")
    character = Character(name=body.name)
    db.add(character)
    try:
        db.flush()
        group = default_group(db)
        if group is not None:
            assign(db, character, group.id)
        db.commit()
    except IntegrityError:
        # Another request created the same name between our check and commit.
        db.rollback()
        raise HTTPException(status_code=409, detail="A character with that name already exists.")
    db.refresh(character)
    return character


@router.post("/bulk", response_model=BulkUploadResult)
async def bulk_upload_characters(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> BulkUploadResult:
    content = await file.read()
    names: list[str] = []

    filename = (file.filename or "").lower()
    if filename.endswith(".json"):
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="That file is not valid JSON.")
        if isinstance(data, list):
            for item in data:
                if isinstance(item, str):
                    names.append(item)
                elif isinstance(item, dict) and "name" in item:
                    names.append(str(item["name"]))
    elif filename.endswith(".xlsx"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        except Exception:
            raise HTTPException(status_code=422, detail="That file is not a valid .xlsx workbook.")
        ws = wb.active
        if ws is not None:
            for row in ws.iter_rows(values_only=True):
                if row and row[0] and isinstance(row[0], str):
                    names.append(row[0].strip())
    else:
        raise HTTPException(status_code=422, detail="Only .json and .xlsx files are supported.")

    created = skipped = 0
    new_characters: list[Character] = []
    existing_names = {
        r[0] for r in db.query(Character.name).all()
    }
    for name in names:
        name = name.strip()
        if not name:
            continue
        if name in existing_names:
            skipped += 1
        else:
            new_character = Character(name=name)
            db.add(new_character)
            new_characters.append(new_character)
            existing_names.add(name)
            created += 1

    try:
        group = default_group(db)
        if group is not None and new_characters:
            db.flush()
            for new_character in new_characters:
                assign(db, new_character, group.id)
        db.commit()
    except IntegrityError:
        # Another request imported/created an overlapping name concurrently.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Some of these characters were just added by someone else. Try again.",
        )
    return BulkUploadResult(created=created, skipped=skipped)


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_character(character_id: int, db: Session = Depends(get_db)) -> None:
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found.")
    db.delete(character)
    db.commit()
