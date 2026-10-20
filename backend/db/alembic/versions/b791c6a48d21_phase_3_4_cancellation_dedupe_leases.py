"""Phase 3/4: cancellation, durable dedupe, and owned scheduler leases.

Revision ID: b791c6a48d21
Revises: 35fd433a99c2
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from hashlib import sha256
import re

revision: str = "b791c6a48d21"
down_revision: Union[str, Sequence[str], None] = "35fd433a99c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scheduled_runs", sa.Column("lease_owner", sa.String(64), nullable=True))
    op.add_column("scheduled_runs", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_scheduled_runs_lease_expires_at", "scheduled_runs", ["lease_expires_at"])
    op.execute(sa.text(
        "UPDATE scheduled_runs SET lease_expires_at=next_run_at "
        "WHERE status='running' AND lease_expires_at IS NULL"
    ))
    op.add_column("scheduled_runs", sa.Column("digest_md", sa.Text(), nullable=True))
    op.add_column("scheduled_runs", sa.Column("coverage_json", sa.JSON(), nullable=True))
    op.add_column("discoveries", sa.Column("dedupe_key", sa.String(64), nullable=True))
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, title, summary, category FROM discoveries")).mappings().all()
    seen: set[str] = set()
    for row in rows:
        identity = (row["summary"] or "").removeprefix("Claim: ") or row["title"] or ""
        normalized = re.sub(r"\W+", " ", identity.casefold()).strip()
        digest = sha256(f"{(row['category'] or '').casefold()}\0{normalized}".encode()).hexdigest()
        if digest in seen:
            # Preserve historical duplicate rows while reserving the canonical
            # fingerprint for the first record. New writes dedupe to that row.
            digest = sha256(f"{digest}|legacy:{row['id']}".encode()).hexdigest()
        seen.add(digest)
        bind.execute(
            sa.text("UPDATE discoveries SET dedupe_key=:key WHERE id=:id"),
            {"key": digest, "id": row["id"]},
        )
    op.create_index("ix_discoveries_dedupe_key", "discoveries", ["dedupe_key"], unique=True)
    op.create_table(
        "research_cancellations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.String(255), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_research_cancellations_task_id", "research_cancellations", ["task_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_research_cancellations_task_id", table_name="research_cancellations")
    op.drop_table("research_cancellations")
    op.drop_index("ix_discoveries_dedupe_key", table_name="discoveries")
    op.drop_column("discoveries", "dedupe_key")
    op.drop_column("scheduled_runs", "coverage_json")
    op.drop_column("scheduled_runs", "digest_md")
    op.drop_index("ix_scheduled_runs_lease_expires_at", table_name="scheduled_runs")
    op.drop_column("scheduled_runs", "lease_expires_at")
    op.drop_column("scheduled_runs", "lease_owner")
