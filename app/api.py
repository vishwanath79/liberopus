from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union, Dict
from datetime import datetime
from .database import get_db, init_db
from .models import Book, Rating
from fastapi.middleware.cors import CORSMiddleware
import csv
import json
from pathlib import Path
import sqlite3
import hashlib
from .llm_recommender import get_personalized_recommendations

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
        
        with get_db() as db:
            # Clear existing books
            db.execute("DELETE FROM books")
            db.execute("DELETE FROM ratings")
            db.commit()
            
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
                        cursor = db.execute("""
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
                
                db.commit()
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
    """Get all books from the database."""
    try:
        with get_db() as db:
            cursor = db.execute("""
                SELECT b.*, 
                       COUNT(r.id) as rating_count
                FROM books b
                LEFT JOIN ratings r ON b.id = r.book_id
                GROUP BY b.id
                ORDER BY b.title
            """)
            books = cursor.fetchall()
            print(f"Found {len(books)} books in database")  # Debug log
            
            book_list = []
            for book in books:
                try:
                    print(f"Processing book: id={book['id']}, title={book['title']}")  # Debug log
                    book_model = convert_db_book_to_model(book)
                    book_list.append(book_model)
                except Exception as book_error:
                    print(f"Error converting book {book['id']}: {str(book_error)}")
                    continue
            
            return book_list
            
    except Exception as e:
        print(f"Error in get_books: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load books: {str(e)}"
        )

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
        with get_db() as db:
            cursor = db.execute("""
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
            db.commit()
            
            # Get the inserted book
            book_id = cursor.lastrowid
            cursor = db.execute("SELECT * FROM books WHERE id = ?", (book_id,))
            book = cursor.fetchone()
            
            return {"message": "Book added successfully", "book": convert_db_book_to_model(book)}
    except Exception as e:
        print(f"Error adding book: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class RatingRequest(BaseModel):
    """Request model for submitting a rating"""
    book_id: str
    rating: int

@app.post("/ratings")
async def submit_rating(request: RatingRequest):
    """Submit a rating for a book."""
    try:
        print(f"Received rating request: book_id={request.book_id}, rating={request.rating}")  # Debug log
        with get_db() as db:
            # Check if book exists
            cursor = db.execute("SELECT id, title FROM books WHERE id = ?", (request.book_id,))
            book = cursor.fetchone()
            if not book:
                print(f"Book not found with ID: {request.book_id}")  # Debug log
                # List some valid book IDs for comparison
                cursor = db.execute("SELECT id, title FROM books LIMIT 5")
                sample_books = cursor.fetchall()
                print("Sample valid book IDs:")
                for b in sample_books:
                    print(f"  {b['id']} - {b['title']}")
                raise HTTPException(status_code=404, detail="Book not found")
            
            print(f"Found book: id={book['id']}, title={book['title']}")  # Debug log
            
            # Check if rating is valid (1-5)
            if not 1 <= request.rating <= 5:
                raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
            
            # Add or update rating
            db.execute("""
                INSERT OR REPLACE INTO ratings (book_id, rating, timestamp)
                VALUES (?, ?, ?)
            """, (request.book_id, request.rating, datetime.now().isoformat()))
            
            db.commit()
            print(f"Successfully submitted rating for book: {book['title']}")  # Debug log
            return {"message": "Rating submitted successfully"}
    except Exception as e:
        print(f"Error submitting rating: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ratings")
async def get_ratings():
    """Get all ratings from the database."""
    try:
        with get_db() as db:
            cursor = db.execute("SELECT * FROM ratings")
            ratings = cursor.fetchall()
            return {
                "ratings": [
                    {
                        "id": rating["id"],
                        "book_id": str(rating["book_id"]),
                        "rating": rating["rating"],
                        "timestamp": rating["timestamp"]
                    }
                    for rating in ratings
                ]
            }
    except Exception as e:
        print(f"Error getting ratings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
        with get_db() as db:
            # Check if book exists
            cursor = db.execute("SELECT id FROM books WHERE id = ?", (request.book_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Book not found")
            
            # Add to dismissed books
            db.execute(
                "INSERT INTO dismissed_books (book_id, timestamp) VALUES (?, ?)",
                (request.book_id, datetime.now().isoformat())
            )
            db.commit()
            return {"message": "Book dismissed successfully"}
    except Exception as e:
        print(f"Error dismissing book: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dismissed-books")
async def get_dismissed_books():
    """Get list of dismissed book IDs."""
    try:
        with get_db() as db:
            cursor = db.execute("SELECT book_id FROM dismissed_books")
            dismissed = cursor.fetchall()
            return {"dismissed_books": [row["book_id"] for row in dismissed]}
    except Exception as e:
        print(f"Error getting dismissed books: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-recommendations")
async def get_recommendations(data: dict):
    """Get personalized book recommendations based on user history and ratings."""
    try:
        user_history = data.get("user_history", [])
        user_ratings = data.get("user_ratings", {})
        
        print(f"Received request - User history: {user_history}, User ratings: {user_ratings}")
        
        # Get book details for the rated books
        with get_db() as db:
            # First ensure we have some books in the database
            cursor = db.execute("SELECT COUNT(*) as count FROM books")
            book_count = cursor.fetchone()['count']
            
            if book_count == 0:
                raise HTTPException(
                    status_code=500,
                    detail="No books available in the database"
                )
            
            if user_history:
                placeholders = ','.join(['?' for _ in user_history])
                query = f"""
                    SELECT b.id, b.title, b.author, b.description, b.topics, b.publication_year, b.page_count,
                           COALESCE(AVG(r.rating), 0) as average_rating
                    FROM books b
                    LEFT JOIN ratings r ON b.id = r.book_id
                    WHERE b.id IN ({placeholders})
                    GROUP BY b.id
                """
                cursor = db.execute(query, user_history)
            else:
                # If no user history, get random books for default recommendations
                cursor = db.execute("""
                    SELECT b.id, b.title, b.author, b.description, b.topics, b.publication_year, b.page_count,
                           COALESCE(AVG(r.rating), 0) as average_rating
                    FROM books b
                    LEFT JOIN ratings r ON b.id = r.book_id
                    GROUP BY b.id
                    ORDER BY RANDOM()
                    LIMIT 5
                """)
            
            books = cursor.fetchall()
            book_history = []
            for book in books:
                book_dict = dict(book)
                # Parse topics from JSON string if needed
                if isinstance(book_dict.get('topics'), str):
                    try:
                        book_dict['topics'] = json.loads(book_dict['topics'])
                    except json.JSONDecodeError:
                        book_dict['topics'] = []
                elif book_dict.get('topics') is None:
                    book_dict['topics'] = []
                book_history.append(book_dict)
        
        # Get recommendations using Gemini LLM
        recommendations = await get_personalized_recommendations(
            user_history=book_history,
            user_ratings=user_ratings,
            num_recommendations=5
        )
        
        print("Generated recommendations:", recommendations)
        
        if not recommendations:
            # If no recommendations, return random books
            with get_db() as db:
                cursor = db.execute("""
                    SELECT b.id, b.title, b.author, b.description, b.topics, b.publication_year, b.page_count,
                           COALESCE(AVG(r.rating), 0) as average_rating
                    FROM books b
                    LEFT JOIN ratings r ON b.id = r.book_id
                    GROUP BY b.id
                    ORDER BY RANDOM()
                    LIMIT 5
                """)
                default_books = cursor.fetchall()
                recommendations = []
                for book in default_books:
                    book_dict = dict(book)
                    if isinstance(book_dict.get('topics'), str):
                        try:
                            book_dict['topics'] = json.loads(book_dict['topics'])
                        except json.JSONDecodeError:
                            book_dict['topics'] = []
                    elif book_dict.get('topics') is None:
                        book_dict['topics'] = []
                    recommendations.append(book_dict)
        
        # Return recommendations in the expected format
        return {
            "recommendations": recommendations,
            "message": "Successfully generated recommendations"
        }
        
    except Exception as e:
        print(f"Error in get_recommendations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get recommendations: {str(e)}"
        )

@app.get("/wishlist")
async def get_wishlist():
    """Get all books in the wishlist."""
    try:
        with get_db() as db:
            cursor = db.execute("""
                SELECT b.*, w.notes, w.timestamp, w.display_order
                FROM books b
                JOIN wishlists w ON b.id = w.book_id
                ORDER BY w.display_order, w.timestamp DESC
            """)
            wishlist_books = cursor.fetchall()
            
            return {
                "wishlist": [
                    {
                        **convert_db_book_to_model(book).dict(),
                        "notes": book["notes"],
                        "added_at": book["timestamp"],
                        "display_order": book["display_order"]
                    }
                    for book in wishlist_books
                ]
            }
    except Exception as e:
        print(f"Error getting wishlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/wishlist/add")
async def add_to_wishlist(request: WishlistRequest):
    """Add a book to the wishlist."""
    try:
        with get_db() as db:
            # Check if book exists
            cursor = db.execute("SELECT id FROM books WHERE id = ?", (request.book_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Book not found")
            
            # Check if book is already in wishlist
            cursor = db.execute("SELECT id FROM wishlists WHERE book_id = ?", (request.book_id,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Book already in wishlist")
            
            # Get max display order
            cursor = db.execute("SELECT MAX(display_order) as max_order FROM wishlists")
            result = cursor.fetchone()
            next_order = (result["max_order"] or 0) + 1
            
            # Add to wishlist
            db.execute(
                "INSERT INTO wishlists (book_id, notes, timestamp, display_order) VALUES (?, ?, ?, ?)",
                (request.book_id, request.notes, datetime.now().isoformat(), next_order)
            )
            db.commit()
            return {"message": "Book added to wishlist successfully"}
    except Exception as e:
        print(f"Error adding to wishlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/wishlist/remove/{book_id}")
async def remove_from_wishlist(book_id: str):
    """Remove a book from the wishlist."""
    try:
        print(f"Attempting to remove book {book_id} from wishlist")  # Debug log
        with get_db() as db:
            # First check if the book is in the wishlist
            cursor = db.execute("SELECT book_id FROM wishlists WHERE book_id = ?", (book_id,))
            if not cursor.fetchone():
                print(f"Book {book_id} not found in wishlist")  # Debug log
                raise HTTPException(status_code=404, detail="Book not found in wishlist")
            
            # Remove from wishlist
            cursor = db.execute("DELETE FROM wishlists WHERE book_id = ?", (book_id,))
            print(f"Deleted {cursor.rowcount} rows from wishlist")  # Debug log
            
            if cursor.rowcount == 0:
                print(f"No rows were deleted for book {book_id}")  # Debug log
                raise HTTPException(status_code=404, detail="Book not found in wishlist")
            
            db.commit()
            print(f"Successfully removed book {book_id} from wishlist")  # Debug log
            return {"message": "Book removed from wishlist successfully"}
    except Exception as e:
        print(f"Error removing book {book_id} from wishlist: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/wishlist/reorder")
async def reorder_wishlist(orders: List[dict[str, Union[str, int]]]):
    """Update the display order of wishlist items."""
    try:
        with get_db() as db:
            for item in orders:
                db.execute(
                    "UPDATE wishlists SET display_order = ? WHERE book_id = ?",
                    (item["order"], item["book_id"])
                )
            db.commit()
            return {"message": "Wishlist reordered successfully"}
    except Exception as e:
        print(f"Error reordering wishlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/books")
async def add_book(book: AddBookRequest):
    """Add a new book to the database."""
    try:
        with get_db() as db:
            # Generate book ID from title and author
            book_id = str(hash(f"{book.title}{book.author}"))

            # Check if book already exists
            cursor = db.execute("SELECT id FROM books WHERE id = ?", (book_id,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Book already exists")

            # Insert new book with default values
            cursor.execute("""
                INSERT INTO books (id, title, author, description, average_rating, topics, publication_year, page_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                book_id,
                book.title,
                book.author,
                "Added by user",  # Default description
                0.0,  # Default rating
                json.dumps(["Non-Technical"]),  # Default topic
                datetime.now().year,  # Current year
                0  # Default page count
            ))
            
            db.commit()
            return {"message": "Book added successfully", "book_id": book_id}
    except Exception as e:
        print(f"Error adding book: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 