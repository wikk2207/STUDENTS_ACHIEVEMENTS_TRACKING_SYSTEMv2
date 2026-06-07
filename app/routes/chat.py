from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from saams.app.models_chat import ChatMessage
from saams.app.forms_chat import ChatForm
from saams.app import db, mail
from flask_mail import Message

chat_bp = Blueprint('chat', __name__, url_prefix='/chat')

@chat_bp.route('/panel/<int:mentor_id>', methods=['GET', 'POST'])
@login_required
def chat_panel(mentor_id):
    form = ChatForm()
    messages = ChatMessage.query.filter(
        ((ChatMessage.sender_id == current_user.id) & (ChatMessage.receiver_id == mentor_id)) |
        ((ChatMessage.sender_id == mentor_id) & (ChatMessage.receiver_id == current_user.id))
    ).order_by(ChatMessage.timestamp.asc()).all()
    if form.validate_on_submit():
        msg = ChatMessage(
            sender_id=current_user.id,
            receiver_id=mentor_id,
            message=form.message.data,
            is_reply=False
        )
        db.session.add(msg)
        db.session.commit()
        # Send email to mentor
        mentor_email = form.mentor_email.data
        student_name = current_user.username
        email_msg = Message(
            subject=f'New message from {student_name}',
            recipients=[mentor_email],
            body=f'You have received a new message from {student_name}:\n\n{form.message.data}'
        )
        mail.send(email_msg)
        flash('Message sent and mentor notified by email.', 'success')
        return redirect(url_for('chat.chat_panel', mentor_id=mentor_id))
    return render_template('chat_panel.html', form=form, messages=messages, mentor_id=mentor_id)

@chat_bp.route('/reply/<int:student_id>', methods=['POST'])
@login_required
def mentor_reply(student_id):
    form = ChatForm()
    if form.validate_on_submit():
        msg = ChatMessage(
            sender_id=current_user.id,
            receiver_id=student_id,
            message=form.message.data,
            is_reply=True
        )
        db.session.add(msg)
        db.session.commit()
        # Send email to student
        student_email = form.student_email.data
        mentor_name = current_user.username
        email_msg = Message(
            subject=f'Reply from {mentor_name}',
            recipients=[student_email],
            body=f'You have received a reply from {mentor_name}:\n\n{form.message.data}'
        )
        mail.send(email_msg)
        flash('Reply sent and student notified by email.', 'success')
    return redirect(url_for('chat.chat_panel', mentor_id=current_user.id))
