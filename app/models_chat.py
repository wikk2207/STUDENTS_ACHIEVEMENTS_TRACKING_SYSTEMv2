from datetime import datetime
from saams.app import db

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, nullable=False)
    receiver_id = db.Column(db.Integer, nullable=False)
    message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    is_reply = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f'<ChatMessage {self.id}>'
