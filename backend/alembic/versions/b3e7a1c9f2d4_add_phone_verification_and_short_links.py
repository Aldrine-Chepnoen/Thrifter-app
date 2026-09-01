"""rename verified_at to email_verified_at, add phone_verified_at and short_links

Revision ID: b3e7a1c9f2d4
Revises: 9a1c4e7f2b3d
Create Date: 2026-08-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3e7a1c9f2d4'
down_revision: Union[str, Sequence[str], None] = '9a1c4e7f2b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('vendors', 'verified_at', new_column_name='email_verified_at')
    op.add_column('vendors', sa.Column('phone_verified_at', sa.DateTime(), nullable=True))

    op.create_table('short_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_short_links_id'), 'short_links', ['id'], unique=False)
    op.create_index(op.f('ix_short_links_code'), 'short_links', ['code'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_short_links_code'), table_name='short_links')
    op.drop_index(op.f('ix_short_links_id'), table_name='short_links')
    op.drop_table('short_links')

    op.drop_column('vendors', 'phone_verified_at')
    op.alter_column('vendors', 'email_verified_at', new_column_name='verified_at')
