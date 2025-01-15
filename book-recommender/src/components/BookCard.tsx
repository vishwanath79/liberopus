'use client';

import { Book } from '../types/types';
import { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';

interface BookCardProps {
    book: Book;
    onRatingSubmit?: (bookId: string, rating: number) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onRatingSubmit }) => {
    const [rating, setRating] = useState<number>(0);
    const [hoveredRating, setHoveredRating] = useState<number>(0);

    const handleRatingClick = (selectedRating: number) => {
        setRating(selectedRating);
        onRatingSubmit?.(book.id, selectedRating);
    };

    return (
        <div className="bg-card rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
            <div className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-semibold mb-2 text-foreground">{book.title}</h3>
                        <p className="text-gray-400 mb-2">by {book.author}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {book.technical_level}
                    </span>
                </div>
                
                <div className="mt-4 space-y-4">
                    {/* Topics */}
                    <div className="flex flex-wrap gap-2">
                        {book.topics.map((topic, index) => (
                            <span
                                key={index}
                                className="inline-block px-2 py-1 rounded-md text-xs bg-background text-gray-300"
                            >
                                {topic}
                            </span>
                        ))}
                    </div>

                    {/* Description */}
                    <p className="text-gray-300 text-sm line-clamp-3">{book.description}</p>

                    {/* Book Details */}
                    <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>{book.page_count} pages</span>
                        <span>{book.publication_year}</span>
                    </div>

                    {/* Rating */}
                    <div className="pt-4 border-t border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => handleRatingClick(star)}
                                        onMouseEnter={() => setHoveredRating(star)}
                                        onMouseLeave={() => setHoveredRating(0)}
                                        className="focus:outline-none"
                                    >
                                        <StarIcon
                                            className={`h-6 w-6 transition-colors ${
                                                star <= (hoveredRating || rating)
                                                    ? 'text-yellow-400'
                                                    : 'text-gray-600'
                                            }`}
                                        />
                                    </button>
                                ))}
                            </div>
                            <span className="text-sm text-gray-400">
                                {book.avg_rating.toFixed(1)} avg
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};