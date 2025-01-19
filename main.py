from typing import List, Dict, Optional
import numpy as np
import google.generativeai as genai
from models import Book, Rating
from datetime import datetime
import json
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from database import get_db, init_db
import os

# Configure Gemini
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
MODEL = genai.GenerativeModel('gemini-1.5-pro')

# Create FastAPI app instance
app = FastAPI(title="Book Recommender API")

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()



def convert_db_book_to_model(book_row) -> Book:
    """Convert a database row to a Book model."""
    return Book(
        id=str(book_row["id"]),
        title=book_row["title"],
        author=book_row["author"],
        description=book_row["description"],
        technical_level=book_row["technical_level"],
        average_rating=float(book_row["average_rating"]) if "average_rating" in book_row else 0.0,
        rating_count=int(book_row["rating_count"]) if "rating_count" in book_row else 0,
        page_count=book_row["page_count"],
        publication_year=book_row["publication_year"],
        topics=["General"],
        categories=["General"]
    )

# API Routes
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
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.id) as rating_count
                FROM books b
                LEFT JOIN ratings r ON b.id = r.book_id
                GROUP BY b.id
                ORDER BY b.id DESC
            """)
            books = cursor.fetchall()
            
            # Convert SQLite Row objects to Book models
            return {
                "books": [convert_db_book_to_model(book) for book in books]
            }
    except Exception as e:
        print(f"Error loading books: {str(e)}")  # Add logging
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/remove-duplicates")
async def remove_duplicates():
    """Remove duplicate books from the database based on title and author."""
    try:
        # Get all books
        with get_db() as db:
            # Get all books
            cursor = db.execute("""
                SELECT id, title, author 
                FROM books 
                ORDER BY id
            """)
            all_books = cursor.fetchall()
            
            # Create a dictionary to track unique books
            unique_books = {}
            duplicates = []
            
            # Find duplicates
            for book in all_books:
                key = (book[1].lower().strip(), book[2].lower().strip())  # title, author
                if key in unique_books:
                    # This is a duplicate - keep the one with lower ID
                    original_id = unique_books[key]
                    duplicate_id = book[0]
                    duplicates.append({
                        'duplicate_id': duplicate_id,
                        'original_id': original_id
                    })
                else:
                    unique_books[key] = book[0]  # id
            
            # Update ratings to point to original books
            for dup in duplicates:
                db.execute("""
                    UPDATE ratings 
                    SET book_id = ? 
                    WHERE book_id = ?
                """, (dup['original_id'], dup['duplicate_id']))
                
                # Delete duplicate book
                db.execute("DELETE FROM books WHERE id = ?", (dup['duplicate_id'],))
            
            db.commit()
            
            return {
                "message": f"Removed {len(duplicates)} duplicate books",
                "duplicates_removed": len(duplicates)
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove duplicates: {str(e)}")

class RecommendationEngine:
    """Book recommendation engine using Gemini for content analysis and recommendations."""
    
    def __init__(self):
        self.model = MODEL
    
    def analyze_book_content(self, book: Book) -> str:
        """Analyze book content using Gemini."""
        try:
            prompt = f"""
            Analyze this book and extract key topics and themes:
            Title: {book.title}
            Author: {book.author}
            Description: {book.description}
            
            Return your analysis as a JSON string with these keys:
            - topics: list of main topics
            - themes: list of major themes
            - target_audience: string describing ideal reader
            """
            
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Error analyzing book: {str(e)}")
            return json.dumps({
                "topics": ["General"],
                "themes": ["General"],
                "target_audience": "General readers"
            })
    
    def get_recommendations(self, user_books: List[Book], available_books: List[Book], user_ratings: Dict[str, int], num_recommendations: int = 5) -> List[Book]:
        """Get book recommendations using Gemini."""
        try:
            # Filter out books the user has already rated
            unrated_books = [book for book in available_books if str(book.id) not in user_ratings]
            
            if not unrated_books:
                return []
            
            # Get highly rated books (rating >= 4)
            liked_books = [book for book in user_books if user_ratings.get(str(book.id), 0) >= 4]
            
            if not liked_books:
                # If no highly rated books, return top rated unread books
                return sorted(unrated_books, key=lambda x: x.average_rating, reverse=True)[:num_recommendations]
            
            # Create prompt for Gemini
            prompt = f"""
            Based on these books the user likes:
            {', '.join([f"'{book.title}' by {book.author}" for book in liked_books])}
            
            Rank these unread books from most to least recommended (return just the numbers in order):
            {', '.join([f"{i+1}. '{book.title}' by {book.author}" for i, book in enumerate(unrated_books)])}
            
            Return only the numbers in order, separated by commas.
            """
            
            response = self.model.generate_content(prompt)
            rankings = [int(x.strip()) for x in response.text.split(',')]
            
            # Sort books based on Gemini's rankings
            recommended_books = []
            for rank in rankings[:num_recommendations]:
                recommended_books.append(unrated_books[rank-1])
            
            return recommended_books
            
        except Exception as e:
            print(f"Error getting recommendations: {str(e)}")
            # Fallback to rating-based recommendations
            return sorted(unrated_books, key=lambda x: x.avg_rating, reverse=True)[:num_recommendations]

# Initialize recommendation engine
recommender = RecommendationEngine()

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
            
            # Get recommendations using Gemini
            recommendations = recommender.get_recommendations(
                user_books=rated_books,
                available_books=available_books,
                user_ratings=request.user_ratings
            )
            
            return {"recommendations": recommendations}
            
    except Exception as e:
        print(f"Error getting recommendations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get recommendations: {str(e)}"
        )

class BookSummarizer:
    """
    Generates technical-focused summaries of books using Llama via Ollama.
    Emphasizes technical concepts and practical applications.
    """
    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        
    def generate_technical_summary(self, book: Book) -> str:
        """
        Creates a technical-focused summary of a book.
        
        Args:
            book (Book): Book object containing metadata and description
            
        Returns:
            str: Technical summary highlighting key concepts
        """
        system_prompt = """You are a technical book summarizer. Create a concise summary focusing on:
        1. Key technical concepts
        2. Practical applications
        3. Prerequisites and target audience
        4. Learning progression
        
        Keep the summary technical and focused on what the reader will learn.
        Format your response as a JSON object with these exact keys:
        {
            "summary": "",
            "key_concepts": [],
            "prerequisites": [],
            "target_audience": ""
        }
        """
        
        try:
            book_content = f"""
        Title: {book.title}
        Author: {book.author}
            Technical Level: {book.technical_level}
            Topics: {', '.join(book.topics)}
        Description: {book.description}
        """
        
        response = ollama.chat(model=self.model_name, messages=[
            {
                'role': 'system',
                'content': system_prompt
            },
            {
                'role': 'user',
                    'content': book_content
                }
            ])
            
            # Parse the response as JSON
            result = json.loads(response['message']['content'])
            return result
        except Exception as e:
            print(f"Error generating summary: {e}")
            return {
                "summary": book.description,
                "key_concepts": book.topics,
                "prerequisites": [],
                "target_audience": book.technical_level
            }

# Add test data function
def add_test_book():
    """Add a test book to the database."""
    try:
        with get_db() as db:
            db.execute("""
                INSERT OR IGNORE INTO books (
                    title, author, description, technical_level, 
                    page_count, publication_year
                ) VALUES (
                    'Python Deep Learning', 
                    'John Smith',
                    'A comprehensive guide to deep learning with Python, covering neural networks, TensorFlow, and PyTorch.',
                    'intermediate',
                    400,
                    2023
                )
            """)
            db.commit()
    except Exception as e:
        print(f"Error adding test book: {str(e)}")

# Add test book route
@app.get("/add-test-book")
async def create_test_book():
    """Add a test book to the database."""
    try:
        add_test_book()
        return {"message": "Test book added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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