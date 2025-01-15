from fastapi import FastAPI, HTTPException, Depends
from typing import List, Dict, Optional
from datetime import datetime
import uvicorn
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from models import Book, Rating
from database import get_db, DBBook, DBRating, BookCategory, BookTopic, init_db
from main import LlamaBookAnalyzer, SemanticMatcher, LlamaRecommender, BookSummarizer

app = FastAPI(
    title="Technical Book Recommendation API",
    description="API for analyzing and recommending technical books using LLM",
    version="1.0.0"
)

# Add startup event to initialize database
@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup"""
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response validation
class BookRequest(BaseModel):
    """Request model for book data"""
    title: str
    author: str
    categories: List[str]
    technical_level: str
    topics: List[str]
    description: str
    avg_rating: float
    page_count: int
    publication_year: int

class RatingRequest(BaseModel):
    """Request model for rating submission"""
    book_id: str
    rating: int

class RecommendationRequest(BaseModel):
    """Request model for getting recommendations"""
    user_history: List[str]  # List of book IDs
    user_ratings: Dict[str, int]  # book_id: rating

# Initialize our components
analyzer = LlamaBookAnalyzer()
matcher = SemanticMatcher()
recommender = LlamaRecommender()
summarizer = BookSummarizer()

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Technical Book Recommendation API",
        "version": "1.0.0",
        "endpoints": [
            "/analyze-book",
            "/find-similar",
            "/get-recommendations",
            "/summarize-book"
        ]
    }

def convert_db_book_to_model(db_book: DBBook) -> Book:
    """Convert database book model to Pydantic model"""
    return Book(
        id=db_book.id,
        title=db_book.title,
        author=db_book.author,
        categories=[cat.category for cat in db_book.categories],
        technical_level=db_book.technical_level,
        topics=[topic.topic for topic in db_book.topics],
        avg_rating=db_book.avg_rating,
        page_count=db_book.page_count,
        publication_year=db_book.publication_year,
        description=db_book.description
    )

@app.post("/analyze-book")
async def analyze_book(book: Book, db: Session = Depends(get_db)):
    """
    Analyze a book's content and store in database
    
    Args:
        book (Book): Book details including description
        
    Returns:
        dict: Analysis results including topics and difficulty level
    """
    try:
        # Analyze content
        analysis = analyzer.analyze_book_content(book.description)
        
        # Create database entry
        db_book = DBBook(
            id=book.id,
            title=book.title,
            author=book.author,
            technical_level=book.technical_level,
            avg_rating=book.avg_rating,
            page_count=book.page_count,
            publication_year=book.publication_year,
            description=book.description
        )
        
        # Add categories and topics
        for category in book.categories:
            db_book.categories.append(BookCategory(category=category))
        for topic in book.topics:
            db_book.topics.append(BookTopic(topic=topic))
            
        db.add(db_book)
        db.commit()
        
        return {"analysis": analysis, "stored_book": convert_db_book_to_model(db_book)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/find-similar")
async def find_similar_books(book_id: str, num_recommendations: int = 5, db: Session = Depends(get_db)):
    """
    Find similar books based on content similarity
    
    Args:
        book_id (str): ID of the reference book
        num_recommendations (int): Number of similar books to return
        
    Returns:
        List[Book]: List of similar books
    """
    try:
        # Get the reference book
        db_book = db.query(DBBook).filter(DBBook.id == book_id).first()
        if not db_book:
            raise HTTPException(status_code=404, detail="Book not found")
        
        # Get all available books
        all_books = db.query(DBBook).all()
        if len(all_books) <= 1:
            return {"similar_books": []}
            
        # Generate embeddings for all books
        book_texts = [
            f"Title: {book.title} Description: {book.description}"
            for book in all_books
        ]
        
        # Generate embedding for the query book
        query_embedding = matcher.generate_embeddings(
            f"Title: {db_book.title} Description: {db_book.description}"
        )
        
        # Generate embeddings for all books
        book_embeddings = [
            matcher.generate_embeddings(text)
            for text in book_texts
        ]
        
        # Find similar books
        similar_indices = matcher.find_similar_books(
            query_embedding, 
            book_embeddings,
            num_recommendations + 1  # Add 1 to account for the query book
        )
        
        # Filter out the query book and convert to response format
        similar_books = [
            convert_db_book_to_model(all_books[i])
            for i in similar_indices
            if all_books[i].id != book_id
        ][:num_recommendations]
        
        return {"similar_books": similar_books}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add-book")
async def add_book(book: BookRequest, db: Session = Depends(get_db)):
    """
    Add a new book to the database
    
    Args:
        book (BookRequest): Book details
        
    Returns:
        dict: Added book details
    """
    try:
        # Create database entry
        db_book = DBBook(
            id=f"book_{datetime.now().timestamp()}",  # Generate a unique ID
            title=book.title,
            author=book.author,
            technical_level=book.technical_level,
            avg_rating=book.avg_rating,
            page_count=book.page_count,
            publication_year=book.publication_year,
            description=book.description
        )
        
        # Add categories and topics
        for category in book.categories:
            db_book.categories.append(BookCategory(category=category))
        for topic in book.topics:
            db_book.topics.append(BookTopic(topic=topic))
            
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
        
        return {"message": "Book added successfully", "book": convert_db_book_to_model(db_book)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/books")
async def get_books(db: Session = Depends(get_db)):
    """
    Get all books in the database
    
    Returns:
        List[Book]: List of all books
    """
    try:
        books = db.query(DBBook).all()
        return {"books": [convert_db_book_to_model(book) for book in books]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-recommendations")
async def get_recommendations(request: RecommendationRequest, db: Session = Depends(get_db)):
    """
    Get personalized book recommendations
    
    Args:
        request (RecommendationRequest): User's reading history and ratings
        
    Returns:
        List[Book]: Recommended books
    """
    try:
        # Get all available books
        all_books = db.query(DBBook).all()
        if not all_books:
            return {"recommendations": []}
            
        # If no history, return some default recommendations
        if not request.user_history:
            default_books = all_books[:5]
            return {"recommendations": [convert_db_book_to_model(book) for book in default_books]}
            
        # Get user's rated books
        user_books = db.query(DBBook).filter(DBBook.id.in_(request.user_history)).all()
        
        # Get recommendations using the LlamaRecommender
        recommended_books = recommender.generate_recommendation(
            user_books=user_books,
            user_ratings=request.user_ratings,
            available_books=all_books
        )
        
        return {
            "recommendations": [
                convert_db_book_to_model(book) 
                for book in recommended_books
            ]
        }
    except Exception as e:
        # Return some default recommendations on error
        try:
            default_books = db.query(DBBook).limit(5).all()
            return {
                "recommendations": [
                    convert_db_book_to_model(book) 
                    for book in default_books
                ]
            }
        except:
            return {"recommendations": []}

@app.post("/submit-rating")
async def submit_rating(rating: Rating, db: Session = Depends(get_db)):
    """
    Submit a book rating
    
    Args:
        rating (Rating): Rating details
        
    Returns:
        dict: Confirmation message
    """
    try:
        # Check if book exists
        book = db.query(DBBook).filter(DBBook.id == rating.book_id).first()
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
            
        # Create rating
        db_rating = DBRating(
            book_id=rating.book_id,
            rating=rating.rating,
            timestamp=rating.timestamp
        )
        db.add(db_rating)
        
        # Update book's average rating
        all_ratings = [r.rating for r in book.ratings] + [rating.rating]
        book.avg_rating = sum(all_ratings) / len(all_ratings)
        
        db.commit()
        return {"message": "Rating submitted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 