import sqlite3
from pathlib import Path

def get_db():
    """Get a database connection with Row factory."""
    conn = sqlite3.connect('books.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database."""
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id TEXT NOT NULL,
                rating INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (book_id) REFERENCES books (id)
            )
        """)
        db.commit()
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