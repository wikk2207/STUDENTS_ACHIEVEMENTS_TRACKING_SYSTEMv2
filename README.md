# SAAMS — Student Achievement and Activity Management System

AI-powered full-stack platform for students to submit achievements and activities with certificate OCR verification, voice control, mentor approval workflows, analytics, and PDF/Excel reporting.

## Features

- **Authentication:** OTP email verification for register and login, forgot/reset password
- **Student portal:** Achievements, activities, certificate upload, drafts, portfolio PDF, Excel export
- **Mentor portal:** Review submissions, OCR insights, approve/reject, bulk export, analytics
- **OCR verification:** Tesseract-based text extraction, name matching, confidence scoring
- **Voice assistant:** Global Web Speech API navigation and form filling on every page
- **UI:** Neumorphism + glassmorphism, purple/lavender theme, dark mode, Chart.js dashboards
- **Gamification:** Achievement points, badges, leaderboard

## Tech Stack

- **Backend:** Python 3.12+, Flask, SQLAlchemy, Flask-Login, Flask-Mail
- **Frontend:** Bootstrap 5, Chart.js, GSAP, Web Speech API
- **Database:** PostgreSQL
- **AI/OCR:** Tesseract, OpenCV, Pillow, RapidFuzz
- **Reports:** pandas, openpyxl, ReportLab

## Installation

```bash
cd saams
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

Edit `.env` with your `SECRET_KEY` and mail settings (required for OTP email).

### Database

```bash
docker compose up -d postgres
python scripts/migrate_sqlite_to_postgresql.py instance/saams.db saams.db
```

The migration command imports the historical database first, merges the current
SQLite database by user email, remaps foreign keys, and preserves password hashes,
roles, OTP records, achievements, certificates, messages, and audit history. It
only writes to an empty PostgreSQL database.

### Run locally

```bash
python app.py
```

> **Note:** Use `python app.py` (not `flask run`) so the entry point does not conflict with the `app/` package name.

Open http://127.0.0.1:5000

Local PostgreSQL database name: `eduvo_saams`

## Environment Variables

See `.env.example` for:

- `SECRET_KEY`, `DATABASE_URL`
- `MAIL_*` for OTP and notifications
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`
- `TESSERACT_CMD` (Windows: path to `tesseract.exe`)

## OCR Setup

Install [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) on your system. Without it, uploads still work but verification falls back to manual review.

## Deployment (Render)

1. Connect repository to Render
2. Use `render.yaml` or set build: `pip install -r requirements.txt && flask db upgrade`
3. Start: `gunicorn app:app`
4. Add PostgreSQL and set `DATABASE_URL`

## Voice Commands

Say **"Help"** on any page. Examples: *Login*, *Open dashboard*, *Set title to National Hackathon*, *Upload certificate*, *Submit form*, *Approve submission*, *Turn voice off*.

## Project Structure

```
saams/
├── app.py
├── config.py
├── requirements.txt
├── app/
│   ├── models.py, forms.py
│   ├── routes/ (auth, student, mentor, api, voice)
│   └── services/ (otp, ocr, report, voice)
├── templates/
├── static/
└── migrations/
```

## License

Educational / internship project use.
