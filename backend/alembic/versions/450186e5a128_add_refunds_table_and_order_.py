"""add refunds table and order cancellation fields

Revision ID: 450186e5a128
Revises: b2c3d4e5f6a7
Create Date: 2026-08-30 20:49:54.721712

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '450186e5a128'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # order_items.item_id must be nullable so a cancelled order's item can be
    # deleted from the catalog (reason="item_unavailable") without destroying
    # the order's own history — item_name_snapshot/price_at_purchase carry
    # that instead. ON DELETE SET NULL backs this at the DB level too.
    op.alter_column('order_items', 'item_id', existing_type=sa.Integer(), nullable=True)
    op.drop_constraint('order_items_item_id_fkey', 'order_items', type_='foreignkey')
    op.create_foreign_key(
        'order_items_item_id_fkey', 'order_items', 'items',
        ['item_id'], ['id'], ondelete='SET NULL',
    )

    op.add_column('orders', sa.Column('cancel_reason', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('cancel_note', sa.Text(), nullable=True))
    op.add_column('orders', sa.Column('cancelled_at', sa.DateTime(), nullable=True))
    op.add_column('orders', sa.Column('cancelled_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'orders_cancelled_by_user_id_fkey', 'orders', 'users',
        ['cancelled_by_user_id'], ['id'],
    )

    op.create_table(
        'refunds',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=False, unique=True),
        sa.Column('checkout_id', sa.Integer(), sa.ForeignKey('checkouts.id'), nullable=False, index=True),
        sa.Column('subtotal_refunded', sa.Float(), nullable=False),
        sa.Column('delivery_fee_refunded', sa.Float(), nullable=False, server_default='0'),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False, server_default='UGX'),
        sa.Column('destination_phone', sa.String(), nullable=False),
        sa.Column('destination_name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('provider', sa.String(), nullable=True),
        sa.Column('provider_ref', sa.String(), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_refunds_status', 'refunds', ['status'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_refunds_status', table_name='refunds')
    op.drop_table('refunds')

    op.drop_constraint('orders_cancelled_by_user_id_fkey', 'orders', type_='foreignkey')
    op.drop_column('orders', 'cancelled_by_user_id')
    op.drop_column('orders', 'cancelled_at')
    op.drop_column('orders', 'cancel_note')
    op.drop_column('orders', 'cancel_reason')

    op.drop_constraint('order_items_item_id_fkey', 'order_items', type_='foreignkey')
    op.create_foreign_key(
        'order_items_item_id_fkey', 'order_items', 'items',
        ['item_id'], ['id'],
    )
    op.alter_column('order_items', 'item_id', existing_type=sa.Integer(), nullable=False)
