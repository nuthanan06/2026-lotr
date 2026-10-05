"""Token-gated, read-only data for delegate screens.

The Next.js app serves /screen/<token> without a staff login and fetches
this endpoint through its own server-side proxy. Everything returned is
filtered to what the audience (one group, or the whole committee) may know.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.crisis_note import Character
from app.models.map import Conflict, ConflictStatus, GameState, Group, GroupRegion, Region
from app.schemas import (
    ScreenCharacter,
    ScreenConflict,
    ScreenLastSeen,
    ScreenRegion,
    ScreenView,
)
from app.services.discovery import active_group_ids, region_response, rows_by_region
from app.services.game import load_game_state
from app.services.geo import region_at
from app.services.groups import last_seen

router = APIRouter(prefix="/screens", tags=["screens"])


def _screen_character(c: Character, game: GameState) -> ScreenCharacter:
    return ScreenCharacter(
        id=c.id,
        name=c.name,
        avatar_url=c.avatar_url,
        x=c.x,
        y=c.y,
        has_ring=game.ring_holder_id == c.id,
        army_mobilized=c.army_mobilized,
    )


@router.get("/{token}", response_model=ScreenView)
def screen_view(token: str, db: Session = Depends(get_db)) -> ScreenView:
    game = load_game_state(db)
    group = db.query(Group).filter(Group.screen_token == token).first()
    if group is None and game.screen_token != token:
        raise HTTPException(status_code=404, detail="This screen link is not valid.")

    regions = db.query(Region).order_by(Region.name).all()
    if group is not None:
        revealed_ids = {
            r.region_id
            for r in db.query(GroupRegion).filter(
                GroupRegion.group_id == group.id, GroupRegion.revealed_at.isnot(None)
            )
        }
    else:
        rows = rows_by_region(db)
        active = active_group_ids(db)
        revealed_ids = {r.id for r in regions if region_response(r, rows.get(r.id, []), active).revealed}

    placed = db.query(Character).filter(Character.x.isnot(None), Character.y.isnot(None)).all()
    if group is not None:
        # A group always knows where its own members are.
        visible = [c for c in placed if c.group_id == group.id]
        seen = {s.character_id: s for s in last_seen(db, group)}
        ghosts = [
            ScreenLastSeen(id=c.id, name=c.name, avatar_url=c.avatar_url, x=s.x, y=s.y, seen_at=s.seen_at)
            for c in db.query(Character).filter(Character.id.in_(seen)).all()
            for s in [seen[c.id]]
        ]
    else:
        # The whole committee only sees people in lands everyone has been shown.
        visible = []
        for c in placed:
            region = region_at(regions, c.x, c.y)
            if region is None or region.id in revealed_ids:
                visible.append(c)
        ghosts = []

    visible_ids = {c.id for c in visible}
    conflicts = []
    for k in (
        db.query(Conflict)
        .options(selectinload(Conflict.parties))
        .filter(Conflict.status == ConflictStatus.ONGOING)
        .all()
    ):
        parties = [p.id for p in k.parties if p.id in visible_ids]
        if parties:
            conflicts.append(
                ScreenConflict(id=k.id, name=k.name, party_ids=parties, deadline_at=k.deadline_at)
            )

    return ScreenView(
        title=group.name if group else "Middle-earth",
        color=group.color if group else None,
        characters=[_screen_character(c, game) for c in visible],
        last_seen=ghosts,
        regions=[
            ScreenRegion(id=r.id, name=r.name, polygon=r.polygon, revealed=r.id in revealed_ids)
            for r in regions
        ],
        conflicts=conflicts,
    )
