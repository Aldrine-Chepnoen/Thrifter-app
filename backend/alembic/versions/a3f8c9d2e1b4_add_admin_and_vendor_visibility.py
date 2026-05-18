"""Add is_admin to users and is_active to vendors

Revision ID: a3f8c9d2e1b4
Revises: 7ca274f7187f
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f8c9d2e1b4'
down_revision: Union[str, Sequence[str], None] = '7ca274f7187f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('vendors', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    op.drop_column('users', 'is_admin')
    op.drop_column('vendors', 'is_active')
