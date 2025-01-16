'use client';

import { useState, useMemo, useEffect } from 'react';
import { Book, WishlistItem } from '../types/types';
import { Footer } from '../components/Footer';
import { CategoryFilter } from '../components/CategoryFilter';
import { WishlistDrawer } from '../components/WishlistDrawer';

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
    const [wishlistBooks, setWishlistBooks] = useState<Set<string>>(new Set());
    const [wishlistCount, setWishlistCount] = useState<number>(0);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);
    const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);

    // Calculate user's average rating
    const averageRating = useMemo(() => {
        const ratings = Object.values(userRatings);
        if (ratings.length === 0) return 0;
        return (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1);
    }, [userRatings]);

    // Initialize data loading
    useEffect(() => {
        const initializeData = async () => {
            await Promise.all([
                loadBooks(),
                loadUserRatings(),
                loadWishlist()
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

    // Load wishlist from API
    const loadWishlist = async () => {
        try {
            const response = await fetch('http://localhost:8000/wishlist');
            if (!response.ok) {
                throw new Error('Failed to load wishlist');
            }
            const data = await response.json();
            setWishlistItems(data.wishlist);
            setWishlistBooks(new Set<string>(data.wishlist.map((item: WishlistItem) => item.id)));
            setWishlistCount(data.wishlist.length);
        } catch (error) {
            console.error('Failed to load wishlist:', error);
        }
    };

    // Handle adding book to wishlist
    const handleAddToWishlist = async (bookId: string) => {
        try {
            console.log('Adding book to wishlist:', bookId); // Debug log
            const response = await fetch('http://localhost:8000/wishlist/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ book_id: bookId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to add to wishlist:', errorData); // Debug log
                throw new Error(`Failed to add book to wishlist: ${errorData.detail}`);
            }

            // Update local state
            setWishlistBooks(prev => new Set([...prev, bookId]));
            setWishlistCount(prev => prev + 1);
            
            // Reload wishlist items to get the updated list with proper order
            await loadWishlist();
            
            setError(null);
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            setError('Failed to add book to wishlist. Please try again.');
        }
    };

    // Handle removing book from wishlist
    const handleRemoveFromWishlist = async (bookId: string) => {
        try {
            console.log('Removing book from wishlist:', bookId); // Debug log
            const response = await fetch(`http://localhost:8000/wishlist/remove/${bookId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to remove from wishlist:', errorData); // Debug log
                throw new Error(`Failed to remove book from wishlist: ${errorData.detail}`);
            }

            // Update local state
            setWishlistBooks(prev => {
                const newSet = new Set(prev);
                newSet.delete(bookId);
                return newSet;
            });
            setWishlistCount(prev => prev - 1);
            
            // Also update wishlist items
            setWishlistItems(prev => prev.filter(item => item.id !== bookId));
            
            setError(null);
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            setError('Failed to remove book from wishlist. Please try again.');
        }
    };

    // Handle reordering wishlist
    const handleReorderWishlist = async (orders: { book_id: string; order: number }[]) => {
        try {
            const response = await fetch('http://localhost:8000/wishlist/reorder', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orders),
            });

            if (!response.ok) {
                throw new Error('Failed to reorder wishlist');
            }

            // Reload wishlist to get updated order
            await loadWishlist();
        } catch (error) {
            console.error('Error reordering wishlist:', error);
            setError('Failed to reorder wishlist. Please try again.');
        }
    };

    interface BookCardProps {
        book: Book;
        showRating?: boolean;
        onRatingSubmit?: (bookId: string, rating: number) => Promise<void>;
        currentRating?: number;
    }

    const BookCard = ({ book, showRating = true, onRatingSubmit, currentRating = 0 }: BookCardProps) => {
        const isInWishlist = wishlistBooks.has(book.id);
        
        return (
            <div className="bg-slate-800/50 rounded-lg shadow-lg p-6 mb-4 border border-slate-700/50 hover:border-indigo-500/50 transition-colors">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-semibold mb-2 text-white">{book.title}</h3>
                        <p className="text-gray-400 mb-2">by {book.author}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => isInWishlist ? handleRemoveFromWishlist(book.id) : handleAddToWishlist(book.id)}
                            className={`text-gray-500 hover:text-yellow-400 transition-colors ${isInWishlist ? 'text-yellow-400' : ''}`}
                            title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isInWishlist ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        </button>
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
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="hero-gradient">
                <div className="max-w-7xl mx-auto py-6 px-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-4xl font-bold">
                            <span className="gradient-text">LIBER OPUS</span>
                        </h1>
                        <button
                            onClick={() => setIsWishlistOpen(true)}
                            className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50 text-white px-4 py-2 rounded-lg border border-slate-700/50 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            <span>Wishlist</span>
                            {wishlistCount > 0 && (
                                <span className="bg-indigo-500 text-white text-xs px-2 py-1 rounded-full">
                                    {wishlistCount}
                                </span>
                            )}
                        </button>
                    </div>
                    <p className="text-xl text-gray-300 mt-6">
                        Discover and rate books. Get personalized recommendations based on your interests.
                    </p>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-slate-800/50 border-y border-slate-700/50">
                <div className="max-w-7xl mx-auto py-6 px-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-indigo-400">{books.length}</div>
                            <div className="text-sm text-gray-400">Total Books</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-purple-400">{Object.keys(userRatings).length}</div>
                            <div className="text-sm text-gray-400">Books Rated</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-blue-400">{recommendations.length}</div>
                            <div className="text-sm text-gray-400">Current Recommendations</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-yellow-400">
                                {averageRating}
                                <span className="text-lg">★</span>
                            </div>
                            <div className="text-sm text-gray-400">Average Rating</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-emerald-400">
                                {wishlistCount}
                                <span className="text-lg ml-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                </span>
                            </div>
                            <div className="text-sm text-gray-400">Wishlist Items</div>
                        </div>
                    </div>
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

            {/* Wishlist Drawer */}
            <WishlistDrawer
                isOpen={isWishlistOpen}
                onClose={() => setIsWishlistOpen(false)}
                wishlistItems={wishlistItems}
                onRemoveFromWishlist={handleRemoveFromWishlist}
                onReorderWishlist={handleReorderWishlist}
            />

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