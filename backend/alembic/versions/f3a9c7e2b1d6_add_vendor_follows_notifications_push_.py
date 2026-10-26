"""add vendor follows, notifications, push tokens, items.created_at

Revision ID: f3a9c7e2b1d6
Revises: a1c3e5f7b9d2
Create Date: 2026-10-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3a9c7e2b1d6'
down_revision: Union[str, Sequence[str], None] = 'a1c3e5f7b9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('items', sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False))

    op.create_table('vendor_follows',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('vendor_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'vendor_id', name='uq_vendor_follow_user_vendor')
    )
    op.create_index(op.f('ix_vendor_follows_id'), 'vendor_follows', ['id'], unique=False)
    op.create_index(op.f('ix_vendor_follows_user_id'), 'vendor_follows', ['user_id'], unique=False)
    op.create_index(op.f('ix_vendor_follows_vendor_id'), 'vendor_follows', ['vendor_id'], unique=False)

    op.create_table('notifications',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('vendor_id', sa.Integer(), nullable=True),
    sa.Column('message', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('read_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'], unique=False)

    op.create_table('push_tokens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('token', sa.String(), nullable=False),
    sa.Column('platform', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token')
    )
    op.create_index(op.f('ix_push_tokens_id'), 'push_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_push_tokens_user_id'), 'push_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_push_tokens_user_id'), table_name='push_tokens')
    op.drop_index(op.f('ix_push_tokens_id'), table_name='push_tokens')
    op.drop_table('push_tokens')

    op.drop_index(op.f('ix_notifications_created_at'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_table('notifications')

    op.drop_index(op.f('ix_vendor_follows_vendor_id'), table_name='vendor_follows')
    op.drop_index(op.f('ix_vendor_follows_user_id'), table_name='vendor_follows')
    op.drop_index(op.f('ix_vendor_follows_id'), table_name='vendor_follows')
    op.drop_table('vendor_follows')

    op.drop_column('items', 'created_at')
