"""
Migration for ChatMessage table
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'chat_message',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('sender_id', sa.Integer, nullable=False),
        sa.Column('receiver_id', sa.Integer, nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('timestamp', sa.DateTime, nullable=False),
        sa.Column('is_reply', sa.Boolean, default=False)
    )

def downgrade():
    op.drop_table('chat_message')
