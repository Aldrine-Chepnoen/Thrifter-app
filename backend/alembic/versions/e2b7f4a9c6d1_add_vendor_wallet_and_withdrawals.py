"""add vendor wallet and withdrawals

Revision ID: e2b7f4a9c6d1
Revises: c8f1a5e3b7d2
Create Date: 2026-08-28 00:00:00.000000

Adds the vendor wallet ledger (vendor_wallet_transactions) and withdrawal
requests (vendor_withdrawals), replacing the old VendorPayout mechanism
(credited at payment time, never got a UI). Deliberately does NOT drop the
existing vendor_payouts table — it's live-production data with no benefit
to a destructive drop; the ORM model was simply retired in code.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2b7f4a9c6d1'
down_revision: Union[str, Sequence[str], None] = 'c8f1a5e3b7d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('vendor_withdrawals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('vendor_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Float(), nullable=False),
    sa.Column('destination_phone', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('provider', sa.String(), nullable=True),
    sa.Column('provider_ref', sa.String(), nullable=True),
    sa.Column('failure_reason', sa.Text(), nullable=True),
    sa.Column('requested_at', sa.DateTime(), nullable=False),
    sa.Column('reviewed_at', sa.DateTime(), nullable=True),
    sa.Column('reviewed_by_user_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['reviewed_by_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vendor_withdrawals_id'), 'vendor_withdrawals', ['id'], unique=False)
    op.create_index(op.f('ix_vendor_withdrawals_vendor_id'), 'vendor_withdrawals', ['vendor_id'], unique=False)
    op.create_index(op.f('ix_vendor_withdrawals_status'), 'vendor_withdrawals', ['status'], unique=False)

    op.create_table('vendor_wallet_transactions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('vendor_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Float(), nullable=False),
    sa.Column('reason', sa.String(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=True),
    sa.Column('withdrawal_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ),
    sa.ForeignKeyConstraint(['withdrawal_id'], ['vendor_withdrawals.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('order_id')
    )
    op.create_index(op.f('ix_vendor_wallet_transactions_id'), 'vendor_wallet_transactions', ['id'], unique=False)
    op.create_index(op.f('ix_vendor_wallet_transactions_vendor_id'), 'vendor_wallet_transactions', ['vendor_id'], unique=False)
    op.create_index(op.f('ix_vendor_wallet_transactions_reason'), 'vendor_wallet_transactions', ['reason'], unique=False)
    op.create_index(op.f('ix_vendor_wallet_transactions_withdrawal_id'), 'vendor_wallet_transactions', ['withdrawal_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_vendor_wallet_transactions_withdrawal_id'), table_name='vendor_wallet_transactions')
    op.drop_index(op.f('ix_vendor_wallet_transactions_reason'), table_name='vendor_wallet_transactions')
    op.drop_index(op.f('ix_vendor_wallet_transactions_vendor_id'), table_name='vendor_wallet_transactions')
    op.drop_index(op.f('ix_vendor_wallet_transactions_id'), table_name='vendor_wallet_transactions')
    op.drop_table('vendor_wallet_transactions')
    op.drop_index(op.f('ix_vendor_withdrawals_status'), table_name='vendor_withdrawals')
    op.drop_index(op.f('ix_vendor_withdrawals_vendor_id'), table_name='vendor_withdrawals')
    op.drop_index(op.f('ix_vendor_withdrawals_id'), table_name='vendor_withdrawals')
    op.drop_table('vendor_withdrawals')
