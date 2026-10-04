"""Travelling groups and what each group knows about everyone else."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.crisis_note import Character
from app.models.map import Group, GroupMembership, Movement
from app.schemas import LastSeen
from app.services.corruption import now_utc


def default_group(db: Session) -> Group | None:
    """New characters join the first group (the Fellowship everyone starts in)."""
    return db.query(Group).order_by(Group.id).first()


def assign(db: Session, character: Character, group_id: int | None, at: datetime | None = None) -> None:
    """Move a character into a group, recording when they left the old one."""
    if character.group_id == group_id:
        return
    at = at or now_utc()
    open_rows = (
        db.query(GroupMembership)
        .filter(GroupMembership.character_id == character.id, GroupMembership.left_at.is_(None))
        .all()
    )
    for row in open_rows:
        row.left_at = at
    character.group_id = group_id
    if group_id is not None:
        db.add(GroupMembership(character_id=character.id, group_id=group_id, joined_at=at))


def _position_at(movements: list[Movement], at: datetime) -> tuple[float, float] | None:
    """Where a character was at ``at``, from their (time-ordered) moves."""
    position = None
    for m in movements:
        if m.created_at > at:
            break
        position = (m.to_x, m.to_y)
    return position


def last_seen(db: Session, group: Group) -> list[LastSeen]:
    """For everyone outside ``group``: where they were the last time they
    travelled in the same group as any current member.

    Characters who never shared a group with this one stay unknown.
    """
    now = now_utc()
    rows = db.query(GroupMembership).all()
    intervals: dict[int, list[tuple[int, datetime, datetime]]] = {}
    for r in rows:
        intervals.setdefault(r.character_id, []).append((r.group_id, r.joined_at, r.left_at or now))

    member_ids = {c.id for c in group.members}
    member_intervals = [iv for cid in member_ids for iv in intervals.get(cid, [])]

    result: list[LastSeen] = []
    outsiders = db.query(Character).filter(Character.id.notin_(member_ids) if member_ids else True).all()
    for other in outsiders:
        # Latest moment this character and any member were in the same group.
        together_until: datetime | None = None
        for gid, start, end in intervals.get(other.id, []):
            for mgid, mstart, mend in member_intervals:
                if gid == mgid and start < mend and mstart < end:
                    overlap_end = min(end, mend)
                    if together_until is None or overlap_end > together_until:
                        together_until = overlap_end
        if together_until is None:
            continue
        moves = (
            db.query(Movement)
            .filter(Movement.character_id == other.id)
            .order_by(Movement.created_at)
            .all()
        )
        position = _position_at(moves, together_until)
        if position is not None:
            result.append(
                LastSeen(character_id=other.id, x=position[0], y=position[1], seen_at=together_until)
            )
    return result
