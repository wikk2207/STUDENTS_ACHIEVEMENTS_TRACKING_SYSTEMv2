import random
import string
from datetime import datetime, timedelta

from flask import current_app, render_template, session
from flask_mail import Message

from app import db, mail
from app.models import OTPCode


def generate_otp(length=6):
    return "".join(random.choices(string.digits, k=length))


def is_mail_configured():
    return bool(
        current_app.config.get("MAIL_USERNAME")
        and current_app.config.get("MAIL_PASSWORD")
    )


def store_dev_otp(code):
    """Keep OTP visible on verify page when email is not configured."""
    session["dev_otp_code"] = code
    session["dev_otp_expires"] = (datetime.utcnow() + timedelta(minutes=10)).isoformat()


def create_otp(user_id, purpose="verification", minutes=10):
    code = generate_otp()
    otp = OTPCode(
        user_id=user_id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=minutes),
        purpose=purpose,
        is_used=False,
    )
    db.session.add(otp)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return code



def verify_otp(user_id, code, purpose="verification"):
    otp = (
        OTPCode.query.filter_by(
            user_id=user_id, code=code, purpose=purpose, is_used=False
        )
        .order_by(OTPCode.expires_at.desc())
        .first()
    )
    if not otp:
        return False, "Invalid OTP"
    if otp.expires_at < datetime.utcnow():
        return False, "OTP expired"
    otp.is_used = True
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return True, "Verified"



def send_otp_email(user, code, purpose="verification"):
    """
    Send OTP by email when SMTP is configured.
    Otherwise store in session for on-screen display (development).
    Returns: (email_sent: bool, message: str)
    """
    subject = "SAAMS Verification Code"
    if purpose == "login":
        subject = "SAAMS Login OTP"
    elif purpose == "reset":
        subject = "SAAMS Password Reset OTP"
    elif purpose == "mentor_login":
        subject = "SAAMS Mentor Security OTP"

    if not is_mail_configured():
        store_dev_otp(code)
        current_app.logger.info("DEV OTP for %s: %s", user.email, code)
        return False, (
            f"Email is not configured. Your verification code is: {code} "
            "(also shown below — valid 10 minutes)"
        )

    try:
        body = render_template(
            "emails/otp.html",
            user=user,
            code=code,
            purpose=purpose,
        )
        sender = current_app.config.get("MAIL_DEFAULT_SENDER") or current_app.config.get("MAIL_USERNAME")
        msg = Message(
            subject=subject,
            recipients=[user.email.strip()],
            html=body,
            sender=sender,
        )
        mail.send(msg)
        session.pop("dev_otp_code", None)
        current_app.logger.info("OTP email sent to %s", user.email)
        return True, f"OTP sent to {user.email}. Check your inbox and spam folder."
    except Exception as e:
        current_app.logger.error("Mail send failed: %s", e)
        store_dev_otp(code)
        return False, (
            f"Could not send email ({e}). Your verification code is: {code} "
            "(shown below — valid 10 minutes)"
        )


def send_notification_email(user, subject, template, **kwargs):
    if not is_mail_configured():
        current_app.logger.info("DEV email to %s: %s", user.email, subject)
        return True
    try:
        body = render_template(template, user=user, **kwargs)
        msg = Message(subject=subject, recipients=[user.email], html=body)
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error("Notification email failed: %s", e)
        return False
