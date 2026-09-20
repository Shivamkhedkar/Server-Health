"""Multi-server schema migration

Revision ID: 001_multi_server_schema
Revises:
Create Date: 2026-09-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '001_multi_server_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create servers table
    op.create_table(
        'servers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('hostname', sa.String(length=100), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('os_info', sa.String(length=200), nullable=True),
        sa.Column('api_key_hash', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True, server_default='offline'),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_servers_id'), 'servers', ['id'], unique=False)
    op.create_index(op.f('ix_servers_user_id'), 'servers', ['user_id'], unique=False)
    op.create_index(op.f('ix_servers_api_key_hash'), 'servers', ['api_key_hash'], unique=True)
    op.create_index(op.f('ix_servers_status'), 'servers', ['status'], unique=False)

    # Create server_settings table
    op.create_table(
        'server_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('server_id', sa.Integer(), nullable=False),
        sa.Column('cpu_threshold', sa.Float(), nullable=True, server_default='80.0'),
        sa.Column('ram_threshold', sa.Float(), nullable=True, server_default='85.0'),
        sa.Column('disk_threshold', sa.Float(), nullable=True, server_default='90.0'),
        sa.Column('check_interval', sa.Integer(), nullable=True, server_default='10'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('server_id')
    )
    op.create_index(op.f('ix_server_settings_id'), 'server_settings', ['id'], unique=False)
    op.create_index(op.f('ix_server_settings_server_id'), 'server_settings', ['server_id'], unique=True)

    # Add server_id column to metrics table
    op.add_column('metrics', sa.Column('server_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_metrics_server_id'), 'metrics', ['server_id'], unique=False)
    op.create_foreign_key('fk_metrics_server_id_servers', 'metrics', 'servers', ['server_id'], ['id'], ondelete='CASCADE')

    # Add server_id column to alerts table
    op.add_column('alerts', sa.Column('server_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_alerts_server_id'), 'alerts', ['server_id'], unique=False)
    op.create_foreign_key('fk_alerts_server_id_servers', 'alerts', 'servers', ['server_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint('fk_alerts_server_id_servers', 'alerts', type_='foreignkey')
    op.drop_index(op.f('ix_alerts_server_id'), table_name='alerts')
    op.drop_column('alerts', 'server_id')

    op.drop_constraint('fk_metrics_server_id_servers', 'metrics', type_='foreignkey')
    op.drop_index(op.f('ix_metrics_server_id'), table_name='metrics')
    op.drop_column('metrics', 'server_id')

    op.drop_index(op.f('ix_server_settings_server_id'), table_name='server_settings')
    op.drop_index(op.f('ix_server_settings_id'), table_name='server_settings')
    op.drop_table('server_settings')

    op.drop_index(op.f('ix_servers_status'), table_name='servers')
    op.drop_index(op.f('ix_servers_api_key_hash'), table_name='servers')
    op.drop_index(op.f('ix_servers_user_id'), table_name='servers')
    op.drop_index(op.f('ix_servers_id'), table_name='servers')
    op.drop_table('servers')
