from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crisis_note import Character
from app.models.map import GameState
from app.schemas import GameStateResponse, GameStateUpdate, RingHolderUpdate
from app.services import corruption
from app.services.game import load_game_state

router = APIRouter(prefix="/game", tags=["game"])


def _response(game: GameState) -> GameStateResponse:
    return GameStateResponse(
        ring_holder_id=game.ring_holder_id,
        clock_paused=game.clock_paused,
        race_curve_a=corruption.RACE_CURVE_A,
    )


def _snapshot_holder(db: Session, game: GameState) -> None:
    if game.ring_holder_id is not None:
        holder = db.get(Character, game.ring_holder_id)
        if holder:
            corruption.snapshot(holder, game)


@router.get("", response_model=GameStateResponse)
def get_game_state(db: Session = Depends(get_db)) -> GameStateResponse:
    game = load_game_state(db)
    db.commit()
    return _response(game)


@router.patch("", response_model=GameStateResponse)
def update_game_state(body: GameStateUpdate, db: Session = Depends(get_db)) -> GameStateResponse:
    game = load_game_state(db)
    if body.clock_paused is not None and body.clock_paused != game.clock_paused:
        # Bank corruption accrued so far, then switch the rate on/off from now.
        _snapshot_holder(db, game)
        game.clock_paused = body.clock_paused
    db.commit()
    return _response(game)


@router.put("/ring", response_model=GameStateResponse)
def set_ring_holder(body: RingHolderUpdate, db: Session = Depends(get_db)) -> GameStateResponse:
    game = load_game_state(db)
    if body.character_id == game.ring_holder_id:
        return _response(game)
    new_holder = None
    if body.character_id is not None:
        new_holder = db.get(Character, body.character_id)
        if not new_holder:
            raise HTTPException(status_code=404, detail="Character not found.")

    # Freeze the old holder's corruption, and start the new holder's accrual now.
    _snapshot_holder(db, game)
    if new_holder is not None:
        corruption.snapshot(new_holder, game)
    game.ring_holder_id = body.character_id
    db.commit()
    return _response(game)
