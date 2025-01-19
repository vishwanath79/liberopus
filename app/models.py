from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Book(BaseModel):
    """Pydantic model for books"""
    id: str
    title: str
    author: str
    description: Optional[str] = None
    technical_level: Optional[str] = "intermediate"
    average_rating: Optional[float] = 0.0
    page_count: Optional[int] = None
    publication_year: Optional[int] = None
    topics: List[str] = ["General"]
    categories: List[str] = ["General"]
    rating_count: Optional[int] = 0

class Rating(BaseModel):
    """Pydantic model for book ratings"""
    id: Optional[int] = None
    book_id: str
    rating: int
    timestamp: str 