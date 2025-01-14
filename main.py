from typing import List, Dict
import numpy as np
import ollama
from models import Book, Rating
from datetime import datetime

model_name = 'llama3.2'

class LlamaBookAnalyzer:
    """
    Analyzes technical books using Llama via Ollama to extract key information and insights.
    Handles the deep analysis of book content, technical requirements, and learning outcomes.
    """
    def __init__(self, model_name: str = model_name):
        # Initialize Ollama connection
        self.model_name = model_name

    def analyze_book_content(self, description: str) -> dict:
        """
        Performs comprehensive analysis of book description using LLM.
        
        Args:
            description (str): Raw book description text
            
        Returns:
            dict: Analysis results containing topics, level, and outcomes
        """
        system_prompt = """
        You are a technical book analyzer. Analyze the given book description and provide:
        1. Main technical topics
        2. Required experience level
        3. Key learning outcomes
        Format the response as JSON.
        """
        
        response = ollama.chat(model=self.model_name, messages=[
            {
                'role': 'system',
                'content': system_prompt
            },
            {
                'role': 'user',
                'content': description
            }
        ])
        return response['message']['content']

class SemanticMatcher:
    """
    Handles semantic matching of books using Llama embeddings via Ollama.
    Enables finding similar books based on content and technical concepts.
    """
    def __init__(self, model_name: str = model_name):
        self.model_name = model_name
        
    def generate_embeddings(self, text: str) -> np.array:
        """
        Generates vector embeddings for book descriptions using Ollama.
        
        Args:
            text (str): Book description or query text
            
        Returns:
            np.array: Vector embedding representation
        """
        response = ollama.embeddings(model=self.model_name, prompt=text)
        return np.array(response['embeddings'])
    
    def find_similar_books(self, query_embedding: np.array, book_embeddings: List[np.array], n_results: int = 5):
        """
        Finds similar books using embedding similarity scores.
        
        Args:
            query_embedding (np.array): Embedding of query book
            book_embeddings (List[np.array]): List of book embeddings to compare against
            n_results (int): Number of similar books to return
            
        Returns:
            List[int]: Indices of most similar books
        """
        similarities = [np.dot(query_embedding, book_emb) for book_emb in book_embeddings]
        return np.argsort(similarities)[-n_results:][::-1]

class LlamaRecommender:
    """
    Core recommendation engine using Llama for personalized book suggestions.
    Combines user history, ratings, and book content for intelligent recommendations.
    """
    def __init__(self, model_name: str = model_name):
        self.model_name = model_name
        
    def generate_recommendation(self, user_history: List[Book], user_ratings: Dict[str, int]) -> List[Book]:
        """
        Generates personalized book recommendations based on user history.
        
        Args:
            user_history (List[Book]): User's reading history
            user_ratings (Dict[str, int]): User's book ratings
            
        Returns:
            List[Book]: Recommended books
        """
        system_prompt = """
        You are a technical book recommendation system. Based on the user's reading history 
        and ratings, suggest similar technical books. Focus on technical progression and 
        learning path. Format recommendations as JSON.
        """
        
        user_content = f"""
        Reading History: {[book.title for book in user_history]}
        Ratings: {user_ratings}
        """
        
        response = ollama.chat(model=self.model_name, messages=[
            {
                'role': 'system',
                'content': system_prompt
            },
            {
                'role': 'user',
                'content': user_content
            }
        ])
        return response['message']['content']

class BookSummarizer:
    """
    Generates technical-focused summaries of books using Llama via Ollama.
    Emphasizes technical concepts and practical applications.
    """
    def __init__(self, model_name: str = model_name):
        self.model_name = model_name
        
    def generate_technical_summary(self, book: Book) -> str:
        """
        Creates a technical-focused summary of a book.
        
        Args:
            book (Book): Book object containing metadata and description
            
        Returns:
            str: Technical summary highlighting key concepts
        """
        system_prompt = """
        You are a technical book summarizer. Create a concise summary focusing on:
        1. Key technical concepts
        2. Practical applications
        3. Code examples if any
        4. Learning progression
        Make it relevant for technical readers.
        """
        
        user_content = f"""
        Title: {book.title}
        Author: {book.author}
        Description: {book.description}
        Technical Level: {book.technical_level}
        Topics: {book.topics}
        """
        
        response = ollama.chat(model=self.model_name, messages=[
            {
                'role': 'system',
                'content': system_prompt
            },
            {
                'role': 'user',
                'content': user_content
            }
        ])
        return response['message']['content']

# Data Models
class Book:
    """
    Represents a book with its metadata and technical details.
    """
    def __init__(self, 
                 id: str,
                 title: str,
                 author: str,
                 categories: List[str],
                 technical_level: str,
                 topics: List[str],
                 avg_rating: float,
                 page_count: int,
                 publication_year: int,
                 description: str):
        self.id = id
        self.title = title
        self.author = author
        self.categories = categories
        self.technical_level = technical_level  # beginner/intermediate/advanced
        self.topics = topics
        self.avg_rating = avg_rating
        self.page_count = page_count
        self.publication_year = publication_year
        self.description = description

class Rating:
    """
    Represents a user's rating of a book with timestamp.
    """
    def __init__(self,
                 book_id: str,
                 rating: int,
                 timestamp: datetime):
        self.book_id = book_id
        self.rating = rating  # 1-5 scale
        self.timestamp = timestamp