"""per_group_discovery

Discovery becomes per group: a region one travelling group finds stays
fogged for the others. Existing discoveries are given to every group.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-04 20:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "group_regions",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("region_id", sa.Integer(), nullable=False),
        sa.Column(
            "discovered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("revealed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["region_id"], ["regions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "region_id"),
    )
    op.execute(
        "INSERT INTO group_regions (group_id, region_id, discovered_at, revealed_at) "
        "SELECT g.id, r.id, now(), CASE WHEN r.revealed THEN COALESCE(r.revealed_at, now()) END "
        "FROM regions r CROSS JOIN groups g WHERE r.discovered"
    )
    op.drop_column("regions", "revealed_at")
    op.drop_column("regions", "revealed")
    op.drop_column("regions", "discovered")


def downgrade() -> None:
    op.add_column(
        "regions", sa.Column("discovered", sa.Boolean(), server_default=sa.text("false"), nullable=False)
    )
    op.add_column(
        "regions", sa.Column("revealed", sa.Boolean(), server_default=sa.text("false"), nullable=False)
    )
    op.add_column("regions", sa.Column("revealed_at", sa.DateTime(timezone=True), nullable=True))
    # Collapse back to one shared state: known to any group.
    op.execute(
        "UPDATE regions r SET discovered = true, revealed = s.revealed, revealed_at = s.revealed_at "
        "FROM (SELECT region_id, bool_or(revealed_at IS NOT NULL) AS revealed, "
        "max(revealed_at) AS revealed_at FROM group_regions GROUP BY region_id) s "
        "WHERE s.region_id = r.id"
    )
    op.drop_table("group_regions")
