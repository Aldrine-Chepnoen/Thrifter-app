"""Add payment_method to checkouts

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-01 00:00:00.000000

Enables cash-on-delivery as an alternative to mobile money at checkout.
Every existing checkout was paid via Nylon Pay, hence the server_default.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('checkouts', sa.Column('payment_method', sa.String(), nullable=False, server_default='mobile_money'))


def downgrade() -> None:
    op.drop_column('checkouts', 'payment_method')
