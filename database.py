import sqlite3
from contextlib import contextmanager
import os
from pathlib import Path

DATABASE_URL = os.environ.get('DATABASE_URL', 'books.db')

def get_db():
    """Get a database connection with Row factory."""
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_db_cursor():
    conn = get_db()
    try:
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    finally:
        conn.close()

def init_db():
    """Initialize the database."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                description TEXT,
                average_rating REAL DEFAULT 0,
                topics TEXT,
                publication_year INTEGER,
                page_count INTEGER
            )
        """)
        conn.commit()
    # Read schema
    schema_path = Path('schema.sql')
    if not schema_path.exists():
        raise FileNotFoundError("schema.sql not found")
        
    with open(schema_path) as f:
        conn.executescript(f.read())
    
    conn.commit()
    print("Database initialized successfully")
    return conn

def get_db_connection():
    """Get a database connection for the current request."""
    try:
        conn = get_db()
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise 