"""add vendor banner description location

Revision ID: b060362d090f
Revises: d3e4f5a6b7c8
Create Date: 2026-06-23 01:48:24.088907

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b060362d090f'
down_revision: Union[str, Sequence[str], None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET statement_timeout = 0")
    op.add_column('vendors', sa.Column('banner_image', sa.String(), nullable=True))
    op.add_column('vendors', sa.Column('banner_cloudinary_id', sa.String(), nullable=True))
    op.add_column('vendors', sa.Column('description', sa.String(), nullable=True))
    op.add_column('vendors', sa.Column('location', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('vendors', 'location')
    op.drop_column('vendors', 'description')
    op.drop_column('vendors', 'banner_cloudinary_id')
    op.drop_column('vendors', 'banner_image')
