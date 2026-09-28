"""add source field to reports

Separates the historical analysis corpus from live worker submissions.

Revision ID: b1c2d3e4f5a6
Revises: f4187837733d
Create Date: 2026-09-15 01:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'f4187837733d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default="live" so existing rows and any insert that does not
    # mention the column are treated as real submissions. Added nullable
    # first, backfilled, then made NOT NULL, so the migration is safe on a
    # table that already has rows.
    op.add_column(
        'reports',
        sa.Column('source', sa.String(), nullable=True, server_default='live'),
    )
    op.execute("UPDATE reports SET source = 'live' WHERE source IS NULL")
    op.alter_column('reports', 'source', nullable=False)
    op.create_index(op.f('ix_reports_source'), 'reports', ['source'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_reports_source'), table_name='reports')
    op.drop_column('reports', 'source')
