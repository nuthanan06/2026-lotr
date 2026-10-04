"""add_map_mechanics

Adds the Middle-earth map mechanics: character position / race / corruption,
the singleton game state (Ring holder, corruption clock), regions (seeded
from app/data/regions.json), conflicts with their parties, movement history,
and note links (co-authors/targets, action, conflict).

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-04 12:00:00.000000

"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_REGIONS_JSON = Path(__file__).resolve().parents[2] / "app" / "data" / "regions.json"

note_action_enum = postgresql.ENUM(
    "NONE", "MOVE", "MOBILIZE", "CONFLICT", "RING", name="note_action_enum", create_type=False
)
note_role_enum = postgresql.ENUM("AUTHOR", "TARGET", name="note_role_enum", create_type=False)
conflict_status_enum = postgresql.ENUM(
    "ONGOING", "RESOLVED", name="conflict_status_enum", create_type=False
)


def upgrade() -> None:
    # ADD VALUE can't run inside the migration's transaction on older
    # Postgres versions, so give it its own.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE note_type_enum ADD VALUE IF NOT EXISTS 'CRISIS_UPDATE'")

    bind = op.get_bind()
    note_action_enum.create(bind, checkfirst=True)
    note_role_enum.create(bind, checkfirst=True)
    conflict_status_enum.create(bind, checkfirst=True)

    op.add_column(
        "characters", sa.Column("race", sa.String(32), server_default="MAN", nullable=False)
    )
    op.add_column("characters", sa.Column("avatar_url", sa.String(1024), nullable=True))
    op.add_column("characters", sa.Column("x", sa.Float(), nullable=True))
    op.add_column("characters", sa.Column("y", sa.Float(), nullable=True))
    op.add_column(
        "characters",
        sa.Column("army_mobilized", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "characters",
        sa.Column("corruption_base", sa.Float(), server_default="0", nullable=False),
    )
    op.add_column(
        "characters",
        sa.Column("corruption_updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "game_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ring_holder_id", sa.Integer(), nullable=True),
        sa.Column("clock_paused", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["ring_holder_id"], ["characters.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    regions = op.create_table(
        "regions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("polygon", sa.JSON(), nullable=False),
        sa.Column("discovered", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("status", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "conflicts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", conflict_status_enum, server_default="ONGOING", nullable=False),
        sa.Column("winner_id", sa.Integer(), nullable=True),
        sa.Column("outcome_summary", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["winner_id"], ["characters.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "conflict_parties",
        sa.Column("conflict_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["conflict_id"], ["conflicts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("conflict_id", "character_id"),
    )

    op.add_column(
        "crisis_notes",
        sa.Column("action", note_action_enum, server_default="NONE", nullable=False),
    )
    op.add_column("crisis_notes", sa.Column("conflict_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_crisis_notes_conflict_id",
        "crisis_notes",
        "conflicts",
        ["conflict_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "note_characters",
        sa.Column("note_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("role", note_role_enum, nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["crisis_notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("note_id", "character_id", "role"),
    )

    op.create_table(
        "movements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("from_x", sa.Float(), nullable=True),
        sa.Column("from_y", sa.Float(), nullable=True),
        sa.Column("to_x", sa.Float(), nullable=False),
        sa.Column("to_y", sa.Float(), nullable=False),
        sa.Column("from_region_id", sa.Integer(), nullable=True),
        sa.Column("to_region_id", sa.Integer(), nullable=True),
        sa.Column("note_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_region_id"], ["regions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["to_region_id"], ["regions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["note_id"], ["crisis_notes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_movements_character_id", "movements", ["character_id"])

    op.execute("INSERT INTO game_state (id, clock_paused) VALUES (1, false)")
    seed = json.loads(_REGIONS_JSON.read_text(encoding="utf-8"))
    op.bulk_insert(
        regions,
        [
            {
                "slug": r["slug"],
                "name": r["name"],
                "polygon": r["polygon"],
                "discovered": r["discovered"],
                "status": r.get("status"),
            }
            for r in seed
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_movements_character_id", table_name="movements")
    op.drop_table("movements")
    op.drop_table("note_characters")
    op.drop_constraint("fk_crisis_notes_conflict_id", "crisis_notes", type_="foreignkey")
    op.drop_column("crisis_notes", "conflict_id")
    op.drop_column("crisis_notes", "action")
    op.drop_table("conflict_parties")
    op.drop_table("conflicts")
    op.drop_table("regions")
    op.drop_table("game_state")
    for column in (
        "corruption_updated_at",
        "corruption_base",
        "army_mobilized",
        "y",
        "x",
        "avatar_url",
        "race",
    ):
        op.drop_column("characters", column)
    bind = op.get_bind()
    conflict_status_enum.drop(bind, checkfirst=True)
    note_role_enum.drop(bind, checkfirst=True)
    note_action_enum.drop(bind, checkfirst=True)
    # Postgres can't drop a single enum value; CRISIS_UPDATE stays on
    # note_type_enum, which is harmless once nothing uses it.
    op.execute("DELETE FROM crisis_notes WHERE note_type = 'CRISIS_UPDATE'")
