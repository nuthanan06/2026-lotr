from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.map import Group, GroupRegion, Region
from app.schemas import RegionDiscoveryUpdate, RegionResponse, RegionUpdate, RevealResult
from app.services.discovery import (
    active_group_ids,
    region_response,
    reveal_pending,
    rows_by_region,
    set_discovered,
)

router = APIRouter(prefix="/regions", tags=["regions"])


def _get_region(db: Session, region_id: int) -> Region:
    region = db.get(Region, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found.")
    return region


def _response(db: Session, region: Region) -> RegionResponse:
    rows = db.query(GroupRegion).filter(GroupRegion.region_id == region.id).all()
    return region_response(region, rows, active_group_ids(db))


@router.get("", response_model=list[RegionResponse])
def list_regions(db: Session = Depends(get_db)) -> list[RegionResponse]:
    rows = rows_by_region(db)
    active = active_group_ids(db)
    return [
        region_response(r, rows.get(r.id, []), active)
        for r in db.query(Region).order_by(Region.name).all()
    ]


@router.post("/reveal", response_model=RevealResult)
def reveal(db: Session = Depends(get_db)) -> RevealResult:
    revealed = reveal_pending(db)
    db.commit()
    return RevealResult(revealed=revealed)


@router.patch("/{region_id}", response_model=RegionResponse)
def update_region(region_id: int, body: RegionUpdate, db: Session = Depends(get_db)) -> RegionResponse:
    region = _get_region(db, region_id)
    updates = body.model_dump(exclude_unset=True)
    discovered = updates.pop("discovered", None)
    for field, value in updates.items():
        setattr(region, field, value)
    if discovered is not None:
        for (group_id,) in db.query(Group.id).all():
            set_discovered(db, region.id, group_id, discovered)
    db.commit()
    return _response(db, region)


@router.put("/{region_id}/discovery", response_model=RegionResponse)
def set_group_discovery(
    region_id: int, body: RegionDiscoveryUpdate, db: Session = Depends(get_db)
) -> RegionResponse:
    region = _get_region(db, region_id)
    if not db.get(Group, body.group_id):
        raise HTTPException(status_code=404, detail="Group not found.")
    set_discovered(db, region.id, body.group_id, body.discovered)
    db.commit()
    return _response(db, region)
