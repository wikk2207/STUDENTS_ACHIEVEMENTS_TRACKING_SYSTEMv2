from flask_wtf import FlaskForm
from wtforms import TextAreaField, HiddenField, SubmitField, StringField
from wtforms.validators import DataRequired

class ChatForm(FlaskForm):
    message = TextAreaField('Message', validators=[DataRequired()])
    mentor_email = StringField('Mentor Email')  # To be filled in template or view
    student_email = StringField('Student Email')  # For mentor reply
    submit = SubmitField('Send')
