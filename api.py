from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db, init_db
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
async def get_recommendations(request: RecommendationRequest):
    """Get personalized book recommendations."""
    try:
        with get_db() as db:
            # Get dismissed books
            cursor = db.execute("SELECT book_id FROM dismissed_books")
            dismissed_books = {row["book_id"] for row in cursor.fetchall()}
            
            # Get all available books
            cursor = db.execute("""
                SELECT b.*, 
                       COALESCE(AVG(r.rating), 0) as avg_rating,
                       COUNT(r.id) as rating_count
                FROM books b
                LEFT JOIN ratings r ON b.id = r.book_id
                GROUP BY b.id
            """)
            all_books = cursor.fetchall()
            
            # Convert to Book models and filter out dismissed books
            available_books = [
                convert_db_book_to_model(book) 
                for book in all_books 
                if book["id"] not in dismissed_books
            ]
            
            # Get user's rated books
            rated_books = [book for book in available_books if str(book.id) in request.user_ratings]
            liked_books = [book for book in rated_books if request.user_ratings[str(book.id)] >= 4]
            
            # If no history, return some default recommendations
            if not request.user_history:
                recommendations = available_books[:5]
                log_recommendations(request.user_ratings, recommendations)
                return {"recommendations": recommendations}
            
            # Filter out books the user has already rated
            unrated_books = [
                book for book in available_books 
                if str(book.id) not in request.user_ratings
            ]
            
            # If no unrated books, return empty list
            if not unrated_books:
                return {"recommendations": []}
            
            # Get recommendations based on average rating and topics from liked books
            if liked_books:
                # Get all topics from liked books
                liked_topics = set()
                for book in liked_books:
                    if book.topics:
                        liked_topics.update(topic.lower() for topic in book.topics)
                
                # Score books based on topic matches and average rating
                scored_books = []
                for book in unrated_books:
                    # Calculate topic score
                    topic_score = 0
                    if book.topics:
                        book_topics = set(topic.lower() for topic in book.topics)
                        # Give higher weight to exact topic matches
                        exact_matches = len(book_topics.intersection(liked_topics))
                        # Also consider partial matches
                        partial_matches = sum(
                            1 for bt in book_topics 
                            for lt in liked_topics 
                            if bt in lt or lt in bt
                        )
                        topic_score = (exact_matches * 3) + (partial_matches * 1)
                    
                    # Calculate rating score (normalized to 0-5 range)
                    rating_score = float(book.average_rating)
                    
                    # Final score combines topic matches and rating
                    final_score = (topic_score * 2) + rating_score
                    
                    scored_books.append((book, final_score))
                
                recommendations = [
                    book for book, _ in sorted(
                        scored_books,
                        key=lambda x: x[1],
                        reverse=True
                    )
                ][:5]
            else:
                # If no liked books, sort by average rating
                recommendations = sorted(
                    unrated_books,
                    key=lambda x: float(x.average_rating),
                    reverse=True
                )[:5]
            
            # Log the recommendations
            log_recommendations(request.user_ratings, recommendations, liked_books)
            
            return {"recommendations": recommendations}
            
    except Exception as e:
        print(f"Error getting recommendations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get recommendations: {str(e)}"
        ) 