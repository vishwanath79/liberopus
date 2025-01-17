// API client for interacting with our FastAPI backend
import { Book, RecommendationRequest, Rating } from '../types/types';

// API configuration with environment variable support
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

interface BookRequest {
    title: string;
    author: string;
    categories: string[];
    technical_level: string;
    topics: string[];
    description: string;
    avg_rating: number;
    page_count: number;
    publication_year: number;
}

export const bookApi = {
    // Analyze a book's content
    analyzeBook: async (bookData: BookRequest) => {
        try {
            const response = await fetch('http://localhost:8000/add-book', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to add book');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error in analyzeBook:', error);
            throw error;
        }
    },

    // Find similar books
    findSimilar: async (bookId: string, numRecommendations: number = 5) => {
        const response = await fetch(`${API_BASE_URL}/find-similar?book_id=${bookId}&num_recommendations=${numRecommendations}`, {
            method: 'POST',
        });
        return handleResponse(response);
    },

    // Get personalized recommendations
    getRecommendations: async (data: { user_history: string[], user_ratings: { [key: string]: number } }) => {
        try {
            const response = await fetch('http://localhost:8000/get-recommendations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get recommendations');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error in getRecommendations:', error);
            throw error;
        }
    },

    // Submit a book rating
    submitRating: async (bookId: string, rating: number) => {
        try {
            const response = await fetch('http://localhost:8000/submit-rating', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    book_id: bookId,
                    rating: rating,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to submit rating');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error in submitRating:', error);
            throw error;
        }
    },
};

export const fetchBooks = async (): Promise<Book[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/books`);
        if (!response.ok) {
            throw new Error('Failed to fetch books');
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching books:', error);
        throw error;
    }
};