"""Add added_at to wardrobe, index item_id

Revision ID: a1b2c3d4e5f6
Revises: 7e62eaa903be
Create Date: 2026-08-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '7e62eaa903be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'wardrobe',
        sa.Column('added_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_wardrobe_item_id'), 'wardrobe', ['item_id'], unique=False)
    op.create_index(op.f('ix_wardrobe_added_at'), 'wardrobe', ['added_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_wardrobe_added_at'), table_name='wardrobe')
    op.drop_index(op.f('ix_wardrobe_item_id'), table_name='wardrobe')
    op.drop_column('wardrobe', 'added_at')
