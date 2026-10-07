"""Database connection pool.

Every query in this project uses PARAMETERS:   cur.execute("... WHERE id = %s", (value,))
never string formatting. This prevents SQL injection AND means values never appear
inside the SQL text that PostgreSQL may write to its logs.
"""
from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=10,
    kwargs={"row_factory": dict_row, "autocommit": True},   # each statement commits on its own...
    open=False,
)


def open_pool():
    global pool
    if getattr(pool, "closed", False) or getattr(pool, "_closed", False):
        pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row, "autocommit": True},
            open=True,
        )
    else:
        try:
            pool.open()
        except Exception:
            pass


def close_pool():
    global pool
    try:
        pool.close()
    except Exception:
        pass


def get_conn():
    """FastAPI dependency: one pooled connection per request."""
    with pool.connection() as conn:
        yield conn


@contextmanager
def transaction(conn):
    """...unless grouped here: everything inside succeeds together or is rolled back together."""
    with conn.transaction():
        yield conn
