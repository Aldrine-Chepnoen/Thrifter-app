"""add verified_at to vendors

Revision ID: 9a1c4e7f2b3d
Revises: 181f0513408e
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a1c4e7f2b3d'
down_revision: Union[str, Sequence[str], None] = '181f0513408e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('vendors', sa.Column('verified_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('vendors', 'verified_at')
