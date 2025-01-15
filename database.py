import sqlite3
from contextlib import contextmanager

@contextmanager
def get_db():
    """Get a database connection with context manager support."""
    conn = sqlite3.connect('books.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Initialize the database with required tables."""
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                description TEXT,
                technical_level TEXT,
                avg_rating REAL DEFAULT 0,
                page_count INTEGER,
                publication_year INTEGER,
                UNIQUE(title, author)
            )
        """)
        
        db.execute("""
            CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                rating INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY(book_id) REFERENCES books(id)
            )
        """)
        
        db.commit() 