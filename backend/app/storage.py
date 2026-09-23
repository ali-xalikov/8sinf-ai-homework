"""
Ma'lumotlar bazasi abstraktsiya qatlami.

SQLite (mahalliy) yoki PostgreSQL (prod) bilan ishlaydi.
Barcha yuqori darajadagi modullar faqat shu qatlamdagi `exec_*`
funktsiyalarini ishlatadi — bazani almashtirish uchun boshqa
kodni qayta yozish shart emas.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

from . import config

log = logging.getLogger("storage")

_engine: Optional[Engine] = None


def _normalize_db_url(url: str) -> str:
    """Hosting bergan URL'ni psycopg (v3) drayveriga moslashtiradi.

    Render/Railway `postgres://...` yoki `postgresql://...` beradi — bu
    SQLAlchemy'da standart bo'yicha psycopg2'ni talab qiladi. Bizda esa
    `psycopg[binary]` (v3) o'rnatilgan, shuning uchun `+psycopg` qo'shamiz.
    """
    u = (url or "").strip()
    for prefix in ("postgres://", "postgresql://"):
        if u.startswith(prefix):
            return "postgresql+psycopg://" + u[len(prefix):]
    if u.startswith("postgresql+psycopg2://"):
        return "postgresql+psycopg://" + u[len("postgresql+psycopg2://"):]
    return u


def get_engine() -> Engine:
    global _engine
    if _engine is not None:
        return _engine

    if config.DATABASE_URL:
        url = _normalize_db_url(config.DATABASE_URL)
        connect_args: Dict[str, Any] = {}
        pool_args: Dict[str, Any] = {"pool_recycle": 1800, "pool_pre_ping": True}
        log.info("Ma'lumotlar bazasi: PostgreSQL (%s)", url.split("@")[-1] if "@" in url else url)
    else:
        url = f"sqlite:///{config.DB_PATH.as_posix()}"
        connect_args = {"check_same_thread": False}
        pool_args = {}
        log.info("Ma'lumotlar bazasi: SQLite (%s)", config.DB_PATH)

    _engine = create_engine(url, connect_args=connect_args, **pool_args)
    return _engine


def _rows(result) -> List[Dict[str, Any]]:
    return [dict(m) for m in result.mappings()]


def exec_all(sql: str, **params) -> List[Dict[str, Any]]:
    eng = get_engine()
    with eng.connect() as conn:
        result = conn.execute(text(sql), params)
        return [dict(m) for m in result.mappings()]


def exec_one(sql: str, **params) -> Optional[Dict[str, Any]]:
    rows = exec_all(sql, **params)
    return rows[0] if rows else None


def exec_write(sql: str, **params) -> None:
    eng = get_engine()
    with eng.begin() as conn:
        conn.execute(text(sql), params)


def exec_many(sql: str, seq: Sequence[Dict[str, Any]]) -> None:
    if not seq:
        return
    eng = get_engine()
    with eng.begin() as conn:
        conn.execute(text(sql), seq)


def exec_commit(work) -> None:
    """Bitta tranzaksiyada bir nechta write yoki maxsus operatsiyalar."""
    eng = get_engine()
    with eng.begin() as conn:
        work(conn)


# ---------------------------------------------------------------
# Sxema
# ---------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  first_name     TEXT NOT NULL DEFAULT '',
  last_name      TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'student',
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS sessions(
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS books(
  id              TEXT PRIMARY KEY,
  subject_id      TEXT NOT NULL,
  title           TEXT NOT NULL,
  author          TEXT DEFAULT '',
  edition         TEXT DEFAULT '',
  publisher       TEXT DEFAULT '',
  year            TEXT DEFAULT '',
  class_no        INTEGER DEFAULT 8,
  language        TEXT DEFAULT 'uz',
  pdf_path        TEXT NOT NULL,
  page_offset     INTEGER DEFAULT 0,
  detected_offset INTEGER,
  num_pages       INTEGER DEFAULT 0,
  indexed         INTEGER DEFAULT 0,
  indexed_at      TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject_id, class_no);

CREATE TABLE IF NOT EXISTS pages(
  book_id      TEXT NOT NULL,
  page_no      INTEGER NOT NULL,
  printed_page INTEGER DEFAULT 0,
  text         TEXT NOT NULL DEFAULT '',
  chars        INTEGER DEFAULT 0,
  PRIMARY KEY(book_id, page_no)
);
CREATE INDEX IF NOT EXISTS idx_pages_book ON pages(book_id);

CREATE TABLE IF NOT EXISTS chunks(
  book_id   TEXT NOT NULL,
  page_no   INTEGER NOT NULL,
  chunk_idx INTEGER NOT NULL,
  text      TEXT NOT NULL,
  PRIMARY KEY(book_id, page_no, chunk_idx)
);
CREATE INDEX IF NOT EXISTS idx_chunks_book ON chunks(book_id, page_no);

CREATE TABLE IF NOT EXISTS chat_messages(
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  source     TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS saved_solutions(
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  message_id TEXT NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  source     TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_solutions(user_id, created_at);

CREATE TABLE IF NOT EXISTS search_history(
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  query      TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_user ON search_history(user_id, created_at);

CREATE TABLE IF NOT EXISTS shared_solutions(
  id         TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  source     TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shared_message ON shared_solutions(message_id);

CREATE TABLE IF NOT EXISTS conversations(
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  subject    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at);

CREATE TABLE IF NOT EXISTS conversation_messages(
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_messages ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS answers(
  id         TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL DEFAULT '',
  kind       TEXT NOT NULL DEFAULT 'bsb',
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answers_subject ON answers(subject_id, kind);
CREATE INDEX IF NOT EXISTS idx_answers_kind ON answers(kind, created_at);
"""


def init_schema() -> None:
    eng = get_engine()
    with eng.begin() as conn:  # type: Connection
        for stmt in SCHEMA.split(";"):
            s = stmt.strip()
            if s:
                conn.execute(text(s))
    log.info("DB sxemasi tayyor (%s)", "postgres" if config.DATABASE_URL else "sqlite")