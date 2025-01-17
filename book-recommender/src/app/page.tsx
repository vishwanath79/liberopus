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
    const [ratingStatus, setRatingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);
    const [showAddBookForm, setShowAddBookForm] = useState(false);
    const [addBookStatus, setAddBookStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

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
        setLoadingRecommendations(true);
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
        } finally {
            setLoadingRecommendations(false);
        }
    };

    // Handle book rating submission
    const handleRatingSubmit = async (bookId: string, rating: number) => {
        setRatingStatus('submitting');
        try {
            console.log('Submitting rating:', bookId, rating);
            const response = await fetch('http://localhost:8000/ratings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ book_id: bookId, rating }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to submit rating:', errorData);
                throw new Error('Failed to submit rating');
            }

            // Update local state with new rating
            setUserRatings(prev => ({
                ...prev,
                [bookId]: rating
            }));
            setRatingStatus('success');

            // Immediately load new recommendations after rating
            await loadRecommendations();
            
        } catch (error) {
            console.error('Error submitting rating:', error);
            setRatingStatus('error');
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

    // Handle adding a new book
    const handleAddBook = async (title: string, author: string) => {
        setAddBookStatus('submitting');
        try {
            const response = await fetch('http://localhost:8000/books', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, author }),
            });

            if (!response.ok) {
                throw new Error('Failed to add book');
            }

            // Reload books to include the new addition
            await loadBooks();
            setAddBookStatus('success');
            setShowAddBookForm(false);

            // Reset form status after a delay
            setTimeout(() => setAddBookStatus('idle'), 3000);
        } catch (error) {
            console.error('Error adding book:', error);
            setAddBookStatus('error');
        }
    };

    interface BookCardProps {
        book: Book;
        showRating?: boolean;
        onRatingSubmit?: (bookId: string, rating: number) => Promise<void>;
        currentRating?: number;
    }

    const BookCard = ({ book, showRating = true, onRatingSubmit, currentRating = 0 }: BookCardProps) => {
        const [hoveredStar, setHoveredStar] = useState<number | null>(null);
        const [selectedRating, setSelectedRating] = useState<number | null>(currentRating || null);
        const isInWishlist = wishlistBooks.has(book.id);

        const handleStarClick = async (rating: number) => {
            setSelectedRating(rating);
            if (onRatingSubmit) {
                await onRatingSubmit(book.id, rating);
            }
        };

        const displayRating = hoveredStar || selectedRating || 0;

        return (
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50 hover:border-indigo-500/50 transition-colors">
                <div className="flex justify-between items-start">
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
                    <div className="flex gap-2 ml-4">
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

                {showRating && (
                    <div className="mt-4">
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
                        <div className="mt-2 text-sm text-gray-400">
                            Average rating: {book.average_rating.toFixed(1)} ★
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="hero-gradient">
                <div className="max-w-7xl mx-auto py-12 px-4">
                    <div className="flex flex-col items-center text-center">
                        <h1 className="text-6xl font-bold mb-8">
                            <span className="gradient-text">LIBER OPUS</span>
                        </h1>
                        <p className="text-xl text-gray-300 max-w-2xl">
                            Your own recommendation engine to discover and rate books. 
               
                        </p>
                      
                        <p className="text-xl text-gray-300 max-w-2xl" style={{ fontWeight: 'bold', color: 'white' }}> 
                            Get personalized recommendations based on your interests.
                        </p>
                        <button
                            onClick={() => setIsWishlistOpen(true)}
                            className="mt-8 flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50 text-white px-4 py-2 rounded-lg border border-slate-700/50 transition-colors"
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
                {/* Add Book Button */}
                <div className="mb-8 flex justify-end">
                    <button
                        onClick={() => setShowAddBookForm(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add New Book
                    </button>
                </div>

                {/* Add Book Form Modal */}
                {showAddBookForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-slate-900 p-6 rounded-lg shadow-xl border border-slate-700 max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-white mb-4">Add New Book</h3>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                await handleAddBook(
                                    formData.get('title') as string,
                                    formData.get('author') as string
                                );
                            }}>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            name="title"
                                            id="title"
                                            required
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="Enter book title"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="author" className="block text-sm font-medium text-gray-300 mb-1">
                                            Author
                                        </label>
                                        <input
                                            type="text"
                                            name="author"
                                            id="author"
                                            required
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="Enter author name"
                                        />
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddBookForm(false)}
                                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={addBookStatus === 'submitting'}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {addBookStatus === 'submitting' ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Adding...
                                            </>
                                        ) : (
                                            'Add Book'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

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
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                        Recommended for You
                        {loadingRecommendations && (
                            <span className="ml-3 inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-indigo-900/30 text-indigo-300 border border-indigo-800/50">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Updating...
                            </span>
                        )}
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
                </div>

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

                {/* Add Book Status Toast */}
                {addBookStatus === 'success' && (
                    <div className="fixed bottom-4 right-4 bg-green-900/90 text-green-100 px-4 py-2 rounded-lg shadow-lg border border-green-800/50 flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Book added successfully!
                    </div>
                )}
                {addBookStatus === 'error' && (
                    <div className="fixed bottom-4 right-4 bg-red-900/90 text-red-100 px-4 py-2 rounded-lg shadow-lg border border-red-800/50 flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Failed to add book. Please try again.
                    </div>
                )}
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

            {/* Toast Messages for Rating Status */}
            {ratingStatus === 'submitting' && (
                <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg border border-slate-700 flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting rating...
                </div>
            )}
            {ratingStatus === 'success' && (
                <div className="fixed bottom-4 right-4 bg-green-900/90 text-green-100 px-4 py-2 rounded-lg shadow-lg border border-green-800/50 flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Rating submitted successfully!
                </div>
            )}
            {ratingStatus === 'error' && (
                <div className="fixed bottom-4 right-4 bg-red-900/90 text-red-100 px-4 py-2 rounded-lg shadow-lg border border-red-800/50 flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Failed to submit rating. Please try again.
                </div>
            )}

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