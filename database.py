from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import os

# Database URL - Using SQLite for development
DB_PATH = os.path.join(os.path.expanduser("~"), "books.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

print(f"Using database at: {DB_PATH}")  # Debug print

# Create SQLAlchemy engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Database Models
class DBBook(Base):
    """SQLAlchemy model for books"""
    __tablename__ = "books"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, index=True)
    author = Column(String, index=True)
    technical_level = Column(String)
    avg_rating = Column(Float)
    page_count = Column(Integer)
    publication_year = Column(Integer)
    description = Column(String)
    
    # Relationships
    categories = relationship("BookCategory", back_populates="book")
    topics = relationship("BookTopic", back_populates="book")
    ratings = relationship("DBRating", back_populates="book")

class BookCategory(Base):
    """SQLAlchemy model for book categories"""
    __tablename__ = "book_categories"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(String, ForeignKey("books.id"))
    category = Column(String)
    
    book = relationship("DBBook", back_populates="categories")

class BookTopic(Base):
    """SQLAlchemy model for book topics"""
    __tablename__ = "book_topics"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(String, ForeignKey("books.id"))
    topic = Column(String)
    
    book = relationship("DBBook", back_populates="topics")

class DBRating(Base):
    """SQLAlchemy model for book ratings"""
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(String, ForeignKey("books.id"))
    rating = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    book = relationship("DBBook", back_populates="ratings")

# Create database tables
def init_db():
    Base.metadata.create_all(bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 