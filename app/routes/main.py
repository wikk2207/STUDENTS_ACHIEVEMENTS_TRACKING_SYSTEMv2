from flask import Blueprint, render_template, redirect, url_for
from flask_login import current_user

bp = Blueprint("main", __name__)


@bp.route("/")
@bp.route("/home")
def index():
    return render_template("index.html")


@bp.route("/login")
@bp.route("/student-login")
def student_login_redirect():
    return redirect(url_for("auth.login"))


@bp.route("/mentor-login")
def mentor_login_redirect():
    return redirect(url_for("auth.mentor_login"))


@bp.route("/dashboard")
def dashboard_redirect():
    if not current_user.is_authenticated:
        return redirect(url_for("auth.login"))
    if current_user.is_mentor:
        from app.services.mentor_auth import mentor_session_verified
        if not mentor_session_verified():
            return redirect(url_for("auth.mentor_verify_otp"))
        return redirect(url_for("mentor.dashboard"))
    return redirect(url_for("student.dashboard"))


@bp.route("/access-denied")
def access_denied():
    return render_template("access_denied.html"), 403
