"""Ring corruption on a quadratic curve, computed on read (no ticking job).

    corruption = a × hours_held²        (capped at 100)

``hours_held`` is total time spent holding the Ring while the committee
clock runs: ``ring_hours`` banks earlier stints and ``corruption_updated_at``
marks when the current stint started. ``a`` is per character (crisis staff
can edit it) and defaults by race — a slow curve barely moves at first and
then accelerates the longer someone keeps the Ring.

Setting corruption by hand (healing, a crisis event) moves the character to
the point on their curve with that value, so it keeps rising from there at
the rate that level implies.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from app.models.crisis_note import Character
from app.models.map import GameState

MAX_CORRUPTION = 100.0

# Default curve steepness by race (percentage points per hour²). Placeholder
# values until the directors provide real ones: a hobbit takes ~14 h of
# holding to be fully corrupted, a man ~8 h, an orc ~7 h.
RACE_CURVE_A: dict[str, float] = {
    "HOBBIT": 0.5,
    "WIZARD": 0.8,
    "ELF": 1.0,
    "DWARF": 1.2,
    "MAN": 1.5,
    "ORC": 2.0,
    "OTHER": 1.0,
}
RACES = list(RACE_CURVE_A)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def curve_a(character: Character) -> float:
    if character.corruption_a is not None:
        return character.corruption_a
    return RACE_CURVE_A.get(character.race, RACE_CURVE_A["OTHER"])


def is_accruing(character: Character, game: GameState) -> bool:
    return game.ring_holder_id == character.id and not game.clock_paused


def hours_held(character: Character, game: GameState, at: datetime | None = None) -> float:
    hours = character.ring_hours
    if is_accruing(character, game) and character.corruption_updated_at is not None:
        at = at or now_utc()
        hours += max(0.0, (at - character.corruption_updated_at).total_seconds() / 3600)
    return hours


def current(character: Character, game: GameState, at: datetime | None = None) -> float:
    return min(MAX_CORRUPTION, curve_a(character) * hours_held(character, game, at) ** 2)


def rate_per_hour(character: Character, game: GameState, at: datetime | None = None) -> float:
    """Instantaneous rise (d/dt of a·h² = 2·a·h); 0 unless actively corrupting."""
    if not is_accruing(character, game) or current(character, game, at) >= MAX_CORRUPTION:
        return 0.0
    return 2 * curve_a(character) * hours_held(character, game, at)


def snapshot(character: Character, game: GameState, at: datetime | None = None) -> None:
    """Bank holding time so far and restart the stint clock at ``at``.

    Call before anything that changes whether the character is accruing
    (the Ring changing hands, the clock pausing/resuming)."""
    at = at or now_utc()
    character.ring_hours = hours_held(character, game, at)
    character.corruption_updated_at = at


def set_value(character: Character, game: GameState, value: float) -> None:
    """Place the character on their curve at ``value``."""
    character.ring_hours = math.sqrt(max(0.0, min(MAX_CORRUPTION, value)) / curve_a(character))
    character.corruption_updated_at = now_utc()


def set_curve(character: Character, game: GameState, a: float | None, race: str | None = None) -> None:
    """Change the curve (or race default) without changing current corruption."""
    value = current(character, game)
    if race is not None:
        character.race = race
    character.corruption_a = a
    set_value(character, game, value)
