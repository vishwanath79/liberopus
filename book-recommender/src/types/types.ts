// Define TypeScript interfaces for our data models
export interface Book {
    id: string;
    title: string;
    author: string;
    categories: string[];
    technical_level: string;
    topics: string[];
    avg_rating: number;
    page_count: number;
    publication_year: number;
    description: string;
}

export interface Rating {
    book_id: string;
    rating: number;
    timestamp: string;
}

export interface RecommendationRequest {
    user_history: string[];
    user_ratings: { [key: string]: number };
}