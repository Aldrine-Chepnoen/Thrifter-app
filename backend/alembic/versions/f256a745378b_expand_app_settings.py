"""expand app_settings

Revision ID: f256a745378b
Revises: 4f783a131107
Create Date: 2026-06-13 01:50:42.437072

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f256a745378b'
down_revision: Union[str, Sequence[str], None] = '4f783a131107'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('app_settings', sa.Column('value_float', sa.Float(), nullable=True))
    op.add_column('app_settings', sa.Column('value_str', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('app_settings', 'value_str')
    op.drop_column('app_settings', 'value_float')
