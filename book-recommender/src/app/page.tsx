'use client';

import { useState, useMemo, useEffect } from 'react';
import { Book } from '../types/types';
import { Footer } from '../components/Footer';
import { CategoryFilter } from '../components/CategoryFilter';

interface DBRating {
    id: number;
    book_id: string;
    rating: number;
    timestamp: string;
}

export default function Home() {
    const [books, setBooks] = useState<Book[]>([]);
    const [recommendations, setRecommendations] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userRatings, setUserRatings] = useState<{[key: string]: number}>({});
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [dismissedBooks, setDismissedBooks] = useState<Set<string>>(new Set());

    // Initialize data loading
    useEffect(() => {
        const initializeData = async () => {
            await Promise.all([
                loadBooks(),
                loadUserRatings()
            ]);
        };
        initializeData();
    }, []);

    // Load books from API
    const loadBooks = async () => {
        try {
            const response = await fetch('http://localhost:8000/books');
            const data = await response.json();
            setBooks(Array.isArray(data) ? data : []);
            setError(null);
        } catch (error) {
            console.error('Failed to load books:', error);
            setError('Failed to load books. Please try again later.');
            setBooks([]);
        } finally {
            setLoading(false);
        }
    };

    // Load user ratings from API
    const loadUserRatings = async () => {
        try {
            const response = await fetch('http://localhost:8000/ratings');
            if (!response.ok) {
                throw new Error('Failed to load user ratings');
            }
            const data = await response.json();
            const ratings = data.ratings.reduce((acc: {[key: string]: number}, rating: DBRating) => {
                acc[rating.book_id] = rating.rating;
                return acc;
            }, {});
            setUserRatings(ratings);
            
            // Load recommendations if we have ratings
            if (Object.keys(ratings).length > 0) {
                await loadRecommendations();
            }
        } catch (error) {
            console.error('Failed to load user ratings:', error);
        }
    };

    // Load recommendations from API
    const loadRecommendations = async () => {
        try {
            const response = await fetch('http://localhost:8000/get-recommendations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_history: Object.keys(userRatings),
                    user_ratings: userRatings
                }),
            });
            const data = await response.json();
            setRecommendations(data.recommendations || []);
        } catch (error) {
            console.error('Failed to load recommendations:', error);
            setRecommendations([]);
        }
    };

    // Handle book rating submission
    const handleRatingSubmit = async (bookId: string, rating: number) => {
        try {
            console.log('Submitting rating:', { bookId, rating }); // Debug log
            const response = await fetch('http://localhost:8000/ratings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ book_id: bookId, rating }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Rating submission failed:', errorData); // Debug log
                throw new Error(`Failed to submit rating: ${errorData.detail}`);
            }

            // Update local state
            setUserRatings(prev => ({ ...prev, [bookId]: rating }));
            
            // Load new recommendations
            await loadRecommendations();
        } catch (error) {
            console.error('Failed to submit rating:', error);
            setError('Failed to submit rating. Please try again.');
        }
    };

    // Handle dismissing a book
    const handleDismissBook = async (bookId: string) => {
        try {
            const response = await fetch('http://localhost:8000/dismiss-book', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ book_id: bookId }),
            });

            if (!response.ok) {
                throw new Error('Failed to dismiss book');
            }

            // Update local state
            setDismissedBooks(prev => new Set([...prev, bookId]));
            
            // Remove the book from recommendations
            setRecommendations(prev => prev.filter(book => book.id !== bookId));
            
            // Load new recommendations
            await loadRecommendations();
        } catch (error) {
            console.error('Error dismissing book:', error);
            setError('Failed to dismiss book');
        }
    };

    // Handle category changes
    const handleCategoryChange = (categories: string[]) => {
        console.log('Selected categories:', categories);
        setSelectedCategories(categories);
    };

    // Filter books based on selected categories
    const filteredBooks = useMemo(() => {
        let filtered = books.filter(book => !dismissedBooks.has(book.id));
        if (selectedCategories.length > 0) {
            filtered = filtered.filter(book =>
                book.topics?.some(topic =>
                    selectedCategories.some(category =>
                        topic.toLowerCase() === category.toLowerCase()
                    )
                )
            );
        }
        return filtered;
    }, [books, dismissedBooks, selectedCategories]);

    // Filter recommendations based on selected categories
    const filteredRecommendations = useMemo(() => {
        let filtered = recommendations.filter(book => !dismissedBooks.has(book.id));
        if (selectedCategories.length > 0) {
            filtered = filtered.filter(book =>
                book.topics?.some(topic =>
                    selectedCategories.some(category =>
                        topic.toLowerCase() === category.toLowerCase()
                    )
                )
            );
        }
        return filtered;
    }, [recommendations, dismissedBooks, selectedCategories]);

    interface BookCardProps {
        book: Book;
        showRating?: boolean;
        onRatingSubmit?: (bookId: string, rating: number) => Promise<void>;
        currentRating?: number;
    }

    const BookCard = ({ book, showRating = true, onRatingSubmit, currentRating = 0 }: BookCardProps) => (
        <div className="bg-slate-800/50 rounded-lg shadow-lg p-6 mb-4 border border-slate-700/50 hover:border-indigo-500/50 transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-semibold mb-2 text-white">{book.title}</h3>
                    <p className="text-gray-400 mb-2">by {book.author}</p>
                </div>
                <button
                    onClick={() => handleDismissBook(book.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Dismiss book"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            {showRating && onRatingSubmit && (
                <div className="flex items-center mb-2">
                    <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => onRatingSubmit(book.id, star)}
                                className={`text-2xl ${
                                    star <= currentRating ? 'text-yellow-400' : 'text-gray-600'
                                }`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                    <span className="text-gray-400 ml-2">
                        ({book.average_rating.toFixed(1)})
                    </span>
                </div>
            )}
            <p className="text-gray-300 mb-2">{book.description}</p>
            <div className="flex flex-wrap gap-2">
                {book.topics.map((topic: string, index: number) => (
                    <span
                        key={index}
                        className="bg-indigo-900/30 text-indigo-300 text-sm px-2 py-1 rounded border border-indigo-800/50"
                    >
                        {topic}
                    </span>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="hero-gradient">
                <div className="max-w-7xl mx-auto py-20 px-4 text-center relative">
                    <h1 className="text-5xl font-bold mb-6">
                        <span className="gradient-text">LIBER OPUS</span>
                    </h1>
                    <p className="text-xl text-gray-300 mb-8">
                        Discover and rate books. Get personalized recommendations based on your interests.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-12 px-4">
                {/* Status Messages */}
                {error && (
                    <div className="bg-red-900/50 text-red-200 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {/* Category Filter */}
                <div className="mb-8">
                    <CategoryFilter 
                        onCategoriesChange={handleCategoryChange}
                        categories={["Technical", "Non-Technical"]}
                        selectedCategories={selectedCategories}
                    />
                </div>

                {/* Recommendations Section */}
                <section className="mb-16 bg-indigo-900/30 rounded-lg p-8">
                    <h2 className="text-3xl font-bold mb-8">
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 text-transparent bg-clip-text">
                            Recommended for You
                        </span>
                        <span className="text-lg font-normal text-gray-400 ml-4">
                            {Object.keys(userRatings).length > 0 
                                ? `Based on ${Object.keys(userRatings).length} rated books`
                                : 'Rate some books to get personalized recommendations'}
                        </span>
                    </h2>
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">Loading recommendations...</div>
                    ) : filteredRecommendations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredRecommendations.map((book) => (
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    onRatingSubmit={handleRatingSubmit}
                                    currentRating={userRatings[book.id] || 0}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-400">
                            {Object.keys(userRatings).length > 0 
                                ? 'No recommendations available at the moment.'
                                : 'Start rating books to get personalized recommendations!'}
                        </div>
                    )}
                </section>

                {/* All Books Section */}
                <section>
                    <h2 className="text-3xl font-bold mb-8 text-white">All Books</h2>
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">Loading books...</div>
                    ) : filteredBooks.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredBooks.map((book) => (
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    onRatingSubmit={handleRatingSubmit}
                                    currentRating={userRatings[book.id] || 0}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-400">
                            No books found matching the selected categories.
                        </div>
                    )}
                </section>
            </main>

            <Footer />

            <style jsx global>{`
                .bg-background {
                    background-color: #0f172a;
                    color: #e2e8f0;
                }
                .hero-gradient {
                    background: linear-gradient(to bottom, #1e293b, #0f172a);
                }
                .gradient-text {
                    background: linear-gradient(to right, #60a5fa, #a78bfa);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                }
            `}</style>
        </div>
    );
}