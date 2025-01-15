from typing import List
from datetime import datetime
from pydantic import BaseModel

class Book(BaseModel):
    """
    Represents a book with its metadata and technical details.
    This class is used throughout the recommendation system to store and manage book information.
    
    Attributes:
        id (str): Unique identifier for the book
        title (str): Book title
        author (str): Book author name
        categories (List[str]): List of categories/genres the book belongs to
        technical_level (str): Indicates difficulty level (beginner/intermediate/advanced)
        topics (List[str]): Specific technical topics covered in the book
        avg_rating (float): Average rating from all readers (0.0 to 5.0)
        page_count (int): Total number of pages
        publication_year (int): Year the book was published
        description (str): Full book description/summary
    """
    id: str
    title: str
    author: str
    categories: List[str]
    technical_level: str  # beginner/intermediate/advanced
    topics: List[str]
    avg_rating: float
    page_count: int
    publication_year: int
    description: str

class Rating(BaseModel):
    """
    Represents a user's rating of a book with timestamp.
    """
    book_id: str
    rating: int  # 1-5 scale
    timestamp: datetime 