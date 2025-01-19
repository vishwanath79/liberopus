import os
import google.generativeai as genai
from typing import List, Dict
from dotenv import load_dotenv
import hashlib
import json
import random
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

# Load environment variables
load_dotenv()

# Get API key
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
print(f"API Key loaded: {'Yes' if GOOGLE_API_KEY else 'No'}")
print(f"API Key length: {len(GOOGLE_API_KEY) if GOOGLE_API_KEY else 0}")

# Configure Google Generative AI if API key is available
if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        # Test the configuration
        model = genai.GenerativeModel("gemini-pro")
        response = model.generate_content("Test connection")
        print("Gemini API connection successful")
    except Exception as e:
        print(f"Error configuring Gemini API: {str(e)}")
else:
    print("Warning: GOOGLE_API_KEY not found in environment variables")

def generate_book_id(title: str, author: str) -> str:
    """Generate a stable book ID from title and author."""
    combined = (title + author).encode('utf-8')
    return hashlib.sha256(combined).hexdigest()[:16]

def format_book_history(books: List[Dict]) -> str:
    """Format book history into a readable string for the LLM."""
    formatted_text = "Books rated by the user:\n\n"
    for book in books:
        formatted_text += f"Title: {book['title']}\n"
        formatted_text += f"Author: {book['author']}\n"
        formatted_text += f"Rating: {book.get('rating', 0)}/5\n"
        formatted_text += f"Topics: {', '.join(book.get('topics', []))}\n\n"
    return formatted_text

def get_fallback_recommendations() -> List[Dict]:
    """Return a list of fallback recommendations when Gemini is not available."""
    fallback_books = [
        {
            "title": "Clean Code",
            "author": "Robert C. Martin",
            "explanation": "A fundamental guide to writing maintainable code",
            "technical_level": "Intermediate",
            "topics": ["Software Engineering", "Best Practices"]
        },
        {
            "title": "Design Patterns",
            "author": "Erich Gamma et al.",
            "explanation": "Essential patterns for software design",
            "technical_level": "Advanced",
            "topics": ["Software Design", "Architecture"]
        },
        {
            "title": "Python Crash Course",
            "author": "Eric Matthes",
            "explanation": "Comprehensive introduction to Python programming",
            "technical_level": "Beginner",
            "topics": ["Python", "Programming"]
        },
        {
            "title": "The Pragmatic Programmer",
            "author": "Andrew Hunt and David Thomas",
            "explanation": "Practical advice for software development",
            "technical_level": "Intermediate",
            "topics": ["Software Development", "Best Practices"]
        },
        {
            "title": "JavaScript: The Good Parts",
            "author": "Douglas Crockford",
            "explanation": "Focus on the best features of JavaScript",
            "technical_level": "Intermediate",
            "topics": ["JavaScript", "Web Development"]
        }
    ]
    return random.sample(fallback_books, min(5, len(fallback_books)))

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def generate_gemini_recommendations(book_history: List[Dict], num_recommendations: int = 5) -> List[Dict]:
    """Generate book recommendations using Gemini Pro with retries."""
    try:
        if not GOOGLE_API_KEY:
            print("No Google API key available, using fallback recommendations")
            return get_fallback_recommendations()

        # Format the book history
        history_text = format_book_history(book_history)
        print(f"Formatted history text: {history_text}")  # Debug log
        
        # Create the prompt
        prompt = f"""Based on the user's book ratings and preferences below, recommend {num_recommendations} technical books. 
        Focus on books that match their interests and technical level.
        For each recommendation, provide:
        1. Title
        2. Author
        3. Brief explanation of why it matches their interests
        4. Technical level (Beginner/Intermediate/Advanced)
        5. Main topics covered

        Format each recommendation in JSON structure.
        
        User's reading history:
        {history_text}
        
        Provide recommendations in the following format:
        [
            {{
                "title": "Book Title",
                "author": "Author Name",
                "explanation": "Why this book matches their interests",
                "technical_level": "Beginner/Intermediate/Advanced",
                "topics": ["Topic1", "Topic2"]
            }}
        ]
        """

        print(f"Sending prompt to Gemini: {prompt}")  # Debug log
        
        # Generate recommendations using Gemini with timeout
        model = genai.GenerativeModel("gemini-pro")
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, prompt),
            timeout=15  # 15 seconds timeout
        )
        print(f"Raw Gemini response: {response.text}")  # Debug log
        
        # Parse the response and convert to list of dictionaries
        recommendations = json.loads(response.text)
        print(f"Parsed recommendations: {recommendations}")  # Debug log
        
        if not recommendations:
            print("No recommendations from Gemini, using fallback")
            return get_fallback_recommendations()
            
        return recommendations
    except asyncio.TimeoutError:
        print("Gemini request timed out, retrying...")
        raise  # This will trigger a retry
    except json.JSONDecodeError as e:
        print(f"Error parsing Gemini response as JSON: {str(e)}")
        print(f"Raw response that failed to parse: {response.text}")
        print("Using fallback recommendations")
        return get_fallback_recommendations()
    except Exception as e:
        print(f"Error in generate_gemini_recommendations: {str(e)}")
        print("Using fallback recommendations")
        return get_fallback_recommendations()

async def get_personalized_recommendations(user_history: List[Dict], user_ratings: Dict[str, float], 
                                  num_recommendations: int = 5) -> List[Dict]:
    """
    Get personalized recommendations combining both ML-based and LLM-based approaches.
    """
    try:
        print(f"Starting recommendations with history: {user_history}")  # Debug log
        print(f"User ratings: {user_ratings}")  # Debug log
        
        # Format the book history for Gemini
        rated_books = []
        for book_id, rating in user_ratings.items():
            # Get book details from history
            book = next((b for b in user_history if b['id'] == book_id), None)
            if book:
                book_info = {
                    'title': book['title'],
                    'author': book['author'],
                    'rating': rating,
                    'topics': book.get('topics', [])
                }
                rated_books.append(book_info)
        
        print(f"Formatted rated books: {rated_books}")  # Debug log
        
        if not rated_books:
            print("No rated books found, using fallback recommendations")
            return get_fallback_recommendations()
        
        # Get LLM recommendations with retries
        llm_recommendations = await generate_gemini_recommendations(rated_books, num_recommendations)
        print(f"LLM recommendations received: {llm_recommendations}")  # Debug log
        
        # Convert recommendations to match our Book model format
        formatted_recommendations = []
        for rec in llm_recommendations:
            try:
                formatted_rec = {
                    'id': generate_book_id(rec['title'], rec['author']),
                    'title': rec['title'],
                    'author': rec['author'],
                    'description': rec.get('explanation', ''),
                    'topics': rec.get('topics', []),
                    'average_rating': 0.0,
                    'publication_year': None,
                    'page_count': None
                }
                formatted_recommendations.append(formatted_rec)
            except Exception as e:
                print(f"Error formatting recommendation {rec}: {str(e)}")
                continue
        
        print(f"Final formatted recommendations: {formatted_recommendations}")  # Debug log
        return formatted_recommendations
        
    except Exception as e:
        print(f"Error in get_personalized_recommendations: {str(e)}")
        print(f"User history: {user_history}")
        print(f"User ratings: {user_ratings}")
        return get_fallback_recommendations() 