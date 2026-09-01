"""add is_hidden to items and vendor_subscriptions table

Revision ID: a7d3e9f21c48
Revises: b3e7a1c9f2d4
Create Date: 2026-08-27 00:00:00.000000

Schema-only for the vendor premium tier. Every existing item defaults
is_hidden=false, so this revision alone changes nothing for real traffic.
The grandfather hide-pass for vendors already over the free slot limit is a
separate, deliberately gated revision (see the next migration).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7d3e9f21c48'
down_revision: Union[str, Sequence[str], None] = 'b3e7a1c9f2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('items', sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index(op.f('ix_items_is_hidden'), 'items', ['is_hidden'], unique=False)
    op.create_index('ix_items_vendor_id_is_hidden', 'items', ['vendor_id', 'is_hidden'], unique=False)

    op.create_table('vendor_subscriptions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('vendor_id', sa.Integer(), nullable=False),
    sa.Column('provider', sa.String(), nullable=False),
    sa.Column('tx_ref', sa.String(), nullable=False),
    sa.Column('provider_tx_id', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('amount', sa.Float(), nullable=False),
    sa.Column('currency', sa.String(), nullable=False),
    sa.Column('period_days', sa.Integer(), nullable=False),
    sa.Column('starts_at', sa.DateTime(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('raw_response', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tx_ref')
    )
    op.create_index(op.f('ix_vendor_subscriptions_id'), 'vendor_subscriptions', ['id'], unique=False)
    op.create_index(op.f('ix_vendor_subscriptions_vendor_id'), 'vendor_subscriptions', ['vendor_id'], unique=False)
    op.create_index(op.f('ix_vendor_subscriptions_provider_tx_id'), 'vendor_subscriptions', ['provider_tx_id'], unique=False)
    op.create_index(op.f('ix_vendor_subscriptions_status'), 'vendor_subscriptions', ['status'], unique=False)
    op.create_index(op.f('ix_vendor_subscriptions_expires_at'), 'vendor_subscriptions', ['expires_at'], unique=False)
    op.create_index(op.f('ix_vendor_subscriptions_tx_ref'), 'vendor_subscriptions', ['tx_ref'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_vendor_subscriptions_tx_ref'), table_name='vendor_subscriptions')
    op.drop_index(op.f('ix_vendor_subscriptions_expires_at'), table_name='vendor_subscriptions')
    op.drop_index(op.f('ix_vendor_subscriptions_status'), table_name='vendor_subscriptions')
    op.drop_index(op.f('ix_vendor_subscriptions_provider_tx_id'), table_name='vendor_subscriptions')
    op.drop_index(op.f('ix_vendor_subscriptions_vendor_id'), table_name='vendor_subscriptions')
    op.drop_index(op.f('ix_vendor_subscriptions_id'), table_name='vendor_subscriptions')
    op.drop_table('vendor_subscriptions')
    op.drop_index('ix_items_vendor_id_is_hidden', table_name='items')
    op.drop_index(op.f('ix_items_is_hidden'), table_name='items')
    op.drop_column('items', 'is_hidden')
