// API client for interacting with our FastAPI backend
import { Book, RecommendationRequest, Rating } from '../types/types';

// API configuration with environment variable support
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RatingsResponse {
    ratings: Rating[];
}

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export const bookApi = {
    // Get all books
    getBooks: async (): Promise<Book[]> => {
        try {
            const response = await fetch(`${API_BASE_URL}/books`);
            return handleResponse(response);
        } catch (error) {
            console.error('Error fetching books:', error);
            throw error;
        }
    },

    // Analyze a book's content
    analyzeBook: async (bookData: Partial<Book>) => {
        try {
            const response = await fetch(`${API_BASE_URL}/add-book`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookData)
            });
            return handleResponse(response);
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
    getRecommendations: async (data: RecommendationRequest) => {
        try {
            const response = await fetch(`${API_BASE_URL}/get-recommendations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            return handleResponse(response);
        } catch (error) {
            console.error('Error in getRecommendations:', error);
            throw error;
        }
    },

    // Submit a book rating
    submitRating: async (bookId: string, rating: number) => {
        try {
            const response = await fetch(`${API_BASE_URL}/ratings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    book_id: bookId,
                    rating: rating
                })
            });
            return handleResponse(response);
        } catch (error) {
            console.error('Error in submitRating:', error);
            throw error;
        }
    },

    // Get user ratings
    getRatings: async (): Promise<RatingsResponse> => {
        try {
            const response = await fetch(`${API_BASE_URL}/ratings`);
            return handleResponse(response);
        } catch (error) {
            console.error('Error fetching ratings:', error);
            throw error;
        }
    },

    // Get wishlist
    getWishlist: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/wishlist`);
            return handleResponse(response);
        } catch (error) {
            console.error('Error fetching wishlist:', error);
            throw error;
        }
    },

    // Add to wishlist
    addToWishlist: async (bookId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/wishlist/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ book_id: bookId })
            });
            return handleResponse(response);
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            throw error;
        }
    },

    // Remove from wishlist
    removeFromWishlist: async (bookId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/wishlist/remove/${bookId}`, {
                method: 'DELETE'
            });
            return handleResponse(response);
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            throw error;
        }
    },

    // Dismiss book
    dismissBook: async (bookId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/dismiss-book`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ book_id: bookId })
            });
            return handleResponse(response);
        } catch (error) {
            console.error('Error dismissing book:', error);
            throw error;
        }
    }
};

// Export the getBooks function directly for backward compatibility
export const fetchBooks = bookApi.getBooks;