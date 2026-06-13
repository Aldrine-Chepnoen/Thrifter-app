"""add_visual_clusters_and_update_style_categories

Revision ID: 26ba710e0a08
Revises: f256a745378b
Create Date: 2026-06-13 17:30:11.166585

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = '26ba710e0a08'
down_revision: Union[str, Sequence[str], None] = 'f256a745378b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create visual_clusters table
    op.create_table('visual_clusters',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ai_label', sa.String(), nullable=True),
    sa.Column('custom_name', sa.String(), nullable=True),
    sa.Column('centroid_embedding', Vector(512), nullable=True),
    sa.Column('sample_item_ids', sa.Text(), nullable=True),
    sa.Column('created_at', sa.Float(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_visual_clusters_id'), 'visual_clusters', ['id'], unique=False)
    
    # Update style_categories table
    op.add_column('style_categories', sa.Column('top_cluster_id', sa.Integer(), nullable=True))
    op.add_column('style_categories', sa.Column('bottom_cluster_id', sa.Integer(), nullable=True))
    op.add_column('style_categories', sa.Column('accessory_cluster_id', sa.Integer(), nullable=True))
    
    op.create_foreign_key('fk_style_categories_top_cluster', 'style_categories', 'visual_clusters', ['top_cluster_id'], ['id'])
    op.create_foreign_key('fk_style_categories_bottom_cluster', 'style_categories', 'visual_clusters', ['bottom_cluster_id'], ['id'])
    op.create_foreign_key('fk_style_categories_accessory_cluster', 'style_categories', 'visual_clusters', ['accessory_cluster_id'], ['id'])
    
    op.drop_column('style_categories', 'centroid_embedding')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('style_categories', sa.Column('centroid_embedding', Vector(512), nullable=True))
    
    op.drop_constraint('fk_style_categories_accessory_cluster', 'style_categories', type_='foreignkey')
    op.drop_constraint('fk_style_categories_bottom_cluster', 'style_categories', type_='foreignkey')
    op.drop_constraint('fk_style_categories_top_cluster', 'style_categories', type_='foreignkey')
    
    op.drop_column('style_categories', 'accessory_cluster_id')
    op.drop_column('style_categories', 'bottom_cluster_id')
    op.drop_column('style_categories', 'top_cluster_id')
    
    op.drop_index(op.f('ix_visual_clusters_id'), table_name='visual_clusters')
    op.drop_table('visual_clusters')
