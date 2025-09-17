import os
import sqlite3
import uuid
from datetime import datetime, timedelta
from flask import g, request


DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'climate_echoes.db'))


def get_db():
    db = getattr(g, '_db', None)
    if db is None:
        db = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        g._db = db
    return db


def close_db(e=None):
    db = getattr(g, '_db', None)
    if db is not None:
        db.close()
        g._db = None


def fetch_one(query, params=()):
    cur = get_db().execute(query, params)
    row = cur.fetchone()
    cur.close()
    return row


def fetch_all(query, params=()):
    cur = get_db().execute(query, params)
    rows = cur.fetchall()
    cur.close()
    return rows


def execute(query, params=()):
    db = get_db()
    cur = db.execute(query, params)
    db.commit()
    last_id = cur.lastrowid
    cur.close()
    return last_id


def create_session(user_id, hours=72):
    token = uuid.uuid4().hex
    now = datetime.utcnow()
    expires = now + timedelta(hours=hours)
    execute(
        "INSERT INTO sessions(user_id, token, created_at) VALUES(?, ?, ?)",
        (user_id, token, now.isoformat() + 'Z')
    )
    return token, expires


def get_current_user():
    from flask import request
    token = request.cookies.get('session_token')
    if not token:
        return None
    row = fetch_one("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?", (token,))
    return row


