"""add per-item cancellation fields to order_items

Revision ID: a1c3e5f7b9d2
Revises: 9d1a2e4b6f7c
Create Date: 2026-10-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c3e5f7b9d2'
down_revision: Union[str, Sequence[str], None] = '9d1a2e4b6f7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('order_items', sa.Column('cancelled_at', sa.DateTime(), nullable=True))
    op.add_column('order_items', sa.Column('cancel_reason', sa.String(), nullable=True))
    op.add_column('order_items', sa.Column('cancel_note', sa.Text(), nullable=True))
    op.add_column('order_items', sa.Column('cancelled_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'order_items_cancelled_by_user_id_fkey',
        'order_items', 'users',
        ['cancelled_by_user_id'], ['id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('order_items_cancelled_by_user_id_fkey', 'order_items', type_='foreignkey')
    op.drop_column('order_items', 'cancelled_by_user_id')
    op.drop_column('order_items', 'cancel_note')
    op.drop_column('order_items', 'cancel_reason')
    op.drop_column('order_items', 'cancelled_at')
