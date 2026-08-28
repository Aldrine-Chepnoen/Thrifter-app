"""fix wardrobe item cascade delete

Revision ID: 7e62eaa903be
Revises: e2b7f4a9c6d1
Create Date: 2026-08-28 06:07:21.472303

models.py's Wardrobe.item_id has declared ondelete="CASCADE" for a while
(already true on main), but no prior migration ever applied it to the actual
constraint — SQLAlchemy's ondelete= is a DDL hint only enforced once a real
"ON DELETE CASCADE" is on the DB-side FK. The admin/vendor delete-item path
(main.py's DELETE /items/{id}) does no manual wardrobe cleanup and relies
entirely on this DB-level cascade, so deleting an item that's in any user's
wardrobe currently raises a ForeignKeyViolation. This brings the constraint
in line with what the model has already claimed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e62eaa903be'
down_revision: Union[str, Sequence[str], None] = 'e2b7f4a9c6d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint('wardrobe_item_id_fkey', 'wardrobe', type_='foreignkey')
    op.create_foreign_key(
        'wardrobe_item_id_fkey', 'wardrobe', 'items',
        ['item_id'], ['id'], ondelete='CASCADE',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('wardrobe_item_id_fkey', 'wardrobe', type_='foreignkey')
    op.create_foreign_key(
        'wardrobe_item_id_fkey', 'wardrobe', 'items',
        ['item_id'], ['id'],
    )
