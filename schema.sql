CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    average_rating REAL DEFAULT 0.0,
    topics TEXT, -- Stored as JSON array
    publication_year INTEGER,
    page_count INTEGER
);

CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE IF NOT EXISTS dismissed_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
); 