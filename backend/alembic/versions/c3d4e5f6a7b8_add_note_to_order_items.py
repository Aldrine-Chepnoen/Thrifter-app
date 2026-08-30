"""Add note to order_items

Revision ID: c3d4e5f6a7b8
Revises: 450186e5a128
Create Date: 2026-08-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = '450186e5a128'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('order_items', sa.Column('note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('order_items', 'note')
