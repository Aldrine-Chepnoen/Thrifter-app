"""grandfather hide items over the free slot limit

Revision ID: f4b8c2a91d67
Revises: a7d3e9f21c48
Create Date: 2026-08-27 00:00:01.000000

One-time data migration for the vendor premium tier: vendors who already
have more than the free item limit (10) qualifying items today keep their
newest 10 visible; the rest are marked is_hidden. Ranking excludes
status='sold' items (they never count against the limit and are never
hidden by this feature) and orders by id DESC (Item has no created_at
column, and id is strictly insertion-ordered in this codebase).

This is a live-production data mutation, not a routine schema change — it is
gated behind CONFIRM_GRANDFATHER_MIGRATION=yes so a plain `alembic upgrade
head` cannot silently apply it. Before running for real:
  1. Take a DB backup/snapshot.
  2. Run the dry-run SELECT below (no UPDATE) against production first and
     review the affected vendor/item counts.
  3. Only then set CONFIRM_GRANDFATHER_MIGRATION=yes and run this revision.
  4. Restart the app process afterward to clear the 1hr process-local item
     cache for any items that just became hidden.

Dry-run query:
    WITH ranked AS (
      SELECT id, vendor_id, ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY id DESC) AS rn
      FROM items WHERE vendor_id IS NOT NULL AND status != 'sold'
    )
    SELECT vendor_id, COUNT(*) FROM ranked WHERE rn > 10 GROUP BY vendor_id;
"""
import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b8c2a91d67'
down_revision: Union[str, Sequence[str], None] = 'a7d3e9f21c48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FREE_ITEM_LIMIT = 10


def upgrade() -> None:
    """Upgrade schema."""
    if os.getenv("CONFIRM_GRANDFATHER_MIGRATION") != "yes":
        raise RuntimeError(
            "This migration hides existing vendors' items over the free "
            f"{FREE_ITEM_LIMIT}-slot limit — a real production data change, "
            "not routine schema. Review the dry-run query in this file's "
            "docstring against production first, then re-run with "
            "CONFIRM_GRANDFATHER_MIGRATION=yes set."
        )

    connection = op.get_bind()

    # Log the affected vendor_id -> item_ids mapping as the hook point for a
    # future vendor-notification feature.
    affected = connection.execute(sa.text(
        """
        WITH ranked AS (
          SELECT id, vendor_id, ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY id DESC) AS rn
          FROM items WHERE vendor_id IS NOT NULL AND status != 'sold'
        )
        SELECT vendor_id, array_agg(id ORDER BY id) AS item_ids
        FROM ranked WHERE rn > :limit GROUP BY vendor_id
        """
    ), {"limit": FREE_ITEM_LIMIT}).fetchall()

    for row in affected:
        print(f"[grandfather migration] vendor_id={row.vendor_id} hiding item_ids={row.item_ids}")
    print(f"[grandfather migration] {len(affected)} vendor(s) affected")

    connection.execute(sa.text(
        """
        WITH ranked AS (
          SELECT id, vendor_id, ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY id DESC) AS rn
          FROM items WHERE vendor_id IS NOT NULL AND status != 'sold'
        )
        UPDATE items SET is_hidden = TRUE
        FROM ranked WHERE items.id = ranked.id AND ranked.rn > :limit
        """
    ), {"limit": FREE_ITEM_LIMIT})


def downgrade() -> None:
    """Downgrade schema.

    Lossy: unhides every item unconditionally. Acceptable only because this
    is is_hidden's first introduction — there is no prior per-item hidden
    state to restore.
    """
    op.execute("UPDATE items SET is_hidden = FALSE")
