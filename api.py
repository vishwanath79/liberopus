from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union
from datetime import datetime
from database import get_db_cursor, init_db
from models import Book, Rating
from fastapi.middleware.cors import CORSMiddleware
import csv
import json
from pathlib import Path
import sqlite3
import hashlib

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

def clean_csv_value(value):
    """Clean CSV value by removing quotes and extra whitespace."""
    if not value:
        return ""
    # Remove extra quotes and whitespace
    value = value.strip().strip('"="').strip('"')
    return value

def generate_book_id(title: str, author: str) -> str:
    """Generate a stable book ID from title and author."""
    combined = (title + author).encode('utf-8')
    return hashlib.sha256(combined).hexdigest()[:16]

def import_goodreads_books():
    """Import books from Goodreads CSV export."""
    try:
        csv_path = Path("goodreads_library_export.csv")
        if not csv_path.exists():
            print(f"CSV file not found at {csv_path.absolute()}")
            return
        
        print(f"Starting Goodreads import from {csv_path.absolute()}")
        
        with get_db_cursor() as cursor:
            # Clear existing books
            cursor.execute("DELETE FROM books")
            cursor.execute("DELETE FROM ratings")
            
            # Read CSV file
            with open(csv_path, 'r', encoding='utf-8') as file:
                # Read header and clean it
                header = file.readline().strip().split(',')
                header = [h.strip() for h in header]
                print(f"CSV Headers: {header}")
                
                books_added = 0
                for line in file:
                    try:
                        # Split the line and clean values
                        values = line.strip().split(',')
                        if len(values) < len(header):
                            continue
                            
                        # Create a dictionary of cleaned values
                        row = {header[i]: clean_csv_value(values[i]) for i in range(len(header))}
                        
                        # Skip empty rows
                        if not row.get('Title'):
                            continue
                            
                        # Determine topics based on bookshelves, title, and description
                        bookshelves = row.get('Bookshelves', '').lower()
                        title = row.get('Title', '').lower()
                        description = row.get('Description', '').lower()
                        topics = []
                        
                        # Technical books - focused on programming and technology
                        technical_keywords = [
                            'programming', 'python', 'javascript', 'java', 'c++', 'software',
                            'coding', 'development', 'web development', 'data science',
                            'machine learning', 'artificial intelligence', 'computer science',
                            'algorithms', 'database', 'cloud computing', 'devops', 'engineering',
                            'software engineering', 'code', 'git', 'agile', 'react', 'nodejs',
                            'frontend', 'backend', 'full stack', 'api', 'security', 'linux',
                            'operating system', 'network', 'cybersecurity', 'blockchain',
                            'technical', 'technology', 'computer'
                        ]
                        
                        # Check if book is technical
                        is_technical = any(
                            keyword in bookshelves or keyword in title or keyword in description
                            for keyword in technical_keywords
                        )
                        
                        if is_technical:
                            topics.append('Technical')
                        else:
                            topics.append('Non-Technical')
                        
                        # Clean numeric values
                        try:
                            avg_rating = float(clean_csv_value(row.get('Average Rating', '0')))
                        except ValueError:
                            avg_rating = 0.0
                            
                        try:
                            pages = int(clean_csv_value(row.get('Number of Pages', '0')))
                        except ValueError:
                            pages = None
                            
                        try:
                            year = int(clean_csv_value(row.get('Year Published', '0')))
                        except ValueError:
                            year = None
                        
                        # Prepare book data
                        book_data = {
                            'id': generate_book_id(row['Title'], row.get('Author', '')),
                            'title': row['Title'],
                            'author': row.get('Author', 'Unknown'),
                            'description': f"A book by {row.get('Author', 'Unknown')}. Published by {row.get('Publisher', 'Unknown')}.",
                            'average_rating': avg_rating,
                            'topics': json.dumps(topics),
                            'publication_year': year,
                            'page_count': pages
                        }
                        
                        # Insert book into database
                        cursor.execute("""
                            INSERT OR REPLACE INTO books 
                            (id, title, author, description, average_rating, topics, publication_year, page_count)
                            VALUES (:id, :title, :author, :description, :average_rating, :topics, :publication_year, :page_count)
                        """, book_data)
                        
                        books_added += 1
                        if books_added % 10 == 0:
                            print(f"Added {books_added} books...")
                            
                    except Exception as e:
                        print(f"Error processing line: {str(e)}")
                        continue
                
            print(f"Successfully imported {books_added} books from Goodreads")
                
    except Exception as e:
        print(f"Error importing books from Goodreads: {str(e)}")
        raise

# Initialize database and import books on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    import_goodreads_books()

class Book(BaseModel):
    id: str
    title: str
    author: str
    description: str
    average_rating: float
    topics: List[str]
    publication_year: Optional[int] = None
    page_count: Optional[int] = None

class RatingRequest(BaseModel):
    book_id: str
    rating: int

def convert_db_book_to_model(row: sqlite3.Row) -> Book:
    # Convert topics from JSON string to list
    topics = json.loads(row['topics']) if row['topics'] else []
    return Book(
        id=row['id'],
        title=row['title'],
        author=row['author'],
        description=row['description'],
        average_rating=float(row['average_rating']),
        topics=topics,
        publication_year=row['publication_year'],
        page_count=row['page_count']
    )

@app.get("/")
async def root():
    return {"message": "Book Recommender API is running"}

@app.get("/books")
async def get_books():
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM books")
        books = cursor.fetchall()
        return [dict(book) for book in books]

class AddBookRequest(BaseModel):
    """Request model for adding a book"""
    title: str
    author: str
    description: Optional[str] = None
    technical_level: Optional[str] = "intermediate"
    page_count: Optional[int] = None
    publication_year: Optional[int] = None

@app.post("/add-book")
async def add_book(book_data: AddBookRequest):
    """Add a new book to the database."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO books (
                    title, author, description, technical_level, 
                    page_count, publication_year
                ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    book_data.title,
                    book_data.author,
                    book_data.description,
                    book_data.technical_level,
                    book_data.page_count,
                    book_data.publication_year
                ))
            
            # Get the inserted book
            book_id = cursor.lastrowid
            cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
            book = cursor.fetchone()
            
            return {"message": "Book added successfully", "book": convert_db_book_to_model(book)}
    except Exception as e:
        print(f"Error adding book: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ratings")
async def add_rating(request: RatingRequest):
    """Rate a book."""
    try:
        print(f"Processing rating request: {request}")  # Debug log
        with get_db_cursor() as cursor:
            # Check if book exists
            cursor.execute("SELECT id FROM books WHERE id = ?", (request.book_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Book not found")
            
            # Check if rating is valid (1-5)
            if not 1 <= request.rating <= 5:
                raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
            
            # Check if rating already exists
            cursor.execute(
                "SELECT id FROM ratings WHERE book_id = ?",
                (request.book_id,)
            )
            existing_rating = cursor.fetchone()
            
            current_time = datetime.now().isoformat()
            
            if existing_rating:
                # Update existing rating
                cursor.execute(
                    "UPDATE ratings SET rating = ?, timestamp = ? WHERE book_id = ?",
                    (request.rating, current_time, request.book_id)
                )
            else:
                # Add new rating
                cursor.execute(
                    "INSERT INTO ratings (book_id, rating, timestamp) VALUES (?, ?, ?)",
                    (request.book_id, request.rating, current_time)
                )
            
            # Calculate and update average rating for the book
            cursor.execute(
                """
                SELECT AVG(rating) as avg_rating
                FROM ratings
                WHERE book_id = ?
                """,
                (request.book_id,)
            )
            avg_rating = cursor.fetchone()["avg_rating"]
            
            cursor.execute(
                "UPDATE books SET average_rating = ? WHERE id = ?",
                (avg_rating or 0, request.book_id)
            )
            
            print(f"Successfully rated book {request.book_id} with rating {request.rating}")  # Debug log
            return {
                "message": "Rating submitted successfully",
                "book_id": request.book_id,
                "rating": request.rating,
                "average_rating": avg_rating or 0
            }
            
    except Exception as e:
        print(f"Error rating book: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ratings")
async def get_ratings():
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM ratings")
        ratings = cursor.fetchall()
        return {"ratings": [dict(rating) for rating in ratings]}

@app.post("/import-goodreads")
async def import_goodreads():
    """Manually trigger Goodreads import."""
    try:
        import_goodreads_books()
        return {"message": "Goodreads import completed successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to import Goodreads books: {str(e)}"
        )

class RecommendationRequest(BaseModel):
    """Request model for getting recommendations"""
    user_history: List[str]
    user_ratings: dict[str, int]

def log_recommendations(user_ratings: dict, recommendations: List[Book], liked_books: List[Book] = None):
    """Log recommendations to a single text file with timestamps."""
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    log_file = log_dir / "recommendations.txt"
    
    with open(log_file, "a", encoding="utf-8") as f:
        f.write("\n" + "="*80 + "\n")  # Section separator
        f.write(f"Recommendation Log - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("="*50 + "\n\n")
        
        # Log user's rating patterns
        f.write("User Rating Summary:\n")
        f.write(f"Total books rated: {len(user_ratings)}\n")
        rating_counts = {}
        for rating in user_ratings.values():
            rating_counts[rating] = rating_counts.get(rating, 0) + 1
        for rating, count in sorted(rating_counts.items()):
            f.write(f"Rating {rating} stars: {count} books\n")
        f.write("\n")
        
        if liked_books:
            f.write("Based on these highly rated books (4+ stars):\n")
            for book in liked_books:
                f.write(f"- {book.title} by {book.author} (Rating: {user_ratings.get(str(book.id), 0)})\n")
            f.write("\n")
        else:
            f.write("No highly rated books found. Using default recommendations.\n\n")
        
        f.write("Recommended Books:\n")
        for i, book in enumerate(recommendations, 1):
            f.write(f"{i}. {book.title} by {book.author}\n")
            f.write(f"   Published: {book.publication_year}\n")
            f.write(f"   Average Rating: {book.average_rating:.1f}\n")
            f.write(f"   Topics: {', '.join(book.topics)}\n")
            f.write(f"   Description: {book.description}\n")
            f.write("\n")
        
        f.write("-"*80 + "\n\n")  # End of entry marker

class DismissBookRequest(BaseModel):
    """Request model for dismissing a book"""
    book_id: str

class WishlistRequest(BaseModel):
    """Request model for wishlist operations"""
    book_id: str
    notes: Optional[str] = None

@app.post("/dismiss-book")
async def dismiss_book(request: DismissBookRequest):
    """Add a book to the dismissed list."""
    try:
        with get_db_cursor() as cursor:
            # Check if book exists
            cursor.execute("SELECT id FROM books WHERE id = ?", (request.book_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Book not found")
            
            # Add to dismissed books
            cursor.execute(
                "INSERT INTO dismissed_books (book_id, timestamp) VALUES (?, ?)",
                (request.book_id, datetime.now().isoformat())
            )
            return {"message": "Book dismissed successfully"}
    except Exception as e:
        print(f"Error dismissing book: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dismissed-books")
async def get_dismissed_books():
    """Get list of dismissed book IDs."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT book_id FROM dismissed_books")
            dismissed = cursor.fetchall()
            return {"dismissed_books": [row["book_id"] for row in dismissed]}
    except Exception as e:
        print(f"Error getting dismissed books: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-recommendations")
async def get_recommendations(request: RecommendationRequest):
    """Get personalized book recommendations."""
    try:
        print("Processing recommendation request:", request)
        
        with get_db_cursor() as cursor:
            rated_books = list(request.user_ratings.keys())
            
            # First, ensure all books have IDs
            cursor.execute("""
                UPDATE books 
                SET id = LOWER(HEX(RANDOMBLOB(8)))
                WHERE id IS NULL OR id = ''
            """)
            
            if rated_books:
                placeholders = ','.join(['?' for _ in rated_books])
                query = f"""
                    SELECT 
                        b.id,
                        b.title,
                        b.author,
                        b.description,
                        b.topics,
                        b.publication_year,
                        b.page_count,
                        COALESCE(AVG(r.rating), 0) as average_rating
                    FROM books b
                    LEFT JOIN ratings r ON b.id = r.book_id
                    WHERE b.id NOT IN ({placeholders})
                    GROUP BY b.id
                    HAVING average_rating >= 0
                    ORDER BY average_rating DESC
                    LIMIT 5
                """
                print(f"Executing query with rated_books: {rated_books}")  # Debug log
                cursor.execute(query, rated_books)
            else:
                cursor.execute("""
                    SELECT 
                        b.id,
                        b.title,
                        b.author,
                        b.description,
                        b.topics,
                        b.publication_year,
                        b.page_count,
                        COALESCE(AVG(r.rating), 0) as average_rating
                    FROM books b
                    LEFT JOIN ratings r ON b.id = r.book_id
                    GROUP BY b.id
                    ORDER BY RANDOM()
                    LIMIT 5
                """)

            books = cursor.fetchall()
            print(f"Found {len(books)} recommendations")  # Debug log

            recommendations = []
            for book in books:
                book_dict = dict(book)
                
                # Ensure book has an ID
                if not book_dict.get('id'):
                    book_id = generate_book_id(book_dict['title'], book_dict['author'])
                    cursor.execute(
                        "UPDATE books SET id = ? WHERE title = ? AND author = ?",
                        (book_id, book_dict['title'], book_dict['author'])
                    )
                    book_dict['id'] = book_id

                # Parse topics from JSON string if needed
                if isinstance(book_dict.get('topics'), str):
                    try:
                        book_dict['topics'] = json.loads(book_dict['topics'])
                    except json.JSONDecodeError:
                        book_dict['topics'] = []
                elif book_dict.get('topics') is None:
                    book_dict['topics'] = []

                recommendations.append({
                    'id': book_dict['id'],
                    'title': book_dict['title'],
                    'author': book_dict['author'],
                    'description': book_dict.get('description', ''),
                    'topics': book_dict['topics'],
                    'publication_year': book_dict.get('publication_year'),
                    'page_count': book_dict.get('page_count'),
                    'average_rating': float(book_dict['average_rating']) if book_dict.get('average_rating') else 0
                })
                print(f"Processed recommendation: {recommendations[-1]}")  # Debug log

            return {"recommendations": recommendations}
            
    except Exception as e:
        print(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wishlist")
async def get_wishlist():
    with get_db_cursor() as cursor:
        cursor.execute("""
            SELECT w.*, b.* 
            FROM wishlist w 
            JOIN books b ON w.book_id = b.id 
            ORDER BY w.display_order
        """)
        items = cursor.fetchall()
        
        # Process items to ensure topics are parsed from JSON
        processed_items = []
        for item in items:
            item_dict = dict(item)
            # Parse topics from JSON string if needed
            if isinstance(item_dict.get('topics'), str):
                try:
                    item_dict['topics'] = json.loads(item_dict['topics'])
                except json.JSONDecodeError:
                    item_dict['topics'] = []
            elif item_dict.get('topics') is None:
                item_dict['topics'] = []
            processed_items.append(item_dict)
            
        return {"wishlist": processed_items}

@app.post("/wishlist/add")
async def add_to_wishlist(request: WishlistRequest):
    """Add a book to the wishlist."""
    with get_db_cursor() as cursor:
        # Get the highest display_order
        cursor.execute("SELECT MAX(display_order) FROM wishlist")
        max_order = cursor.fetchone()[0] or 0
        
        # Add the new item
        cursor.execute(
            "INSERT INTO wishlist (book_id, display_order, notes) VALUES (?, ?, ?)",
            (request.book_id, max_order + 1, request.notes)
        )
        return {"message": "Added to wishlist"}

@app.delete("/wishlist/remove/{book_id}")
async def remove_from_wishlist(book_id: str):
    """Remove a book from the wishlist."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM wishlist WHERE book_id = ?", (book_id,))
        return {"message": "Removed from wishlist"}

@app.put("/wishlist/reorder")
async def reorder_wishlist(orders: List[dict[str, Union[str, int]]]):
    """Update the display order of wishlist items."""
    try:
        with get_db_cursor() as cursor:
            for item in orders:
                cursor.execute(
                    "UPDATE wishlist SET display_order = ? WHERE book_id = ?",
                    (item["order"], item["book_id"])
                )
            return {"message": "Wishlist reordered successfully"}
    except Exception as e:
        print(f"Error reordering wishlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 