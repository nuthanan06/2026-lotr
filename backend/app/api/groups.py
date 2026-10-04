from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.map import Group
from app.schemas import (
    GroupCreate,
    GroupMembersUpdate,
    GroupResponse,
    GroupUpdate,
    GroupViewResponse,
)
from app.services.groups import assign, default_group, last_seen
from app.services.notes import require_characters

router = APIRouter(prefix="/groups", tags=["groups"])


def _response(group: Group) -> GroupResponse:
    return GroupResponse(
        id=group.id,
        name=group.name,
        color=group.color,
        created_at=group.created_at,
        member_ids=[c.id for c in group.members],
    )


def _get_group(db: Session, group_id: int) -> Group:
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    return group


@router.get("", response_model=list[GroupResponse])
def list_groups(db: Session = Depends(get_db)) -> list[GroupResponse]:
    groups = db.query(Group).options(selectinload(Group.members)).order_by(Group.id).all()
    return [_response(g) for g in groups]


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(body: GroupCreate, db: Session = Depends(get_db)) -> GroupResponse:
    group = Group(name=body.name, color=body.color)
    db.add(group)
    db.flush()
    for character in require_characters(db, body.member_ids):
        assign(db, character, group.id)
    db.commit()
    db.refresh(group)
    return _response(group)


@router.patch("/{group_id}", response_model=GroupResponse)
def update_group(group_id: int, body: GroupUpdate, db: Session = Depends(get_db)) -> GroupResponse:
    group = _get_group(db, group_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(group, field, value)
    db.commit()
    db.refresh(group)
    return _response(group)


@router.post("/{group_id}/members", response_model=GroupResponse)
def add_members(
    group_id: int, body: GroupMembersUpdate, db: Session = Depends(get_db)
) -> GroupResponse:
    group = _get_group(db, group_id)
    for character in require_characters(db, body.character_ids):
        assign(db, character, group.id)
    db.commit()
    db.refresh(group)
    return _response(group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_group(group_id: int, db: Session = Depends(get_db)) -> None:
    group = _get_group(db, group_id)
    fallback = default_group(db)
    if fallback is None or fallback.id == group.id:
        raise HTTPException(
            status_code=409, detail="The starting group can't be deleted; rename it instead."
        )
    # Members rejoin the starting group rather than becoming groupless.
    for character in list(group.members):
        assign(db, character, fallback.id)
    # Reload the (now empty) member list so deleting the group doesn't null
    # out the members' new group_id via the stale relationship.
    db.flush()
    db.expire(group, ["members"])
    db.delete(group)
    db.commit()


@router.get("/{group_id}/view", response_model=GroupViewResponse)
def group_view(group_id: int, db: Session = Depends(get_db)) -> GroupViewResponse:
    group = _get_group(db, group_id)
    return GroupViewResponse(
        group=_response(group),
        member_ids=[c.id for c in group.members],
        last_seen=last_seen(db, group),
    )
