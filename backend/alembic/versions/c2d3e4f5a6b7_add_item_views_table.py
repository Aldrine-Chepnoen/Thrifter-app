"""Add item_views table

Revision ID: c2d3e4f5a6b7
Revises: e1f2g3h4i5j6
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, Sequence[str], None] = 'e1f2g3h4i5j6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'item_views',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('viewed_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_item_views_id'), 'item_views', ['id'], unique=False)
    op.create_index(op.f('ix_item_views_item_id'), 'item_views', ['item_id'], unique=False)
    op.create_index(op.f('ix_item_views_viewed_at'), 'item_views', ['viewed_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_item_views_viewed_at'), table_name='item_views')
    op.drop_index(op.f('ix_item_views_item_id'), table_name='item_views')
    op.drop_index(op.f('ix_item_views_id'), table_name='item_views')
    op.drop_table('item_views')
