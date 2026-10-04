from __future__ import annotations

import enum
from datetime import datetime

from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Table,
    Text,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.map import Conflict


class Priority(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class NoteType(str, enum.Enum):
    PRIVATE_DIRECTIVE = "PRIVATE_DIRECTIVE"
    PUBLIC_DIRECTIVE = "PUBLIC_DIRECTIVE"
    # Logged by the system or crisis staff rather than written by a delegate,
    # e.g. "conflict started" / "conflict resolved" entries.
    CRISIS_UPDATE = "CRISIS_UPDATE"


class NoteAction(str, enum.Enum):
    """What a note asks for / records happening on the map."""

    NONE = "NONE"
    MOVE = "MOVE"
    MOBILIZE = "MOBILIZE"
    CONFLICT = "CONFLICT"
    RING = "RING"


class NoteRole(str, enum.Enum):
    AUTHOR = "AUTHOR"
    TARGET = "TARGET"


# Extra characters attached to a note beyond the one it is filed under
# (CrisisNote.character_id): co-authors, and characters it is aimed at or
# assigned to ("Conflict With/Assigned to" in the add-note form).
note_characters = Table(
    "note_characters",
    Base.metadata,
    Column("note_id", ForeignKey("crisis_notes.id", ondelete="CASCADE"), primary_key=True),
    Column("character_id", ForeignKey("characters.id", ondelete="CASCADE"), primary_key=True),
    Column("role", SAEnum(NoteRole, name="note_role_enum"), primary_key=True),
)


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    race: Mapped[str] = mapped_column(String(32), nullable=False, server_default="MAN")
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Map position as fractions (0–1) of the map image's width/height, measured
    # from the top-left corner. Null until the character is first placed.
    x: Mapped[float | None] = mapped_column(Float, nullable=True)
    y: Mapped[float | None] = mapped_column(Float, nullable=True)
    army_mobilized: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    # Corruption follows a quadratic curve in Ring-holding time and is derived
    # on read, not ticked by a job (see app/services/corruption.py):
    #   corruption = a * hours_held²
    # ring_hours banks holding time from earlier stints; corruption_updated_at
    # marks when the current stint started.
    corruption_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ring_hours: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    # Per-character curve steepness ("a"); null uses the race default.
    corruption_a: Mapped[float | None] = mapped_column(Float, nullable=True)
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    crisis_notes: Mapped[list[CrisisNote]] = relationship(
        "CrisisNote", back_populates="character", cascade="all, delete-orphan"
    )
    conflicts: Mapped[list[Conflict]] = relationship(
        "Conflict", secondary="conflict_parties", back_populates="parties"
    )


class CrisisPeriod(Base):
    __tablename__ = "crisis_periods"
    __table_args__ = (
        # Postgres partial unique index: at most one row can have is_active
        # true at a time. Makes "only one active period" a DB-level
        # guarantee instead of a check-then-insert race in the API layer.
        Index(
            "ix_crisis_periods_one_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    crisis_notes: Mapped[list[CrisisNote]] = relationship(
        "CrisisNote", back_populates="period"
    )
    staff_notes: Mapped[list[StaffNote]] = relationship(
        "StaffNote", back_populates="period"
    )


class CrisisNote(Base):
    __tablename__ = "crisis_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    character_id: Mapped[int] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    period_id: Mapped[int] = mapped_column(
        ForeignKey("crisis_periods.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    crisis_staff_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[Priority] = mapped_column(
        SAEnum(Priority, name="priority_enum"), nullable=False
    )
    note_type: Mapped[NoteType] = mapped_column(
        SAEnum(NoteType, name="note_type_enum"), nullable=False
    )
    action: Mapped[NoteAction] = mapped_column(
        SAEnum(NoteAction, name="note_action_enum"),
        nullable=False,
        server_default=NoteAction.NONE.value,
    )
    conflict_id: Mapped[int | None] = mapped_column(
        ForeignKey("conflicts.id", ondelete="SET NULL"), nullable=True
    )
    # Timed crisis: staff are alerted if the note isn't resolved by then.
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    character: Mapped[Character] = relationship("Character", back_populates="crisis_notes")
    period: Mapped[CrisisPeriod] = relationship("CrisisPeriod", back_populates="crisis_notes")
    authors: Mapped[list[Character]] = relationship(
        "Character",
        secondary=note_characters,
        primaryjoin=lambda: (CrisisNote.id == note_characters.c.note_id)
        & (note_characters.c.role == NoteRole.AUTHOR),
        viewonly=True,
        order_by="Character.name",
    )
    targets: Mapped[list[Character]] = relationship(
        "Character",
        secondary=note_characters,
        primaryjoin=lambda: (CrisisNote.id == note_characters.c.note_id)
        & (note_characters.c.role == NoteRole.TARGET),
        viewonly=True,
        order_by="Character.name",
    )


class StaffNote(Base):
    __tablename__ = "staff_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    period_id: Mapped[int] = mapped_column(
        ForeignKey("crisis_periods.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    period: Mapped[CrisisPeriod] = relationship("CrisisPeriod", back_populates="staff_notes")
