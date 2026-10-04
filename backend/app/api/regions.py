from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.map import Region
from app.schemas import RegionResponse, RegionUpdate, RevealResult
from app.services.corruption import now_utc

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("", response_model=list[RegionResponse])
def list_regions(db: Session = Depends(get_db)) -> list[Region]:
    return db.query(Region).order_by(Region.name).all()


def reveal_discovered(db: Session) -> list[int]:
    """Show delegates every region staff have discovered since the last reveal."""
    pending = (
        db.query(Region).filter(Region.discovered.is_(True), Region.revealed.is_(False)).all()
    )
    at = now_utc()
    for region in pending:
        region.revealed = True
        region.revealed_at = at
    return [r.id for r in pending]


@router.post("/reveal", response_model=RevealResult)
def reveal(db: Session = Depends(get_db)) -> RevealResult:
    revealed = reveal_discovered(db)
    db.commit()
    return RevealResult(revealed=revealed)


@router.patch("/{region_id}", response_model=RegionResponse)
def update_region(region_id: int, body: RegionUpdate, db: Session = Depends(get_db)) -> Region:
    region = db.get(Region, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found.")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "discovered" and value is None:
            continue
        setattr(region, field, value)
    if not region.discovered:
        # Hiding a region again takes effect for delegates immediately.
        region.revealed = False
        region.revealed_at = None
    db.commit()
    db.refresh(region)
    return region
