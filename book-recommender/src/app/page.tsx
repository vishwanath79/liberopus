'use client';

import { useState, useMemo, useEffect } from 'react';
import { Book, WishlistItem } from '../types/types';
import { Footer } from '../components/Footer';
import { CategoryFilter } from '../components/CategoryFilter';
import { WishlistDrawer } from '../components/WishlistDrawer';

interface BookCardProps {
    book: Book;
    onRate?: (bookId: string, rating: number) => Promise<void>;
    onDismiss?: (bookId: string) => void;
    onAddToWishlist?: (bookId: string) => void;
    isInWishlist?: boolean;
    userRating?: number;
}

// BookCard Component
const BookCard = ({ book, onRate, onDismiss, onAddToWishlist, isInWishlist, userRating }: BookCardProps) => {
    const rating = typeof book.average_rating === 'number' 
        ? Math.min(Math.max(book.average_rating, 0), 5) 
        : 0;

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 hover:bg-gray-700 transition-colors">
            <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                {book.title}
            </h3>
            <p className="text-gray-400 mb-2">
                by {book.author}
            </p>
            <div className="flex items-center mb-2">
                <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, index) => (
                        <span key={index}>
                            {index < rating ? '★' : '☆'}
                        </span>
                    ))}
                </div>
                <span className="text-gray-400 ml-2">
                    ({rating.toFixed(1)})
                </span>
            </div>
            <div className="flex justify-between items-center mt-4">
                {onRate && (
                    <div className="flex space-x-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                            <button
                                key={value}
                                onClick={() => onRate(book.id, value)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    userRating === value ? 'bg-yellow-400 text-gray-900' : 'bg-gray-700 text-gray-400'
                                } hover:bg-yellow-400 hover:text-gray-900 transition-colors`}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex space-x-2">
                    {onAddToWishlist && !isInWishlist && (
                        <button
                            onClick={() => onAddToWishlist(book.id)}
                            className="text-gray-400 hover:text-emerald-400 transition-colors"
                            title="Add to Wishlist"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            onClick={() => onDismiss(book.id)}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                            title="Dismiss"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

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

    // Filter books based on selected categories
    const filteredBooks = useMemo(() => {
        return books.filter(book => 
            !dismissedBooks.has(book.id) &&
            (!selectedCategories.length || 
             book.topics.some(topic => selectedCategories.includes(topic)))
        );
    }, [books, dismissedBooks, selectedCategories]);

    // Filter recommendations based on selected categories
    const filteredRecommendations = useMemo(() => {
        return recommendations.filter((book: Book) => 
            book && book.id && 
            !dismissedBooks.has(book.id) &&
            (!selectedCategories.length || 
             book.topics?.some(topic => selectedCategories.includes(topic)))
        );
    }, [recommendations, dismissedBooks, selectedCategories]);

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
            const ratings = data.ratings.reduce((acc: {[key: string]: number}, rating: { book_id: string; rating: number }) => {
                acc[rating.book_id] = rating.rating;
                return acc;
            }, {});
            setUserRatings(ratings);
            
            // Load recommendations after ratings are loaded
            if (Object.keys(ratings).length > 0) {
                await loadRecommendations();
            }
        } catch (error) {
            console.error('Failed to load user ratings:', error);
        }
    };

    // Load recommendations from API with retries
    const loadRecommendations = async () => {
        const maxRetries = 5;
        const baseDelay = 5000;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                setLoadingRecommendations(true);
                console.log(`Attempt ${attempt + 1} of ${maxRetries} to load recommendations`);
                console.log('Current user ratings:', userRatings);

                const response = await fetch('http://localhost:8000/get-recommendations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_history: Object.keys(userRatings),
                        user_ratings: userRatings
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to load recommendations: ${response.status}`);
                }

                const data = await response.json();
                console.log('Raw recommendations response:', data);

                if (data.recommendations && Array.isArray(data.recommendations)) {
                    // Ensure each recommendation has required fields
                    const validRecommendations = data.recommendations.filter(book => 
                        book && book.id && book.title && book.author
                    );
                    console.log('Setting valid recommendations:', validRecommendations);
                    setRecommendations(validRecommendations);
                    setError(null);
                    return;
                } else {
                    console.warn('Unexpected recommendations format:', data);
                    throw new Error('Invalid recommendations format');
                }
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed:`, error);
                attempt++;
                
                if (attempt === maxRetries) {
                    console.error('All retry attempts failed');
                    setError('Failed to load recommendations. Please try again later.');
                    setRecommendations([]);
                } else {
                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    console.log(`Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } finally {
                setLoadingRecommendations(false);
            }
        }
    };

    // Load wishlist from API
    const loadWishlist = async () => {
        try {
            const response = await fetch('http://localhost:8000/wishlist');
            if (!response.ok) {
                throw new Error('Failed to load wishlist');
            }
            const data = await response.json();
            setWishlistItems(data.wishlist);
            setWishlistCount(data.wishlist.length);
            const wishlistBookIds = new Set(data.wishlist.map((item: WishlistItem) => item.id));
            setWishlistBooks(wishlistBookIds);
        } catch (error) {
            console.error('Failed to load wishlist:', error);
        }
    };

    // Handle rating submission
    const handleRatingSubmit = async (bookId: string, rating: number) => {
        console.log('Starting rating submission:', { bookId, rating });
        setRatingStatus('submitting');
        try {
            const response = await fetch('http://localhost:8000/ratings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ book_id: bookId, rating }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Failed to submit rating:', errorData);
                setRatingStatus('error');
                return;
            }

            console.log('Rating submitted successfully');

            // Update local state with new rating
            setUserRatings(prev => {
                const newRatings = {
                    ...prev,
                    [bookId]: rating
                };
                console.log('Updated user ratings:', newRatings);
                return newRatings;
            });
            setRatingStatus('success');

            // Immediately load new recommendations after rating
            console.log('Loading recommendations after rating update...');
            try {
                await loadRecommendations();
                console.log('Current recommendations state:', recommendations);
            } catch (recError) {
                console.error('Error loading recommendations after rating:', recError);
            }
            
        } catch (error) {
            console.error('Error submitting rating:', error);
            setRatingStatus('error');
        } finally {
            // Reset rating status after a delay
            setTimeout(() => {
                setRatingStatus('idle');
                console.log('Rating status reset to idle');
            }, 2000);
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

            setDismissedBooks(prev => new Set([...prev, bookId]));
        } catch (error) {
            console.error('Failed to dismiss book:', error);
        }
    };

    // Handle adding a book to wishlist
    const handleAddToWishlist = async (bookId: string) => {
        try {
            const response = await fetch('http://localhost:8000/wishlist/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ book_id: bookId }),
            });

            if (!response.ok) {
                throw new Error('Failed to add book to wishlist');
            }

            await loadWishlist(); // Reload wishlist to get updated data
        } catch (error) {
            console.error('Failed to add book to wishlist:', error);
        }
    };

    // Handle removing a book from wishlist
    const handleRemoveFromWishlist = async (bookId: string) => {
        try {
            const response = await fetch(`http://localhost:8000/wishlist/remove/${bookId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to remove book from wishlist');
            }

            await loadWishlist(); // Reload wishlist to get updated data
        } catch (error) {
            console.error('Failed to remove book from wishlist:', error);
        }
    };

    // Handle category change
    const handleCategoryChange = (categories: string[]) => {
        setSelectedCategories(categories);
    };

    // Handle adding a new book
    const handleAddBook = async (title: string, author: string) => {
        setAddBookStatus('submitting');
        try {
            const response = await fetch('http://localhost:8000/add-book', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, author }),
            });

            if (!response.ok) {
                throw new Error('Failed to add book');
            }

            setAddBookStatus('success');
            setShowAddBookForm(false);
            await loadBooks(); // Reload books to include the new addition
        } catch (error) {
            console.error('Failed to add book:', error);
            setAddBookStatus('error');
        }
    };

    // Handle reordering wishlist
    const handleReorderWishlist = (items: WishlistItem[]) => {
        setWishlistItems(items);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <div className="bg-gray-800 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold">Book Recommender</h1>
                        <button
                            onClick={() => setIsWishlistOpen(true)}
                            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            Wishlist ({wishlistCount})
                        </button>
                    </div>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
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
                            </div>
                            <div className="text-sm text-gray-400">Wishlist Items</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-12 px-4">
                {/* Category Filter */}
                <CategoryFilter
                    selectedCategories={selectedCategories}
                    onCategoriesChange={handleCategoryChange}
                />

                {/* Recommendations Section */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold text-white mb-6">
                        Recommended Books
                        {loadingRecommendations && (
                            <span className="ml-2 text-gray-400 text-sm font-normal animate-pulse">
                                Loading recommendations...
                            </span>
                        )}
                    </h2>
                    
                    {error && (
                        <div className="bg-red-900/50 text-red-200 p-4 rounded-lg mb-6">
                            <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {!loadingRecommendations && !error && (!recommendations || recommendations.length === 0) && (
                        <div className="text-center py-8 bg-gray-800/50 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <p className="text-gray-400 mb-4">Rate some books to get personalized recommendations!</p>
                            <p className="text-sm text-gray-500">Your recommendations will appear here after you rate a few books.</p>
                        </div>
                    )}

                    {loadingRecommendations && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="bg-gray-800/50 rounded-lg p-6 animate-pulse">
                                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
                                    <div className="h-4 bg-gray-700 rounded w-1/2 mb-8"></div>
                                    <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                                    <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loadingRecommendations && recommendations && recommendations.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredRecommendations.map((book) => (
                                book && book.id && (
                                    <BookCard
                                        key={`rec-${book.id}`}
                                        book={book}
                                        onRate={handleRatingSubmit}
                                        onDismiss={handleDismissBook}
                                        onAddToWishlist={handleAddToWishlist}
                                        isInWishlist={wishlistBooks.has(book.id)}
                                        userRating={userRatings[book.id]}
                                    />
                                )
                            ))}
                        </div>
                    )}
                </section>

                {/* All Books Section */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6">
                        All Books
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredBooks.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                onRate={handleRatingSubmit}
                                onDismiss={handleDismissBook}
                                onAddToWishlist={handleAddToWishlist}
                                isInWishlist={wishlistBooks.has(book.id)}
                                userRating={userRatings[book.id]}
                            />
                        ))}
                    </div>
                </section>

                {/* Wishlist Drawer */}
                <WishlistDrawer
                    isOpen={isWishlistOpen}
                    onClose={() => setIsWishlistOpen(false)}
                    wishlistItems={wishlistItems}
                    onRemoveFromWishlist={handleRemoveFromWishlist}
                    onReorderWishlist={handleReorderWishlist}
                />
            </main>

            <Footer />
        </div>
    );
}