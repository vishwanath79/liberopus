'use client';

import { Book } from '../types/types';
import { useState } from 'react';

interface BookCardProps {
    book: Book;
    onRatingSubmit: (bookId: string, rating: number) => void;
    currentRating?: number;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onRatingSubmit, currentRating }) => {
    const [hoveredStar, setHoveredStar] = useState<number | null>(null);
    const [selectedRating, setSelectedRating] = useState<number | null>(currentRating || null);

    const handleStarClick = async (rating: number) => {
        setSelectedRating(rating);
        onRatingSubmit(book.id, rating);
    };

    const displayRating = hoveredStar || selectedRating || 0;

    return (
        <div className="bg-card rounded-lg shadow-lg overflow-hidden transition-transform hover:scale-[1.02]">
            <div className="p-6">
                <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-white mb-1">{book.title}</h3>
                    <p className="text-sm text-gray-400">by {book.author}</p>
                    {book.description && (
                        <p className="text-sm text-gray-300 mt-2 line-clamp-3">{book.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {book.topics.map((topic, index) => (
                            <span
                                key={index}
                                className="bg-indigo-900/30 text-indigo-300 text-xs px-2 py-1 rounded border border-indigo-800/50"
                            >
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>
                
                {/* Technical Level Badge */}
                <div className="mb-4">
                    {book.technical_level && (
                        <span className="bg-indigo-900/50 text-indigo-200 px-3 py-1 rounded-full text-sm">
                            {book.technical_level}
                        </span>
                    )}
                </div>
                
                {/* Rating */}
                <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                            key={rating}
                            className={`text-2xl transition-colors ${
                                rating <= displayRating
                                    ? 'text-yellow-400'
                                    : 'text-gray-600'
                            }`}
                            onMouseEnter={() => setHoveredStar(rating)}
                            onMouseLeave={() => setHoveredStar(null)}
                            onClick={() => handleStarClick(rating)}
                        >
                            ★
                        </button>
                    ))}
                    <span className="ml-2 text-sm text-gray-400">
                        {selectedRating ? 'Your rating' : 'Rate this book'}
                    </span>
                </div>
                
                {/* Average Rating */}
                <div className="mt-2 text-sm text-gray-400">
                    Average rating: {book.average_rating.toFixed(1)} ★
                </div>
            </div>
        </div>
    );
};