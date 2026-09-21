"""Notification prefs migration

Revision ID: 002_notification_prefs
Revises: 001_multi_server_schema
Create Date: 2026-09-20 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '002_notification_prefs'
down_revision = '001_multi_server_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notification_prefs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('email_enabled', sa.Boolean(), server_default='1', nullable=True),
        sa.Column('telegram_enabled', sa.Boolean(), server_default='0', nullable=True),
        sa.Column('telegram_chat_id', sa.String(length=50), nullable=True),
        sa.Column('telegram_link_code', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_notification_prefs_id'), 'notification_prefs', ['id'], unique=False)
    op.create_index(op.f('ix_notification_prefs_user_id'), 'notification_prefs', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_notification_prefs_user_id'), table_name='notification_prefs')
    op.drop_index(op.f('ix_notification_prefs_id'), table_name='notification_prefs')
    op.drop_table('notification_prefs')
