"""groups_reveal_timers_curve

- Groups (with membership history) so a split committee gets per-group maps.
  Everyone starts in "The Fellowship".
- Regions are revealed to delegates separately from being discovered, so
  reveals can land with each crisis update.
- Timed crises: deadlines on conflicts and notes, plus note resolution.
- Corruption moves to a quadratic curve (a × hours_held²): existing values
  are converted to the equivalent holding time on each race's default curve.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-04 15:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Mirrors app/services/corruption.py RACE_CURVE_A at the time of writing.
_CURVE_A = {"HOBBIT": 0.5, "WIZARD": 0.8, "ELF": 1.0, "DWARF": 1.2, "MAN": 1.5, "ORC": 2.0}
_A_SQL = "CASE race " + " ".join(f"WHEN '{r}' THEN {a}" for r, a in _CURVE_A.items()) + " ELSE 1.0 END"


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("color", sa.String(16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "group_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_group_memberships_character_id", "group_memberships", ["character_id"])
    op.create_index("ix_group_memberships_group_id", "group_memberships", ["group_id"])

    op.add_column("characters", sa.Column("group_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_characters_group_id", "characters", "groups", ["group_id"], ["id"], ondelete="SET NULL"
    )
    op.add_column(
        "characters", sa.Column("ring_hours", sa.Float(), server_default="0", nullable=False)
    )
    op.add_column("characters", sa.Column("corruption_a", sa.Float(), nullable=True))
    # Same corruption, expressed as time-held on the new curve.
    op.execute(f"UPDATE characters SET ring_hours = sqrt(GREATEST(corruption_base, 0) / ({_A_SQL}))")
    op.drop_column("characters", "corruption_base")

    op.execute("INSERT INTO groups (id, name, color) VALUES (1, 'The Fellowship', '#d08700')")
    op.execute("SELECT setval(pg_get_serial_sequence('groups', 'id'), 1)")
    op.execute("UPDATE characters SET group_id = 1")
    op.execute(
        "INSERT INTO group_memberships (character_id, group_id, joined_at) "
        "SELECT id, 1, created_at FROM characters"
    )

    op.add_column(
        "regions", sa.Column("revealed", sa.Boolean(), server_default=sa.text("false"), nullable=False)
    )
    op.add_column("regions", sa.Column("revealed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE regions SET revealed = discovered, revealed_at = CASE WHEN discovered THEN now() END")

    op.add_column("conflicts", sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crisis_notes", sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crisis_notes", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("crisis_notes", "resolved_at")
    op.drop_column("crisis_notes", "deadline_at")
    op.drop_column("conflicts", "deadline_at")
    op.drop_column("regions", "revealed_at")
    op.drop_column("regions", "revealed")

    op.add_column(
        "characters", sa.Column("corruption_base", sa.Float(), server_default="0", nullable=False)
    )
    op.execute(
        "UPDATE characters SET corruption_base = "
        f"LEAST(100, COALESCE(corruption_a, {_A_SQL}) * ring_hours * ring_hours)"
    )
    op.drop_column("characters", "corruption_a")
    op.drop_column("characters", "ring_hours")
    op.drop_constraint("fk_characters_group_id", "characters", type_="foreignkey")
    op.drop_column("characters", "group_id")

    op.drop_index("ix_group_memberships_group_id", table_name="group_memberships")
    op.drop_index("ix_group_memberships_character_id", table_name="group_memberships")
    op.drop_table("group_memberships")
    op.drop_table("groups")
