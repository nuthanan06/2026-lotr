from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    String,
    Table,
    Text,
    func,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.crisis_note import Character, CrisisNote


def new_screen_token() -> str:
    return uuid.uuid4().hex


class ConflictStatus(str, enum.Enum):
    ONGOING = "ONGOING"
    RESOLVED = "RESOLVED"


class GameState(Base):
    """Committee-wide state that has exactly one value at a time.

    Always a single row with id=1 (seeded by the migration). Keeping the Ring
    holder here rather than as a per-character flag makes "two people hold
    the One Ring" unrepresentable.
    """

    __tablename__ = "game_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    ring_holder_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id", ondelete="SET NULL"), nullable=True
    )
    # Pauses corruption accrual between committee sessions (overnight,
    # lunch) so the Ring holder isn't corrupted while nobody is playing.
    clock_paused: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    # Secret link for the whole-committee delegate screen (see Group.screen_token).
    screen_token: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, default=new_screen_token
    )

    ring_holder: Mapped[Character | None] = relationship("Character")


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Outline as [[x, y], ...] in the same 0–1 map-fraction space as
    # Character.x / Character.y.
    polygon: Mapped[list[list[float]]] = mapped_column(JSON, nullable=False)
    status: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


conflict_parties = Table(
    "conflict_parties",
    Base.metadata,
    Column("conflict_id", ForeignKey("conflicts.id", ondelete="CASCADE"), primary_key=True),
    Column("character_id", ForeignKey("characters.id", ondelete="CASCADE"), primary_key=True),
)


class Conflict(Base):
    __tablename__ = "conflicts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ConflictStatus] = mapped_column(
        SAEnum(ConflictStatus, name="conflict_status_enum"),
        nullable=False,
        server_default=ConflictStatus.ONGOING.value,
    )
    winner_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id", ondelete="SET NULL"), nullable=True
    )
    outcome_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Timed crisis: staff are alerted if it's still ongoing at this time.
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    parties: Mapped[list[Character]] = relationship(
        "Character",
        secondary=conflict_parties,
        back_populates="conflicts",
        order_by="Character.name",
    )
    winner: Mapped[Character | None] = relationship("Character", foreign_keys=[winner_id])


class Movement(Base):
    """One map move of a character, with the crisis note that justified it."""

    __tablename__ = "movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    character_id: Mapped[int] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    from_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    to_x: Mapped[float] = mapped_column(Float, nullable=False)
    to_y: Mapped[float] = mapped_column(Float, nullable=False)
    from_region_id: Mapped[int | None] = mapped_column(
        ForeignKey("regions.id", ondelete="SET NULL"), nullable=True
    )
    to_region_id: Mapped[int | None] = mapped_column(
        ForeignKey("regions.id", ondelete="SET NULL"), nullable=True
    )
    note_id: Mapped[int | None] = mapped_column(
        ForeignKey("crisis_notes.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    from_region: Mapped[Region | None] = relationship("Region", foreign_keys=[from_region_id])
    to_region: Mapped[Region | None] = relationship("Region", foreign_keys=[to_region_id])
    note: Mapped[CrisisNote | None] = relationship("CrisisNote")


class Group(Base):
    """A party of characters travelling together, e.g. after the Fellowship
    breaks. Each group gets its own delegate-facing map."""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False)
    # Unguessable id for this group's delegate screen (/screen/<token>). The
    # screen needs no staff login, so the token is what keeps one group from
    # opening another's view; staff can rotate it.
    screen_token: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, default=new_screen_token
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    members: Mapped[list[Character]] = relationship("Character", order_by="Character.name")


class GroupMembership(Base):
    """History of who was in which group when — used to work out where one
    group last saw everyone else."""

    __tablename__ = "group_memberships"

    id: Mapped[int] = mapped_column(primary_key=True)
    character_id: Mapped[int] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GroupRegion(Base):
    """A region one group has discovered. Discovery is per group: lands one
    party finds stay fogged for the others. Delegates only see it once
    revealed (when a crisis update is published)."""

    __tablename__ = "group_regions"

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True
    )
    region_id: Mapped[int] = mapped_column(
        ForeignKey("regions.id", ondelete="CASCADE"), primary_key=True
    )
    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    revealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
