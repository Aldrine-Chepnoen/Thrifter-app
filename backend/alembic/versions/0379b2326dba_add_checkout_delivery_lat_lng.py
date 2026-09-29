"""add checkout delivery lat lng

Revision ID: 0379b2326dba
Revises: d4e5f6a7b8c9
Create Date: 2026-09-03 21:39:09.045150

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0379b2326dba'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nullable — only populated from the dynamic-delivery-fee feature onward;
    # historical checkouts predate real coordinate capture.
    op.add_column('checkouts', sa.Column('delivery_lat', sa.Float(), nullable=True))
    op.add_column('checkouts', sa.Column('delivery_lng', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('checkouts', 'delivery_lng')
    op.drop_column('checkouts', 'delivery_lat')
