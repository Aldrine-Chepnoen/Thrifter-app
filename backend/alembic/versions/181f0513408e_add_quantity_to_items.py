"""add quantity to items

Revision ID: 181f0513408e
Revises: f67c223f30cb
Create Date: 2026-08-10 23:18:56.217589

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '181f0513408e'
down_revision: Union[str, Sequence[str], None] = 'f67c223f30cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Existing 600+ item rows have no quantity value — default them to 1 (one-of-a-kind)
    # rather than leaving stock unset.
    op.add_column('items', sa.Column('quantity', sa.Integer(), server_default='1', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('items', 'quantity')
