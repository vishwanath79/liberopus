import os
import google.generativeai as genai
from typing import List, Dict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Google Generative AI
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

def format_book_history(books: List[Dict]) -> str:
    """Format book history into a readable string for the LLM."""
    formatted_text = "Books rated by the user:\n\n"
    for book in books:
        formatted_text += f"Title: {book['title']}\n"
        formatted_text += f"Author: {book['author']}\n"
        formatted_text += f"Rating: {book['rating']}/5\n"
        formatted_text += f"Categories: {', '.join(book['categories'])}\n"
        formatted_text += f"Topics: {', '.join(book['topics'])}\n\n"
    return formatted_text

def generate_gemini_recommendations(book_history: List[Dict], num_recommendations: int = 5) -> List[Dict]:
    """Generate book recommendations using Gemini Pro."""
    
    # Format the book history
    history_text = format_book_history(book_history)
    
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

    try:
        # Generate recommendations using Gemini
        model = genai.GenerativeModel("gemini-pro")
        response = model.generate_content(prompt)
        
        # Parse the response and convert to list of dictionaries
        # Note: Assuming the response is properly formatted JSON
        import json
        recommendations = json.loads(response.text)
        
        return recommendations
    except Exception as e:
        print(f"Error generating recommendations: {str(e)}")
        return []

def get_personalized_recommendations(user_history: List[Dict], user_ratings: Dict[str, float], 
                                  num_recommendations: int = 5) -> List[Dict]:
    """
    Get personalized recommendations combining both ML-based and LLM-based approaches.
    """
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
                'categories': book.get('categories', []),
                'topics': book.get('topics', [])
            }
            rated_books.append(book_info)
    
    # Get LLM recommendations
    llm_recommendations = generate_gemini_recommendations(rated_books, num_recommendations)
    
    return llm_recommendations 