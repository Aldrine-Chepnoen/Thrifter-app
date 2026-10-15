"""add apple_sub to users

Revision ID: 9d1a2e4b6f7c
Revises: 8cfebc3169d6
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d1a2e4b6f7c'
down_revision: Union[str, Sequence[str], None] = '8cfebc3169d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('apple_sub', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_apple_sub'), 'users', ['apple_sub'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_users_apple_sub'), table_name='users')
    op.drop_column('users', 'apple_sub')
