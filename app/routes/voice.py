from flask import Blueprint, jsonify, request, url_for
from flask_login import current_user, login_required

from app.models import Achievement
from app.services.voice_service import VOICE_COMMANDS, get_help_text

bp = Blueprint("voice", __name__)


@bp.route("/commands")
def commands():
    return jsonify({"commands": VOICE_COMMANDS})


@bp.route("/help")
def help_text():
    return jsonify({"help": get_help_text()})


@bp.route("/status")
@login_required
def status():
    return jsonify({"status": "ok", "message": "Voice API ready"})


@bp.route("/next-submission")
@login_required
def next_submission():
    if not current_user.is_authenticated or current_user.role != "mentor":
        return jsonify({"url": None, "message": "Mentor access required."}), 403

    after_id = request.args.get("after", type=int)
    q = Achievement.query.filter(Achievement.status.in_(["Submitted", "Under Review"]))
    if after_id:
        q = q.filter(Achievement.id != after_id)
    ach = q.order_by(Achievement.created_at.asc()).first()
    if not ach:
        return jsonify({"url": None, "message": "No pending submissions to review."})

    return jsonify(
        {
            "url": url_for("mentor.review_submission", aid=ach.id),
            "title": ach.title,
            "message": f"Opening {ach.title}.",
        }
    )
