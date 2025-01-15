from typing import List, Dict
import numpy as np
import ollama
from models import Book, Rating
from datetime import datetime
import json
from pydantic import BaseModel

MODEL_NAME = 'llama2:13b'  # Using llama2 13B model

class LlamaBookAnalyzer:
    """
    Analyzes technical books using Llama via Ollama to extract key information and insights.
    Handles the deep analysis of book content, technical requirements, and learning outcomes.
    """
    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name

    def analyze_book_content(self, description: str) -> dict:
        """
        Performs comprehensive analysis of book description using LLM.
        
        Args:
            description (str): Raw book description text
            
        Returns:
            dict: Analysis results containing topics, level, and outcomes
        """
        system_prompt = """You are a technical book analyzer. Analyze the given book description and extract:
        1. Main technical topics (list of strings)
        2. Required experience level (string: 'beginner', 'intermediate', or 'advanced')
        3. Key learning outcomes (list of strings)
        
        Format your response as a JSON object with these exact keys:
        {
            "topics": [],
            "level": "",
            "learning_outcomes": []
        }
        """
        
        try:
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
            
            # Parse the response as JSON
            result = json.loads(response['message']['content'])
            return result
        except Exception as e:
            print(f"Error analyzing book content: {e}")
            return {
                "topics": [],
                "level": "intermediate",
                "learning_outcomes": []
            }

class SemanticMatcher:
    """
    Handles semantic matching of books using Llama embeddings via Ollama.
    Enables finding similar books based on content and technical concepts.
    """
    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        
    def generate_embeddings(self, text: str) -> np.ndarray:
        """
        Generates vector embeddings for book descriptions using Ollama.
        
        Args:
            text (str): Book description or query text
            
        Returns:
            np.ndarray: Vector embedding representation
        """
        try:
            response = ollama.embeddings(model=self.model_name, prompt=text)
            return np.array(response['embedding'])
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            # Return a zero vector as fallback
            return np.zeros(4096)  # Llama2 embedding size
    
    def find_similar_books(self, query_embedding: np.ndarray, book_embeddings: List[np.ndarray], n_results: int = 5) -> List[int]:
        """
        Finds similar books using cosine similarity between embeddings.
        
        Args:
            query_embedding (np.ndarray): Embedding of query book
            book_embeddings (List[np.ndarray]): List of book embeddings to compare against
            n_results (int): Number of similar books to return
            
        Returns:
            List[int]: Indices of most similar books
        """
        try:
            # Normalize embeddings for cosine similarity
            query_norm = query_embedding / np.linalg.norm(query_embedding)
            book_norms = [emb / np.linalg.norm(emb) for emb in book_embeddings]
            
            # Calculate cosine similarities
            similarities = [np.dot(query_norm, book_norm) for book_norm in book_norms]
            
            # Get indices of top similar books
            return np.argsort(similarities)[-n_results:][::-1].tolist()
        except Exception as e:
            print(f"Error finding similar books: {e}")
            return list(range(min(n_results, len(book_embeddings))))

class LlamaRecommender:
    """
    Core recommendation engine using Llama for personalized book suggestions.
    Combines user history, ratings, and book content for intelligent recommendations.
    """
    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        self.matcher = SemanticMatcher(model_name)
        
    def generate_recommendation(self, user_books: List[Book], user_ratings: Dict[str, int], available_books: List[Book] = None) -> List[Book]:
        """
        Generates personalized book recommendations based on user history.
        
        Args:
            user_books (List[Book]): User's reading history
            user_ratings (Dict[str, int]): User's book ratings
            available_books (List[Book]): Pool of available books to recommend from
            
        Returns:
            List[Book]: Recommended books
        """
        try:
            if not user_books or not available_books:
                return available_books[:5] if available_books else []

            # Create a combined profile from highly rated books (rating >= 4)
            good_books = [book for book in user_books 
                         if user_ratings.get(book.id, 0) >= 4]
            
            if not good_books:
                return available_books[:5]

            # Generate embeddings for the user's profile
            profile_text = " ".join([
                f"Title: {book.title} Description: {book.description}"
                for book in good_books
            ])
            profile_embedding = self.matcher.generate_embeddings(profile_text)

            # Generate embeddings for available books
            book_embeddings = [
                self.matcher.generate_embeddings(
                    f"Title: {book.title} Description: {book.description}"
                )
                for book in available_books
            ]

            # Find similar books
            similar_indices = self.matcher.find_similar_books(
                profile_embedding, book_embeddings
            )

            # Return recommended books
            return [available_books[i] for i in similar_indices]
        except Exception as e:
            print(f"Error generating recommendations: {e}")
            return available_books[:5] if available_books else []

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