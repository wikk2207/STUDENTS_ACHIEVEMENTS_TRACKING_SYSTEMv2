
from flask_wtf import FlaskForm
from flask_wtf.file import FileAllowed, FileField
from wtforms import (
    BooleanField,
    DateField,
    DateTimeLocalField,
    PasswordField,
    SelectField,
    StringField,
    SubmitField,
    TextAreaField,
)
from wtforms.validators import DataRequired, Email, EqualTo, Length, Optional, Regexp, ValidationError

# Student Report Upload Form
class ReportForm(FlaskForm):
    title = StringField("Report Title", validators=[DataRequired(), Length(max=200)])
    description = TextAreaField("Description", validators=[Optional(), Length(max=2000)])
    file = FileField("Report File", validators=[DataRequired(), FileAllowed(["pdf", "doc", "docx", "jpg", "jpeg", "png"], "Documents only!")])
    submit = SubmitField("Upload Report")


class RegistrationForm(FlaskForm):
    full_name = StringField("Full Name", validators=[DataRequired(), Length(2, 120)])
    email = StringField("Email", validators=[DataRequired(), Email()])
    mobile = StringField(
        "Mobile",
        validators=[
            DataRequired(),
            Regexp(r"^[\d\s\-\+()]{10,15}$", message="Enter a valid 10-digit mobile number"),
        ],
    )
    role = SelectField(
        "Role",
        choices=[("student", "Student")],
        default="student",
        validators=[DataRequired()],
    )
    department = StringField("Department", validators=[DataRequired(), Length(2, 80)])
    year = SelectField(
        "Year",
        choices=[
            ("", "Select year"),
            ("1", "1st Year"),
            ("2", "2nd Year"),
            ("3", "3rd Year"),
            ("4", "4th Year"),
        ],
        validators=[Optional()],
    )
    employee_id = StringField("Employee ID", validators=[Optional(), Length(max=40)])
    roll_number = StringField("Roll Number", validators=[Optional(), Length(2, 40)])
    password = PasswordField(
        "Password", validators=[DataRequired(), Length(8, 128)]
    )
    confirm_password = PasswordField(
        "Confirm Password",
        validators=[DataRequired(), EqualTo("password", message="Passwords must match")],
    )
    profile_photo = FileField(
        "Profile Photo",
        validators=[FileAllowed(["jpg", "jpeg", "png"], "Images only")],
    )
    submit = SubmitField("Register")

    def validate(self, extra_validators=None):
        if not super().validate(extra_validators=extra_validators):
            return False
        if self.role.data == "student" and not self.year.data:
            self.year.errors.append("Please select your year of study.")
            return False
        if self.role.data == "mentor" and not (self.employee_id.data or "").strip():
            self.employee_id.errors.append("Employee ID is required for mentors.")
            return False
        return True


class LoginForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email()])
    password = PasswordField("Password", validators=[DataRequired()])
    remember = BooleanField("Remember Me")
    submit = SubmitField("Login")


class OTPForm(FlaskForm):
    code = StringField(
        "OTP",
        validators=[DataRequired(), Length(6, 6), Regexp(r"^\d{6}$", message="6 digits")],
    )
    submit = SubmitField("Verify")


class OTPLoginForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email()])
    submit = SubmitField("Send OTP")


class ForgotPasswordForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email()])
    submit = SubmitField("Send Reset Link")


class ResetPasswordForm(FlaskForm):
    password = PasswordField("New Password", validators=[DataRequired(), Length(8, 128)])
    confirm_password = PasswordField(
        "Confirm Password",
        validators=[DataRequired(), EqualTo("password")],
    )
    submit = SubmitField("Reset Password")


class AchievementForm(FlaskForm):
    branch = StringField("Branch", validators=[DataRequired(), Length(2, 80)])
    year = SelectField(
        "Year",
        choices=[
            ("", "Select year"),
            ("1", "1st Year"),
            ("2", "2nd Year"),
            ("3", "3rd Year"),
            ("4", "4th Year"),
        ],
        validators=[DataRequired()],
    )
    roll_number = StringField("Roll Number", validators=[DataRequired(), Length(2, 40)])
    title = StringField("Title", validators=[DataRequired(), Length(2, 200)])
    category = SelectField(
        "Category",
        choices=[
            ("Academic", "Academic"),
            ("Technical", "Technical"),
            ("Sports", "Sports"),
            ("Cultural", "Cultural"),
            ("Research", "Research"),
            ("Certification", "Certification"),
            ("Leadership", "Leadership"),
        ],
        validators=[DataRequired()],
    )
    event_name = StringField("Event Name", validators=[Optional(), Length(0, 200)])
    organizer = StringField("Organizer", validators=[Optional(), Length(0, 200)])
    event_date = DateField("Event Date", validators=[Optional()])
    rank = StringField("Position / Rank", validators=[Optional(), Length(0, 80)])
    level = SelectField(
        "Level",
        choices=[
            ("College", "College"),
            ("State", "State"),
            ("National", "National"),
            ("International", "International"),
        ],
        validators=[DataRequired()],
    )
    description = TextAreaField("Description", validators=[Optional()])
    certificate = FileField(
        "Certificate",
        validators=[
            FileAllowed(
                ["pdf", "png", "jpg", "jpeg", "gif", "webp", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "zip"],
                "Supported files: PDF, images, documents, spreadsheets, presentations, text, or ZIP",
            )
        ],
    )
    submit = SubmitField("Submit")
    save_draft = SubmitField("Save Draft")


class ActivityForm(FlaskForm):
    branch = StringField("Branch", validators=[DataRequired(), Length(2, 80)])
    year = SelectField(
        "Year",
        choices=[
            ("", "Select year"),
            ("1", "1st Year"),
            ("2", "2nd Year"),
            ("3", "3rd Year"),
            ("4", "4th Year"),
        ],
        validators=[DataRequired()],
    )
    roll_number = StringField("Roll Number", validators=[DataRequired(), Length(2, 40)])
    activity_name = StringField("Activity Name", validators=[DataRequired(), Length(2, 200)])
    activity_type = SelectField(
        "Activity Type",
        choices=[
            ("Workshop", "Workshop"),
            ("Seminar", "Seminar"),
            ("Volunteering", "Volunteering"),
            ("Club", "Club"),
            ("Internship", "Internship"),
            ("Other", "Other"),
        ],
        validators=[DataRequired()],
    )
    role = StringField("Your Role", validators=[Optional(), Length(0, 80)])
    date = DateField("Date", validators=[Optional()])
    duration = StringField("Duration", validators=[Optional(), Length(0, 50)])
    organizer = StringField("Organizer", validators=[Optional(), Length(0, 200)])
    description = TextAreaField("Description", validators=[Optional()])
    document = FileField(
        "Supporting Document",
        validators=[
            FileAllowed(
                ["pdf", "png", "jpg", "jpeg", "gif", "webp", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "zip"],
                "Supported files: PDF, images, documents, spreadsheets, presentations, text, or ZIP",
            )
        ],
    )
    submit = SubmitField("Submit")
    save_draft = SubmitField("Save Draft")


class MentorReviewForm(FlaskForm):
    mentor_comment = TextAreaField("Remarks", validators=[Optional()])
    submit_approve = SubmitField("Approve")
    submit_reject = SubmitField("Reject")


class ClassroomPostForm(FlaskForm):
    post_type = SelectField(
        "Type",
        choices=[("deadline", "Deadline"), ("event", "Upcoming Event")],
        validators=[DataRequired()],
    )
    title = StringField("Title", validators=[DataRequired(), Length(3, 200)])
    description = TextAreaField("Details", validators=[Optional(), Length(max=3000)])
    due_at = DateTimeLocalField(
        "Deadline / Event Date & Time",
        format="%Y-%m-%dT%H:%M",
        validators=[DataRequired()],
    )
    branch = StringField("Branch / Department", validators=[Optional(), Length(max=80)])
    year = SelectField(
        "Year",
        choices=[
            ("", "All years"),
            ("1", "1st Year"),
            ("2", "2nd Year"),
            ("3", "3rd Year"),
            ("4", "4th Year"),
        ],
        validators=[Optional()],
    )
    action_label = StringField("Action Button Text", validators=[Optional(), Length(max=80)])
    action_url = StringField("Action Link", validators=[Optional(), Length(max=500)])
    submit = SubmitField("Publish")


class ProfileForm(FlaskForm):
    full_name = StringField("Full Name", validators=[DataRequired(), Length(2, 120)])
    mobile = StringField("Mobile", validators=[Optional()])
    department = StringField("Department", validators=[Optional()])
    year = StringField("Year", validators=[Optional()])
    roll_number = StringField("Roll Number", validators=[Optional()])
    mentor_designation = StringField(
        "Current Role/Designation (e.g., Data Scientist, Software Engineer)",
        validators=[Optional(), Length(max=120)],
    )
    mentor_organization = StringField(
        "Organization/Company",
        validators=[Optional(), Length(max=120)],
    )
    mentor_experience_years = StringField(
        "Years of Experience",
        validators=[Optional(), Length(max=40)],
    )
    mentor_skills = TextAreaField(
        "Skills/Expertise",
        validators=[Optional(), Length(max=2000)],
    )
    mentor_bio = TextAreaField(
        "Short Bio/About Me",
        validators=[Optional(), Length(max=3000)],
    )
    profile_photo = FileField(
        "Profile Photo",
        validators=[FileAllowed(["jpg", "jpeg", "png"], "Images only")],
    )
    submit = SubmitField("Save Changes")
