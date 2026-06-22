"""Add composite index on item_views for dedup queries

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_item_views_dedup',
        'item_views',
        ['item_id', 'user_id', 'viewed_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_item_views_dedup', table_name='item_views')
