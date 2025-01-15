import requests
import json
from datetime import datetime

# Sample technical books with realistic data
SAMPLE_BOOKS = [
    {
        "title": "Python Machine Learning",
        "author": "Sebastian Raschka",
        "categories": ["Programming", "Machine Learning", "Data Science"],
        "technical_level": "intermediate",
        "topics": ["Python", "Machine Learning", "Neural Networks", "Scikit-learn"],
        "description": "A comprehensive guide to machine learning and deep learning with Python. Covers fundamental concepts to advanced topics including neural networks, deep learning, and practical implementations using scikit-learn and TensorFlow.",
        "avg_rating": 4.7,
        "page_count": 770,
        "publication_year": 2023
    },
    {
        "title": "Clean Code: A Handbook of Agile Software Craftsmanship",
        "author": "Robert C. Martin",
        "categories": ["Programming", "Software Engineering"],
        "technical_level": "intermediate",
        "topics": ["Code Quality", "Refactoring", "Design Patterns", "Best Practices"],
        "description": "Learn how to write clean, maintainable code that follows industry best practices. Covers naming conventions, functions, classes, and practical examples of code transformation from messy to clean.",
        "avg_rating": 4.8,
        "page_count": 464,
        "publication_year": 2008
    },
    {
        "title": "Full Stack Development with Next.js",
        "author": "Alexandra Moore",
        "categories": ["Web Development", "JavaScript"],
        "technical_level": "intermediate",
        "topics": ["Next.js", "React", "TypeScript", "Node.js", "API Development"],
        "description": "Master modern web development with Next.js 13. Build scalable, production-ready applications with React, TypeScript, and server-side rendering. Includes real-world projects and deployment strategies.",
        "avg_rating": 4.6,
        "page_count": 550,
        "publication_year": 2024
    },
    {
        "title": "System Design Interview",
        "author": "Alex Xu",
        "categories": ["Software Engineering", "System Design"],
        "technical_level": "advanced",
        "topics": ["Distributed Systems", "Scalability", "System Architecture", "Database Design"],
        "description": "An insider's guide to system design interviews. Learn how to design large-scale distributed systems step by step. Includes real-world examples from top tech companies and practical system design patterns.",
        "avg_rating": 4.9,
        "page_count": 436,
        "publication_year": 2022
    },
    {
        "title": "Rust Programming: From Basics to Advanced",
        "author": "David Thompson",
        "categories": ["Programming", "Systems Programming"],
        "technical_level": "beginner",
        "topics": ["Rust", "Memory Safety", "Concurrency", "Systems Programming"],
        "description": "Start your journey with Rust programming language from basic syntax to advanced concepts. Learn about ownership, borrowing, lifetimes, and how to build safe and concurrent applications.",
        "avg_rating": 4.5,
        "page_count": 480,
        "publication_year": 2023
    },
    {
        "title": "Data Structures and Algorithms in Python",
        "author": "Michael T. Goodrich",
        "categories": ["Programming", "Computer Science", "Algorithms"],
        "technical_level": "intermediate",
        "topics": ["Python", "Data Structures", "Algorithms", "Problem Solving"],
        "description": "A comprehensive introduction to data structures and algorithms using Python. Covers fundamental data structures, algorithm analysis, sorting, searching, and graph algorithms with practical implementations.",
        "avg_rating": 4.7,
        "page_count": 720,
        "publication_year": 2023
    }
]

def add_books():
    """Add sample books to the database via API"""
    api_url = "http://localhost:8000/add-book"
    success_count = 0
    
    print("Adding sample books to the database...")
    
    for book in SAMPLE_BOOKS:
        try:
            response = requests.post(api_url, json=book)
            if response.status_code == 200:
                success_count += 1
                print(f"✓ Added: {book['title']}")
            else:
                print(f"✗ Failed to add {book['title']}: {response.text}")
        except Exception as e:
            print(f"✗ Error adding {book['title']}: {str(e)}")
    
    print(f"\nSuccessfully added {success_count} out of {len(SAMPLE_BOOKS)} books.")

if __name__ == "__main__":
    add_books() 