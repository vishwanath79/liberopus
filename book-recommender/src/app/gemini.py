import google.generativeai as genai
from typing import List, Dict
import json

def get_gemini_recommendations(user_ratings: Dict[str, int], books_data: List[dict]) -> List[dict]:
    """Get book recommendations using Gemini AI"""
    
    # Configure Gemini
    genai.configure(api_key="AIzaSyAyThePUYfs0jVpeNynWlC164ZCZqDUa54")
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    # Create prompt based on user ratings
    liked_books = [
        book["title"] for book_id, rating in user_ratings.items()
        for book in books_data if book["id"] == book_id and rating >= 4
    ]
    
    prompt = f"""Based on these liked books: {', '.join(liked_books) if liked_books else 'No ratings yet'}
    Recommend 5 books from this list:
    {json.dumps([{'title': b['title'], 'author': b['author']} for b in books_data])}
    
    Return only the book titles that match exactly with the provided list, in JSON format like:
    {{"recommendations": ["title1", "title2", "title3", "title4", "title5"]}}
    """
    
    try:
        response = model.generate_content(prompt)
        recommendations_data = json.loads(response.text)
        
        # Match recommended titles with full book data
        recommended_books = [
            book for book in books_data 
            if book["title"] in recommendations_data["recommendations"]
        ]
        
        return recommended_books[:5]  # Limit to 5 recommendations
        
    except Exception as e:
        print(f"Error getting Gemini recommendations: {e}")
        return []