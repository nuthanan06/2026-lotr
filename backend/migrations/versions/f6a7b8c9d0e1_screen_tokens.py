"""screen_tokens

Secret, rotatable links for delegate screens: one per group plus one for the
whole committee, so delegate devices need no staff login and one group can't
open another's view by guessing an id.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-05 10:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TOKEN = "replace(gen_random_uuid()::text, '-', '')"


def upgrade() -> None:
    for table in ("groups", "game_state"):
        op.add_column(table, sa.Column("screen_token", sa.String(64), nullable=True))
        op.execute(f"UPDATE {table} SET screen_token = {_TOKEN}")
        op.alter_column(table, "screen_token", nullable=False)
        op.create_unique_constraint(f"uq_{table}_screen_token", table, ["screen_token"])


def downgrade() -> None:
    for table in ("groups", "game_state"):
        op.drop_constraint(f"uq_{table}_screen_token", table, type_="unique")
        op.drop_column(table, "screen_token")
