from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.map import GameState


def load_game_state(db: Session) -> GameState:
    """The singleton committee state row (seeded by migration; recreated if missing)."""
    game = db.get(GameState, 1)
    if game is None:
        game = GameState(id=1, clock_paused=False)
        db.add(game)
        db.flush()
    return game
