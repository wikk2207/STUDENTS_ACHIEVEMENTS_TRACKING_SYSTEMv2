import os
import uuid
from datetime import datetime

from flask import current_app
from flask_login import current_user
from werkzeug.utils import secure_filename

from app import db
from app.models import AuditLog


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in current_app.config["ALLOWED_EXTENSIONS"]
    )


def save_upload(file, subfolder="certificates"):
    # Accept only uploaded files
    if not file or not hasattr(file, "filename") or not file.filename:
        return None, None
    if not allowed_file(file.filename):
        return None, None
    ext = file.filename.rsplit(".", 1)[1].lower()
    safe = secure_filename(file.filename.rsplit(".", 1)[0])
    unique = f"{safe}_{uuid.uuid4().hex[:8]}.{ext}"
    folder = os.path.join(current_app.config["UPLOAD_FOLDER"], subfolder)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, unique)
    file.save(path)
    rel = os.path.join("uploads", subfolder, unique).replace("\\", "/")
    return rel, unique


def log_action(action, details=""):
    if current_user.is_authenticated:
        entry = AuditLog(
            user_id=current_user.id,
            action=action,
            details=details[:500],
        )
        db.session.add(entry)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()


def calculate_achievement_points(achievements):
    cfg = current_app.config
    total = 0
    for a in achievements:
        if a.status != "Approved":
            continue
        total += cfg.get("LEVEL_POINTS", {}).get(a.level or "College", 10)
        rank_key = (a.rank or "").split()[0] if a.rank else ""
        for k, v in cfg.get("RANK_BONUS", {}).items():
            if k.lower() in (a.rank or "").lower():
                total += v
                break
    return total


def get_badges(achievements, activities):
    badges = []
    approved = [a for a in achievements if a.status == "Approved"]
    cats = {a.category for a in approved}
    if len(approved) >= 10:
        badges.append("Achiever")
    if len(approved) >= 25:
        badges.append("Top Performer")
    if "Research" in cats:
        badges.append("Research Enthusiast")
    if "Sports" in cats:
        badges.append("Sports Champion")
    if "Technical" in cats and len([a for a in approved if a.category == "Technical"]) >= 5:
        badges.append("Tech Star")
    if len(activities) >= 10:
        badges.append("Active Participant")
    return badges
