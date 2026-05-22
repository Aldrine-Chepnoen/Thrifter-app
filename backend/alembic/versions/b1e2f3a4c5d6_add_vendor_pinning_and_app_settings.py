"""add vendor pinning and app settings

Revision ID: b1e2f3a4c5d6
Revises: a3f8c9d2e1b4
Create Date: 2026-05-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'b1e2f3a4c5d6'
down_revision = 'a3f8c9d2e1b4'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false")

    op.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR NOT NULL,
            value_bool BOOLEAN NOT NULL DEFAULT false,
            PRIMARY KEY (key)
        )
    """)

    op.execute("INSERT INTO app_settings (key, value_bool) VALUES ('promo_10k_enabled', false) ON CONFLICT DO NOTHING")


def downgrade():
    op.drop_column('vendors', 'is_pinned')
    op.drop_table('app_settings')
