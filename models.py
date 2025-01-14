from typing import List
from datetime import datetime
from dataclasses import dataclass

@dataclass
class Book:
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
    
    Example:
        book = Book(
            id="1234",
            title="Python Programming",
            author="John Doe",
            categories=["Programming", "Computer Science"],
            technical_level="intermediate",
            topics=["Python", "Algorithms"],
            avg_rating=4.5,
            page_count=300,
            publication_year=2023,
            description="A comprehensive guide to Python programming..."
        )
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

@dataclass
class Rating:
    """
    Represents a user's rating of a book with timestamp.
    Used to track user preferences and build personalized recommendations.
    
    Attributes:
        book_id (str): ID of the rated book, corresponds to Book.id
        rating (int): User's rating on a scale of 1-5
                     1: Poor
                     2: Fair
                     3: Good
                     4: Very Good
                     5: Excellent
        timestamp (datetime): When the rating was submitted
    
    Example:
        rating = Rating(
            book_id="1234",
            rating=5,
            timestamp=datetime.now()
        )
    """
    book_id: str
    rating: int  # 1-5 scale
    timestamp: datetime

    def __post_init__(self):
        """
        Validates rating value after initialization.
        Ensures rating is within valid range of 1-5.
        
        Raises:
            ValueError: If rating is not between 1 and 5
        """
        if not 1 <= self.rating <= 5:
            raise ValueError("Rating must be between 1 and 5") 