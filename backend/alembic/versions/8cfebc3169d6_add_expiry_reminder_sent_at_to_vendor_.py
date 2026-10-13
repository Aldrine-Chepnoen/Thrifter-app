"""add expiry_reminder_sent_at to vendor_subscriptions

Revision ID: 8cfebc3169d6
Revises: 8b61653ed8e6
Create Date: 2026-10-04 16:57:58.652773

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8cfebc3169d6'
down_revision: Union[str, Sequence[str], None] = '8b61653ed8e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# NOTE: autogenerate also detected three unrelated pre-existing drifts between
# models.py and the live schema (dropping the 'vendor_payouts' table, a
# NOT NULL on users.is_vendor, dropping vendor_subscriptions' tx_ref unique
# constraint) — deliberately left out of this migration. None of those were
# asked for, and silently applying them (especially a table drop and a
# uniqueness drop on a payment reference) as a side effect of an unrelated
# feature isn't something to do without separate, explicit sign-off.


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('vendor_subscriptions', sa.Column('expiry_reminder_sent_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('vendor_subscriptions', 'expiry_reminder_sent_at')
