"""Merge one or more SAAMS SQLite databases into PostgreSQL."""

import argparse
import os
import sqlite3
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, Date, DateTime, MetaData, create_engine, func, select, text
from sqlalchemy.engine import make_url


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / ".env")

TABLE_ORDER = [
    "users",
    "achievements",
    "activities",
    "reports",
    "certificates",
    "otp_codes",
    "notifications",
    "audit_logs",
    "messages",
    "voice_sessions",
    "chat_message",
]

FOREIGN_KEYS = {
    "achievements": {
        "student_id": "users",
        "reviewed_by": "users",
    },
    "activities": {"student_id": "users"},
    "reports": {"student_id": "users"},
    "certificates": {
        "achievement_id": "achievements",
        "activity_id": "activities",
    },
    "otp_codes": {"user_id": "users"},
    "notifications": {"user_id": "users"},
    "audit_logs": {"user_id": "users"},
    "messages": {
        "sender_id": "users",
        "receiver_id": "users",
    },
    "voice_sessions": {"user_id": "users"},
    "chat_message": {
        "sender_id": "users",
        "receiver_id": "users",
    },
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Merge SAAMS SQLite data into an empty PostgreSQL database."
    )
    parser.add_argument(
        "sources",
        nargs="+",
        type=Path,
        help="SQLite files, oldest/most complete first",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL URL (defaults to DATABASE_URL)",
    )
    return parser.parse_args()


def validate_target(database_url):
    if not database_url:
        raise SystemExit("DATABASE_URL is required.")
    url = make_url(database_url.replace("postgres://", "postgresql://", 1))
    if url.get_backend_name() != "postgresql":
        raise SystemExit("The target must be PostgreSQL; refusing to write elsewhere.")
    return url


def sqlite_rows(path, table):
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        if table not in tables:
            return []
        return [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
    finally:
        connection.close()


def row_identity(row):
    return tuple(
        sorted(
            (key, value.isoformat() if hasattr(value, "isoformat") else value)
            for key, value in row.items()
            if key != "id"
        )
    )


def convert_value(column, value):
    if value is None:
        return None
    if isinstance(column.type, Boolean):
        return bool(value)
    if isinstance(column.type, DateTime) and isinstance(value, str):
        return datetime.fromisoformat(value)
    if isinstance(column.type, Date) and isinstance(value, str):
        return date.fromisoformat(value)
    return value


def merge_user(existing, incoming):
    changed = False
    for key, value in incoming.items():
        if key == "id" or value is None or value == "":
            continue
        if key == "role":
            value = "mentor" if "mentor" in {existing.get(key), value} else value
        elif key == "is_verified":
            value = bool(existing.get(key)) or bool(value)
        elif existing.get(key) not in (None, ""):
            continue
        if existing.get(key) != value:
            existing[key] = value
            changed = True
    return changed


def reset_sequences(connection, metadata):
    for table in metadata.sorted_tables:
        if "id" not in table.c:
            continue
        connection.execute(
            text(
                f"SELECT setval("
                f"pg_get_serial_sequence('{table.name}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table.name}), 1), "
                f"(SELECT COUNT(*) > 0 FROM {table.name}))"
            )
        )


def main():
    args = parse_args()
    target_url = validate_target(args.database_url)
    sources = [path.resolve() for path in args.sources]
    for source in sources:
        if not source.is_file():
            raise SystemExit(f"SQLite source not found: {source}")

    engine = create_engine(target_url)

    # Importing the app registers every model used by the active application.
    from app import create_app, db
    from app.services.sara_voice import VoiceSession  # noqa: F401

    os.environ["DATABASE_URL"] = target_url.render_as_string(hide_password=False)
    app = create_app()
    with app.app_context():
        db.create_all()

    metadata = MetaData()
    metadata.reflect(bind=engine)
    source_maps = {
        source: defaultdict(dict)
        for source in sources
    }
    inserted = defaultdict(int)
    merged = defaultdict(int)

    with engine.begin() as connection:
        populated = []
        for name in TABLE_ORDER:
            if name in metadata.tables:
                count = connection.execute(
                    select(func.count()).select_from(metadata.tables[name])
                ).scalar_one()
                if count:
                    populated.append(f"{name}={count}")
        if populated:
            raise SystemExit(
                "PostgreSQL target is not empty (" + ", ".join(populated) + "). "
                "Use a fresh database so existing records cannot be overwritten."
            )

        for table_name in TABLE_ORDER:
            if table_name not in metadata.tables:
                continue
            table = metadata.tables[table_name]
            target_columns = {column.name for column in table.columns}
            identities = {}
            users_by_email = {}

            for source in sources:
                for source_row in sqlite_rows(source, table_name):
                    old_id = source_row.get("id")
                    row = {
                        key: convert_value(table.c[key], value)
                        for key, value in source_row.items()
                        if key in target_columns and key != "id"
                    }

                    for column, parent_table in FOREIGN_KEYS.get(table_name, {}).items():
                        old_parent_id = row.get(column)
                        if old_parent_id is not None:
                            row[column] = source_maps[source][parent_table].get(
                                old_parent_id
                            )

                    if table_name == "users":
                        email = (row.get("email") or "").strip().lower()
                        if email in users_by_email:
                            user_id, current = users_by_email[email]
                            if merge_user(current, row):
                                connection.execute(
                                    table.update()
                                    .where(table.c.id == user_id)
                                    .values(
                                        **{
                                            key: value
                                            for key, value in current.items()
                                            if key != "id"
                                        }
                                    )
                                )
                                merged[table_name] += 1
                            source_maps[source][table_name][old_id] = user_id
                            continue

                    identity = row_identity(row)
                    if identity in identities:
                        source_maps[source][table_name][old_id] = identities[identity]
                        continue

                    result = connection.execute(table.insert().values(**row))
                    new_id = result.inserted_primary_key[0]
                    source_maps[source][table_name][old_id] = new_id
                    identities[identity] = new_id
                    inserted[table_name] += 1
                    if table_name == "users":
                        users_by_email[email] = (new_id, dict(row, id=new_id))

        reset_sequences(connection, metadata)

    print("Migration complete.")
    for table_name in TABLE_ORDER:
        if inserted[table_name] or merged[table_name]:
            suffix = f", merged {merged[table_name]}" if merged[table_name] else ""
            print(f"  {table_name}: inserted {inserted[table_name]}{suffix}")


if __name__ == "__main__":
    main()
