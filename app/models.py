
from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app import db, login_manager
from app.models_message import Message

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

# ...existing code...

# Student-uploaded Report model
class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    file_path = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(30), default="Draft")
    mentor_comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    student = db.relationship("User", backref=db.backref("reports", lazy="dynamic"))
from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app import db, login_manager
from app.models_message import Message


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    mobile = db.Column(db.String(20))
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20), nullable=False, default="student")
    department = db.Column(db.String(80))
    year = db.Column(db.String(20))
    employee_id = db.Column(db.String(40))
    roll_number = db.Column(db.String(40))
    profile_photo = db.Column(db.String(255))
    mentor_designation = db.Column(db.String(120))
    mentor_organization = db.Column(db.String(120))
    mentor_experience_years = db.Column(db.String(40))
    mentor_skills = db.Column(db.Text)
    mentor_bio = db.Column(db.Text)
    is_verified = db.Column(db.Boolean, default=False)
    google_id = db.Column(db.String(120), unique=True, nullable=True)
    dark_mode = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    achievements = db.relationship(
        "Achievement",
        backref=db.backref("student", lazy=True),
        lazy="dynamic",
        foreign_keys="Achievement.student_id",
    )
    activities = db.relationship("Activity", backref="student", lazy="dynamic")
    otps = db.relationship("OTPCode", backref="user", lazy="dynamic")
    notifications = db.relationship("Notification", backref="user", lazy="dynamic")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    @property
    def is_student(self):
        return self.role == "student"

    @property
    def is_mentor(self):
        return self.role == "mentor"


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


class OTPCode(db.Model):
    __tablename__ = "otp_codes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    code = db.Column(db.String(6), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    purpose = db.Column(db.String(30), default="verification")


class Achievement(db.Model):
    __tablename__ = "achievements"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    branch = db.Column(db.String(80))
    year = db.Column(db.String(20))
    roll_number = db.Column(db.String(40))
    title = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    event_name = db.Column(db.String(200))
    organizer = db.Column(db.String(200))
    event_date = db.Column(db.Date)
    rank = db.Column(db.String(80))
    level = db.Column(db.String(40), default="College")
    description = db.Column(db.Text)
    status = db.Column(db.String(30), default="Draft")
    mentor_comment = db.Column(db.Text)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    certificate = db.relationship(
        "Certificate", backref="achievement", uselist=False, lazy=True
    )
    reviewer = db.relationship(
        "User",
        foreign_keys=[reviewed_by],
        lazy=True,
    )


class Activity(db.Model):
    __tablename__ = "activities"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    branch = db.Column(db.String(80))
    year = db.Column(db.String(20))
    roll_number = db.Column(db.String(40))
    activity_name = db.Column(db.String(200), nullable=False)
    activity_type = db.Column(db.String(80))
    role = db.Column(db.String(80))
    date = db.Column(db.Date)
    duration = db.Column(db.String(50))
    organizer = db.Column(db.String(200))
    description = db.Column(db.Text)
    status = db.Column(db.String(30), default="Draft")
    mentor_comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=utcnow)

    certificate = db.relationship(
        "Certificate", backref="activity", uselist=False, lazy=True
    )


class Certificate(db.Model):
    __tablename__ = "certificates"

    id = db.Column(db.Integer, primary_key=True)
    achievement_id = db.Column(db.Integer, db.ForeignKey("achievements.id"), nullable=True)
    activity_id = db.Column(db.Integer, db.ForeignKey("activities.id"), nullable=True)
    file_name = db.Column(db.String(255))
    file_path = db.Column(db.String(500))
    extracted_text = db.Column(db.Text)
    detected_name = db.Column(db.String(200))
    detected_event = db.Column(db.String(200))
    detected_date = db.Column(db.String(50))
    match_score = db.Column(db.Float, default=0.0)
    verification_status = db.Column(db.String(50), default="Pending")
    confidence_score = db.Column(db.Float, default=0.0)
    authenticity_score = db.Column(db.Float, default=0.0)
    file_hash = db.Column(db.String(64), index=True)
    fraud_risk = db.Column(db.String(20), default="Low")
    fraud_notes = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, default=utcnow)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(100))
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=utcnow)


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200))
    message = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=utcnow)


class ClassroomPost(db.Model):
    __tablename__ = "classroom_posts"

    id = db.Column(db.Integer, primary_key=True)
    mentor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_type = db.Column(db.String(20), nullable=False, default="deadline")
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    due_at = db.Column(db.DateTime, nullable=False)
    branch = db.Column(db.String(80))
    year = db.Column(db.String(20))
    action_label = db.Column(db.String(80))
    action_url = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    mentor = db.relationship("User", backref=db.backref("classroom_posts", lazy="dynamic"))
    reads = db.relationship(
        "ClassroomPostRead",
        backref="post",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    @property
    def is_deadline(self):
        return self.post_type == "deadline"

    @property
    def is_event(self):
        return self.post_type == "event"


class ClassroomPostRead(db.Model):
    __tablename__ = "classroom_post_reads"

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("classroom_posts.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    read_at = db.Column(db.DateTime, default=utcnow)

    student = db.relationship("User", backref=db.backref("classroom_post_reads", lazy="dynamic"))
    __table_args__ = (db.UniqueConstraint("post_id", "student_id", name="uq_classroom_post_read"),)
