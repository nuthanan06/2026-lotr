"""Per-group discovery of regions.

Each group has its own set of discovered regions (GroupRegion rows). A
discovery is staged until the next crisis update reveals it to that group's
delegates. Knowledge travels with people: a group split off from another
starts with everything its members already knew, and someone joining a group
brings what their old group knew.
"""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.crisis_note import Character
from app.models.map import Group, GroupRegion, Region
from app.schemas import RegionDiscovery, RegionResponse
from app.services.corruption import now_utc


def active_group_ids(db: Session) -> list[int]:
    """Groups that currently have members (falls back to every group)."""
    ids = [gid for (gid,) in db.query(Character.group_id).filter(Character.group_id.isnot(None)).distinct()]
    return sorted(ids) or [gid for (gid,) in db.query(Group.id).order_by(Group.id)]


def region_response(
    region: Region, rows: list[GroupRegion], active_ids: Iterable[int]
) -> RegionResponse:
    by_group = {r.group_id: r for r in rows}
    active = list(active_ids)
    return RegionResponse(
        id=region.id,
        slug=region.slug,
        name=region.name,
        polygon=region.polygon,
        status=region.status,
        notes=region.notes,
        # Known to at least one group.
        discovered=bool(rows),
        # Shown to every active group — safe for a whole-committee screen.
        revealed=bool(active) and all(
            gid in by_group and by_group[gid].revealed_at is not None for gid in active
        ),
        discoveries=[
            RegionDiscovery(
                group_id=r.group_id,
                discovered_at=r.discovered_at,
                revealed=r.revealed_at is not None,
            )
            for r in sorted(rows, key=lambda r: r.group_id)
        ],
    )


def rows_by_region(db: Session) -> dict[int, list[GroupRegion]]:
    out: dict[int, list[GroupRegion]] = {}
    for row in db.query(GroupRegion).all():
        out.setdefault(row.region_id, []).append(row)
    return out


def set_discovered(db: Session, region_id: int, group_id: int, discovered: bool) -> None:
    row = db.get(GroupRegion, (group_id, region_id))
    if discovered and row is None:
        db.add(GroupRegion(group_id=group_id, region_id=region_id, discovered_at=now_utc()))
    elif not discovered and row is not None:
        # Hiding a region again takes effect for that group's delegates immediately.
        db.delete(row)


def reveal_pending(db: Session) -> list[int]:
    """Reveal every staged discovery; returns the affected region ids."""
    at = now_utc()
    pending = db.query(GroupRegion).filter(GroupRegion.revealed_at.is_(None)).all()
    for row in pending:
        row.revealed_at = at
    return sorted({row.region_id for row in pending})


def share_knowledge(db: Session, from_group_ids: Iterable[int], to_group_id: int) -> None:
    """Give ``to_group_id`` every region the source groups know, keeping
    whether it was already revealed to them."""
    sources = [gid for gid in set(from_group_ids) if gid is not None and gid != to_group_id]
    if not sources:
        return
    existing = {
        r.region_id: r for r in db.query(GroupRegion).filter(GroupRegion.group_id == to_group_id)
    }
    for row in db.query(GroupRegion).filter(GroupRegion.group_id.in_(sources)).all():
        mine = existing.get(row.region_id)
        if mine is None:
            mine = GroupRegion(
                group_id=to_group_id,
                region_id=row.region_id,
                discovered_at=row.discovered_at,
                revealed_at=row.revealed_at,
            )
            db.add(mine)
            existing[row.region_id] = mine
        elif mine.revealed_at is None and row.revealed_at is not None:
            mine.revealed_at = row.revealed_at
    db.flush()
