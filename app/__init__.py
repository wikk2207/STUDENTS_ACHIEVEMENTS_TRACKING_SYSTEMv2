import os

from dotenv import load_dotenv

load_dotenv()

from flask import Flask
from flask_cors import CORS
from flask_login import LoginManager
from flask_mail import Mail
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect

try:
    # When running as a package (recommended)
    from saams.config import config_map
except Exception:
    # When running from repo root / legacy entrypoints
    from config import config_map


db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
mail = Mail()
csrf = CSRFProtect()


def create_app(config_name=None):
    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static",
    )
    # Force use of DevelopmentConfig for local/dev reliability
    # Support both package and legacy module layouts.
    try:
        app.config.from_object('saams.config.DevelopmentConfig')
    except Exception:
        app.config.from_object('config.DevelopmentConfig')


    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(os.path.join(app.config["UPLOAD_FOLDER"], "profiles"), exist_ok=True)
    os.makedirs(os.path.join(app.config["UPLOAD_FOLDER"], "certificates"), exist_ok=True)

    db.init_app(app)

    # Enable WAL mode for SQLite to reduce write-lock contention.
    # This is safe to run on each startup.
    if app.config.get("SQLALCHEMY_DATABASE_URI", "").startswith("sqlite"):
        with app.app_context():
            try:
                with db.engine.begin() as conn:
                    conn.exec_driver_sql("PRAGMA journal_mode=WAL")
                    conn.exec_driver_sql("PRAGMA synchronous=NORMAL")
            except Exception:
                # Don't block app boot if PRAGMAs fail for any reason.
                pass

    migrate.init_app(app, db)
    login_manager.init_app(app)
    mail.init_app(app)
    csrf.init_app(app)
    CORS(app, supports_credentials=True)

    login_manager.login_view = "auth.login"
    login_manager.login_message_category = "info"

    from app.routes import auth, main, mentor, student, api, voice, cert_dashboard, sara_api

    app.register_blueprint(main.bp)
    app.register_blueprint(auth.bp, url_prefix="/auth")
    app.register_blueprint(student.bp, url_prefix="/student")
    app.register_blueprint(mentor.bp, url_prefix="/mentor")
    app.register_blueprint(api.bp, url_prefix="/api")
    app.register_blueprint(voice.bp, url_prefix="/voice")
    app.register_blueprint(cert_dashboard.bp)
    app.register_blueprint(sara_api.bp)

    @app.context_processor
    def inject_globals():
        from flask_login import current_user
        from app.models import Notification
        from app.services.otp_service import is_mail_configured

        unread = 0
        unread_messages = 0
        if current_user.is_authenticated:
            unread = Notification.query.filter_by(
                user_id=current_user.id, is_read=False
            ).count()
            unread_messages = Notification.query.filter(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
                Notification.title.in_(["New Student Message", "Mentor Reply"]),
            ).count()
        return dict(
            unread_notifications=unread,
            unread_message_notifications=unread_messages,
            mail_configured=is_mail_configured(),
        )

    with app.app_context():
        db.create_all()
        _ensure_schema_columns(app)

    return app


def _ensure_schema_columns(app):
    """Add new columns on existing SQLite DBs without full migration."""
    from sqlalchemy import inspect, text

    with app.app_context():
        insp = inspect(db.engine)
        if "certificates" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("certificates")}
        alters = []
        if "file_hash" not in cols:
            alters.append("ALTER TABLE certificates ADD COLUMN file_hash VARCHAR(64)")
        if "fraud_risk" not in cols:
            alters.append("ALTER TABLE certificates ADD COLUMN fraud_risk VARCHAR(20)")
        if "fraud_notes" not in cols:
            alters.append("ALTER TABLE certificates ADD COLUMN fraud_notes TEXT")
        if alters:
            with db.engine.begin() as conn:
                for sql in alters:
                    conn.execute(text(sql))
                    
