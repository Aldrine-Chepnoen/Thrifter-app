"""add style_categories table

Revision ID: 4f783a131107
Revises: b1e2f3a4c5d6
Create Date: 2026-06-13 00:54:59.116441

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = '4f783a131107'
down_revision: Union[str, Sequence[str], None] = 'b1e2f3a4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('style_categories',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(), nullable=True),
    sa.Column('name', sa.String(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('centroid_embedding', Vector(512), nullable=True),
    sa.Column('is_approved', sa.Boolean(), nullable=True),
    sa.Column('sample_item_ids', sa.Text(), nullable=True),
    sa.Column('created_at', sa.Float(), nullable=True),
    sa.Column('updated_at', sa.Float(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_style_categories_id'), 'style_categories', ['id'], unique=False)
    op.create_index(op.f('ix_style_categories_slug'), 'style_categories', ['slug'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_style_categories_slug'), table_name='style_categories')
    op.drop_index(op.f('ix_style_categories_id'), table_name='style_categories')
    op.drop_table('style_categories')
