"""add order_items.quantity, drop items.reserved_until

Revision ID: c8f1a5e3b7d2
Revises: f4b8c2a91d67
Create Date: 2026-08-28 00:00:00.000000

Enables partial-quantity purchases: OrderItem now records how many units of
an item a line represents (every historical row was implicitly 1, hence the
server_default). Item.quantity becomes live decrementing stock and
Item.reserved_until is retired — with multiple concurrent partial holds
possible on one item, a single per-item expiry timestamp can no longer
represent "the" reservation; expiry is now derived from the owning
Checkout's own created_at instead (see _recompute_item_status/
_adjust_item_stock in main.py).

The data backfill below is required, not optional: existing sold/reserved
items were never quantity-decremented (that column was purely cosmetic
before this revision), so under the new invariant (status derived from
quantity: available iff quantity > 0) they would otherwise read back as
available again the moment anything touches them. It is not reversible on
downgrade — the original vendor-declared quantity for an already-sold item
is not recoverable from anywhere in the schema.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f1a5e3b7d2'
down_revision: Union[str, Sequence[str], None] = 'f4b8c2a91d67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('order_items', sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'))

    # Required backfill — see module docstring.
    op.execute("UPDATE items SET quantity = 0 WHERE status IN ('sold', 'reserved')")

    op.drop_column('items', 'reserved_until')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('items', sa.Column('reserved_until', sa.DateTime(), nullable=True))
    op.drop_column('order_items', 'quantity')
