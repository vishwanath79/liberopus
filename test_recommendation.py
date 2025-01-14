import json
from datetime import datetime
from models import Book, Rating
from main import LlamaBookAnalyzer, SemanticMatcher, LlamaRecommender, BookSummarizer

def test_book_analyzer():
    """
    Test the book analysis functionality using LlamaBookAnalyzer.
    This test verifies that the LLM can:
    1. Extract main technical topics
    2. Determine required experience level
    3. Identify key learning outcomes
    """
    print("\n=== Testing Book Analyzer ===")
    analyzer = LlamaBookAnalyzer()
    
    # Sample book description for testing
    # Using a well-known technical book to test topic extraction
    test_description = """
    'Python for Data Analysis' is a comprehensive guide to the Python programming 
    language for data analysis. The book covers pandas, NumPy, IPython, and Jupyter. 
    It's perfect for data scientists and analysts looking to master Python's data 
    analysis libraries. The book includes practical examples and real-world datasets.
    """
    
    try:
        # Attempt to analyze the book content
        result = analyzer.analyze_book_content(test_description)
        print("Book Analysis Result:")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error in book analysis: {str(e)}")

def test_semantic_matcher():
    """
    Test the semantic matching functionality.
    This test verifies that the system can:
    1. Generate embeddings for book descriptions
    2. Find similar books based on content
    3. Rank books by similarity
    """
    print("\n=== Testing Semantic Matcher ===")
    matcher = SemanticMatcher()
    
    # Test set of book descriptions with varying topics
    # Used to verify semantic similarity matching
    descriptions = [
        "Advanced Python Programming with focus on optimization",
        "Python basics for beginners",
        "Data Analysis with Python and Pandas",
        "Machine Learning with Python"
    ]
    
    try:
        # Generate embeddings for all test descriptions
        embeddings = [matcher.generate_embeddings(desc) for desc in descriptions]
        
        # Test query to find similar books
        query = "Python data science and analysis techniques"
        query_embedding = matcher.generate_embeddings(query)
        
        # Find and print similar books
        similar_indices = matcher.find_similar_books(query_embedding, embeddings)
        print("Most similar books to 'Python data science' query:")
        for idx in similar_indices:
            print(f"- {descriptions[idx]}")
    except Exception as e:
        print(f"Error in semantic matching: {str(e)}")

def test_recommender():
    """
    Test the recommendation functionality.
    This test verifies that the system can:
    1. Process user reading history
    2. Consider user ratings
    3. Generate personalized recommendations
    4. Account for technical progression
    """
    print("\n=== Testing Recommender ===")
    recommender = LlamaRecommender()
    
    # Create test books with varied technical levels and topics
    test_books = [
        Book(
            id="1",
            title="Python for Data Analysis",
            author="Wes McKinney",
            categories=["Programming", "Data Science"],
            technical_level="intermediate",
            topics=["Python", "Pandas", "NumPy"],
            avg_rating=4.5,
            page_count=400,
            publication_year=2022,
            description="Comprehensive guide to data analysis with Python"
        ),
        Book(
            id="2",
            title="Deep Learning with Python",
            author="François Chollet",
            categories=["Programming", "Machine Learning"],
            technical_level="advanced",
            topics=["Python", "Deep Learning", "Neural Networks"],
            avg_rating=4.7,
            page_count=500,
            publication_year=2021,
            description="Advanced guide to deep learning with Python"
        )
    ]
    
    # Simulate user ratings for test books
    test_ratings = {
        "1": 5,  # Loved Python for Data Analysis
        "2": 4   # Liked Deep Learning with Python
    }
    
    try:
        # Generate and print recommendations
        recommendations = recommender.generate_recommendation(test_books, test_ratings)
        print("Recommendations:")
        print(json.dumps(recommendations, indent=2))
    except Exception as e:
        print(f"Error in recommendations: {str(e)}")

def test_summarizer():
    """
    Test the book summarization functionality.
    This test verifies that the system can:
    1. Generate technical-focused summaries
    2. Extract key concepts
    3. Identify practical applications
    4. Highlight learning progression
    """
    print("\n=== Testing Summarizer ===")
    summarizer = BookSummarizer()
    
    # Test book with technical content
    test_book = Book(
        id="1",
        title="Practical Deep Learning for Cloud, Mobile, and Edge",
        author="Anirudh Koul",
        categories=["Programming", "Deep Learning"],
        technical_level="intermediate",
        topics=["Deep Learning", "Cloud Computing", "Mobile Development"],
        avg_rating=4.5,
        page_count=600,
        publication_year=2023,
        description="""
        Real-world guide to building and deploying deep learning applications. 
        Covers cloud platforms, mobile optimization, and edge computing. 
        Includes practical examples and deployment strategies.
        """
    )
    
    try:
        # Generate and print technical summary
        summary = summarizer.generate_technical_summary(test_book)
        print("Book Summary:")
        print(summary)
    except Exception as e:
        print(f"Error in summarization: {str(e)}")

if __name__ == "__main__":
    """
    Main test execution block.
    Runs all tests in sequence and reports results.
    """
    print("Starting Recommendation Engine Tests...")
    
    # Execute all test functions
    test_book_analyzer()
    test_semantic_matcher()
    test_recommender()
    test_summarizer()
    
    print("\nTests completed!")