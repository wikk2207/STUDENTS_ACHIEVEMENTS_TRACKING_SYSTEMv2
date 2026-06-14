import os
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))


def normalize_database_url(url):
    if url and url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.environ.get(
            "DATABASE_URL",
            "postgresql://saams:saams@localhost:5433/eduvo_saams",
        )
    )

    SQLALCHEMY_ENGINE_OPTIONS = {}
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MAIL_SERVER = os.environ.get("MAIL_SERVER", "localhost")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USE_SSL = os.environ.get("MAIL_USE_SSL", "false").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get(
        "MAIL_DEFAULT_SENDER", "SAAMS <noreply@saams.local>"
    )
    MAIL_DEBUG = os.environ.get("MAIL_DEBUG", "false").lower() == "true"
    MAIL_TIMEOUT = int(os.environ.get("MAIL_TIMEOUT", 20))

    UPLOAD_FOLDER = os.path.join(basedir, "static", "uploads")
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))
    ALLOWED_EXTENSIONS = {
        "pdf", "png", "jpg", "jpeg", "gif", "webp",
        "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "zip"
    }

    PERMANENT_SESSION_LIFETIME = timedelta(
        minutes=int(os.environ.get("SESSION_TIMEOUT_MINUTES", 60))
    )
    WTF_CSRF_ENABLED = True
    TESSERACT_CMD = os.environ.get("TESSERACT_CMD")

    # True when SMTP credentials are set (real email); otherwise OTP is shown on screen
    @property
    def MAIL_CONFIGURED(self):
        return bool(os.environ.get("MAIL_USERNAME") and os.environ.get("MAIL_PASSWORD"))

    # Gamification points
    LEVEL_POINTS = {
        "College": 10,
        "State": 30,
        "National": 50,
        "International": 100,
    }
    MENTOR_EMAIL = os.environ.get("MENTOR_EMAIL", "binaryai0010@gmail.com")
    MENTOR_WHITELIST_EMAILS = os.environ.get("MENTOR_WHITELIST_EMAILS", "")
    RANK_BONUS = {"First": 20, "Second": 15, "Third": 10, "Participation": 5}


class ProductionConfig(Config):
    DEBUG = False


class DevelopmentConfig(Config):
    DEBUG = True


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
