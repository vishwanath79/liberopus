// API client for interacting with our FastAPI backend
import { Book, RecommendationRequest } from '../types/types';

const API_BASE_URL = 'http://localhost:8000';

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export const bookApi = {
    // Analyze a book's content
    analyzeBook: async (book: Omit<Book, 'id'>) => {
        const response = await fetch(`${API_BASE_URL}/analyze-book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(book),
        });
        return handleResponse(response);
    },

    // Find similar books
    findSimilar: async (bookId: string, numRecommendations: number = 5) => {
        const response = await fetch(`${API_BASE_URL}/find-similar?book_id=${bookId}&num_recommendations=${numRecommendations}`, {
            method: 'POST',
        });
        return handleResponse(response);
    },

    // Get personalized recommendations
    getRecommendations: async (request: RecommendationRequest) => {
        const response = await fetch(`${API_BASE_URL}/get-recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
        return handleResponse(response);
    },

    // Submit a book rating
    submitRating: async (bookId: string, rating: number) => {
        const response = await fetch(`${API_BASE_URL}/submit-rating`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                book_id: bookId,
                rating,
                timestamp: new Date().toISOString()
            }),
        });
        return handleResponse(response);
    },
};