"""add demand board tables

Revision ID: 289dbd281b51
Revises: b060362d090f
Create Date: 2026-06-28 23:25:33.732864

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '289dbd281b51'
down_revision: Union[str, Sequence[str], None] = 'b060362d090f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('demand_entries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('item_name', sa.String(), nullable=False),
    sa.Column('price', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('last_interacted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demand_entries_id'), 'demand_entries', ['id'], unique=False)
    op.create_index(op.f('ix_demand_entries_status'), 'demand_entries', ['status'], unique=False)
    op.create_table('demand_votes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('entry_id', sa.Integer(), nullable=False),
    sa.Column('vote_type', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['entry_id'], ['demand_entries.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'entry_id', name='uq_demand_vote_user_entry')
    )
    op.create_index(op.f('ix_demand_votes_id'), 'demand_votes', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_demand_votes_id'), table_name='demand_votes')
    op.drop_table('demand_votes')
    op.drop_index(op.f('ix_demand_entries_status'), table_name='demand_entries')
    op.drop_index(op.f('ix_demand_entries_id'), table_name='demand_entries')
    op.drop_table('demand_entries')
