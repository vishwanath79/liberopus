export interface Book {
    id: string;
    title: string;
    author: string;
    description: string;
    average_rating: number;
    topics: string[];
    publication_year?: number;
    page_count?: number;
}

export interface Rating {
    book_id: string;
    rating: number;
    timestamp: string;
}

export interface DBRating {
    id: number;
    book_id: string;
    rating: number;
    timestamp: string;
}

export interface WishlistItem extends Book {
    notes?: string;
    added_at: string;
    display_order: number;
}

export interface RecommendationRequest {
    user_history: string[];
    user_ratings: { [key: string]: number };
}