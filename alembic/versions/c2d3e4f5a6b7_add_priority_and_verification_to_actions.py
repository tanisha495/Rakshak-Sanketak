"""add priority and verification_required to corrective_actions

The dashboard's assignment form has always collected a priority and a
"verification required" flag; POST /actions/ had no parameters for either, so
both were discarded on every write. These columns give them somewhere to go.

`priority` stays spelled `priority` — the dashboard reads that field name in
many places, and renaming it here would silently break every one of them.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-09-27 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nullable: an action created before this migration genuinely has no
    # priority, and "not set" is a different statement from any default we
    # could invent here.
    op.add_column(
        'corrective_actions',
        sa.Column('priority', sa.String(), nullable=True),
    )
    # NOT NULL with a false default: "nobody asked for verification" is the
    # correct reading of an existing row, and a null tri-state would make
    # every caller handle a case that has no meaning.
    op.add_column(
        'corrective_actions',
        sa.Column(
            'verification_required',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('corrective_actions', 'verification_required')
    op.drop_column('corrective_actions', 'priority')
