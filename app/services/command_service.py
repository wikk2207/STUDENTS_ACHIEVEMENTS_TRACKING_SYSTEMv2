from flask import url_for
from flask_login import current_user

from app.models import Achievement, Activity, User


def get_command_registry():
    commands = [
        {"label": "Open Profile", "url": url_for("auth.profile"), "keywords": "profile account edit details"},
        {"label": "Logout", "url": url_for("auth.logout"), "keywords": "sign out exit"},
    ]

    if not current_user.is_authenticated:
        return [
            {"label": "Login", "url": url_for("auth.login"), "keywords": "student login otp"},
            {"label": "Register", "url": url_for("auth.register"), "keywords": "create account signup"},
            {"label": "Mentor Login", "url": url_for("auth.mentor_login"), "keywords": "faculty mentor"},
        ]

    if current_user.is_student:
        commands.extend(
            [
                {"label": "Open Dashboard", "url": url_for("student.dashboard"), "keywords": "home overview"},
                {"label": "Add Achievement", "url": url_for("student.achievement_add"), "keywords": "new certificate award"},
                {"label": "Add Activity", "url": url_for("student.activity_add"), "keywords": "new activity event"},
                {"label": "My Achievements", "url": url_for("student.achievements_list"), "keywords": "submissions certificates"},
                {"label": "My Activities", "url": url_for("student.activities_list"), "keywords": "events participation"},
                {"label": "Deadlines & Events", "url": url_for("student.deadlines"), "keywords": "deadline due upcoming event classroom"},
                {"label": "Reports", "url": url_for("student.reports"), "keywords": "download export pdf excel"},
                {"label": "Mentor Chat", "url": url_for("student.messages"), "keywords": "message help support"},
                {"label": "Portfolio", "url": url_for("student.public_portfolio"), "keywords": "public profile"},
            ]
        )
    elif current_user.is_mentor:
        commands.extend(
            [
                {"label": "Mentor Dashboard", "url": url_for("mentor.dashboard"), "keywords": "home overview"},
                {"label": "Student Submissions", "url": url_for("mentor.submissions"), "keywords": "review approve reject pending"},
                {"label": "Manage Deadlines & Events", "url": url_for("mentor.deadlines"), "keywords": "deadline due upcoming event publish classroom"},
                {"label": "Analytics", "url": url_for("mentor.analytics"), "keywords": "charts department"},
                {"label": "Reports", "url": url_for("mentor.reports"), "keywords": "download export pdf excel"},
                {"label": "Messages", "url": url_for("mentor.messages"), "keywords": "student chat"},
                {"label": "Leaderboard", "url": url_for("mentor.leaderboard"), "keywords": "rank points top students"},
            ]
        )

    return commands


def search_commands(query):
    q = (query or "").strip().lower()
    if not q:
        return get_command_registry()[:8]

    results = []
    for command in get_command_registry():
        haystack = f"{command.get('label', '')} {command.get('keywords', '')}".lower()
        if q in haystack:
            results.append(command)

    if current_user.is_authenticated and current_user.is_student:
        achievements = (
            Achievement.query.filter_by(student_id=current_user.id)
            .filter(
                Achievement.title.ilike(f"%{q}%")
                | Achievement.event_name.ilike(f"%{q}%")
                | Achievement.category.ilike(f"%{q}%")
            )
            .order_by(Achievement.created_at.desc())
            .limit(5)
            .all()
        )
        results.extend(
            {
                "label": f"Achievement: {a.title}",
                "url": url_for("student.achievements_list", q=q),
                "keywords": a.category or "",
            }
            for a in achievements
        )
        activities = (
            Activity.query.filter_by(student_id=current_user.id)
            .filter(
                Activity.activity_name.ilike(f"%{q}%")
                | Activity.activity_type.ilike(f"%{q}%")
                | Activity.organizer.ilike(f"%{q}%")
            )
            .order_by(Activity.created_at.desc())
            .limit(5)
            .all()
        )
        results.extend(
            {
                "label": f"Activity: {a.activity_name}",
                "url": url_for("student.activities_list"),
                "keywords": a.activity_type or "",
            }
            for a in activities
        )
    elif current_user.is_authenticated and current_user.is_mentor:
        students = (
            User.query.filter_by(role="student")
            .filter(
                User.full_name.ilike(f"%{q}%")
                | User.email.ilike(f"%{q}%")
                | User.department.ilike(f"%{q}%")
                | User.roll_number.ilike(f"%{q}%")
            )
            .order_by(User.full_name)
            .limit(5)
            .all()
        )
        results.extend(
            {
                "label": f"Student: {s.full_name}",
                "url": url_for("mentor.submissions", q=s.full_name),
                "keywords": f"{s.department or ''} {s.roll_number or ''}",
            }
            for s in students
        )
        submissions = (
            Achievement.query.join(User, Achievement.student_id == User.id)
            .filter(Achievement.status != "Draft")
            .filter(
                Achievement.title.ilike(f"%{q}%")
                | User.full_name.ilike(f"%{q}%")
                | Achievement.branch.ilike(f"%{q}%")
                | Achievement.roll_number.ilike(f"%{q}%")
            )
            .order_by(Achievement.created_at.desc())
            .limit(5)
            .all()
        )
        results.extend(
            {
                "label": f"Review: {a.title}",
                "url": url_for("mentor.review_submission", aid=a.id),
                "keywords": a.status or "",
            }
            for a in submissions
        )

    seen = set()
    unique = []
    for item in results:
        key = (item.get("label"), item.get("url"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique[:10]
