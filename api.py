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

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

def import_goodreads_books():
    """Import books from Goodreads CSV export file."""
    try:
        with open('goodreads_library_export.csv', 'r', encoding='utf-8') as file:
            # Read the CSV file
            csv_reader = csv.DictReader(file)
            
            with get_db() as db:
                # Clear existing books
                db.execute("DELETE FROM books")
                db.execute("DELETE FROM ratings")
                db.commit()
                
                # Import each book
                for row in csv_reader:
                    try:
                        # Extract and clean data
                        title = row['Title'].strip()
                        author = row['Author'].strip()
                        description = f"A book titled '{title}' by {author}"
                        avg_rating = float(row['Average Rating']) if row['Average Rating'] else 0.0
                        page_count = int(row['Number of Pages']) if row['Number of Pages'] else None
                        year = int(row['Year Published']) if row['Year Published'] else None
                        
                        # Insert into database
                        db.execute("""
                            INSERT INTO books (
                                title, author, description, technical_level,
                                avg_rating, page_count, publication_year
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (
                            title,
                            author,
                            description,
                            'intermediate',  # default technical level
                            avg_rating,
                            page_count,
                            year
                        ))
                        
                    except Exception as e:
                        print(f"Error importing book {title}: {str(e)}")
                        continue
                
                db.commit()
                print("Goodreads import completed")
                
    except Exception as e:
        print(f"Error during Goodreads import: {str(e)}")
        raise e

# Initialize database and import books on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    import_goodreads_books()

def convert_db_book_to_model(book_row) -> Book:
    """Convert a database row to a Book model."""
    return Book(
        id=str(book_row["id"]),
        title=book_row["title"],
        author=book_row["author"],
        description=book_row["description"],
        technical_level=book_row["technical_level"],
        avg_rating=float(book_row["avg_rating"]) if "avg_rating" in book_row else 0.0,
        rating_count=int(book_row["rating_count"]) if "rating_count" in book_row else 0,
        page_count=book_row["page_count"],
        publication_year=book_row["publication_year"],
        topics=["General"],
        categories=["General"]
    )

@app.get("/")
async def root():
    return {"message": "Book Recommender API is running"}

@app.get("/books")
async def get_books():
    """Get all books from the database."""
    try:
        with get_db() as db:
            print("Executing database query...")  # Debug log
            cursor = db.execute("""
                SELECT b.*, 
                       COALESCE(AVG(r.rating), 0) as avg_rating,
                       COUNT(r.id) as rating_count
                FROM books b
                LEFT JOIN ratings r ON b.id = r.book_id
                GROUP BY b.id
                ORDER BY b.id DESC
            """)
            books = cursor.fetchall()
            print(f"Found {len(books)} books")  # Debug log
            
            # Convert books to list before returning
            book_list = []
            for book in books:
                try:
                    book_model = convert_db_book_to_model(book)
                    book_list.append(book_model)
                except Exception as book_error:
                    print(f"Error converting book {book['id']}: {str(book_error)}")
                    continue
            
            return {
                "books": book_list
            }
    except Exception as e:
        print(f"Error loading books: {str(e)}")
        print(f"Error type: {type(e)}")  # Debug log
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

@app.post("/submit-rating")
async def submit_rating(rating_data: Rating):
    """Submit a rating for a book."""
    try:
        with get_db() as db:
            db.execute("""
                INSERT INTO ratings (book_id, rating, timestamp)
                VALUES (?, ?, ?)
            """, (rating_data.book_id, rating_data.rating, rating_data.timestamp))
            db.commit()
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
            f.write(f"   Average Rating: {book.avg_rating:.1f}\n")
            f.write(f"   Topics: {', '.join(book.topics)}\n")
            f.write(f"   Description: {book.description}\n")
            f.write("\n")
        
        f.write("-"*80 + "\n\n")  # End of entry marker

@app.post("/get-recommendations")
async def get_recommendations(request: RecommendationRequest):
    """Get personalized book recommendations."""
    try:
        with get_db() as db:
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
            
            # Convert to Book models
            available_books = [convert_db_book_to_model(book) for book in all_books]
            
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
            
            # Get recommendations based on average rating
            recommendations = sorted(
                unrated_books,
                key=lambda x: x.avg_rating,
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