'use client';

import { useState, useMemo, useEffect } from 'react';
import { Book, WishlistItem } from '../types/types';
import { bookApi } from '../api/bookApi';
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
    const [error, setError] = useState<string | null>(null);
    const [userRatings, setUserRatings] = useState<{[key: string]: number}>({});
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [dismissedBooks, setDismissedBooks] = useState<Set<string>>(new Set());
    const [wishlistBooks, setWishlistBooks] = useState<Set<string>>(new Set());
    const [wishlistCount, setWishlistCount] = useState<number>(0);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);
    const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);

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
            try {
                const [booksData, ratingsData, wishlistData] = await Promise.all([
                    bookApi.getBooks(),
                    bookApi.getRatings(),
                    bookApi.getWishlist()
                ]);

                setBooks(booksData);
                
                // Process ratings
                const ratingsMap = ratingsData.ratings.reduce((acc: {[key: string]: number}, rating) => {
                    acc[rating.book_id] = rating.rating;
                    return acc;
                }, {});
                setUserRatings(ratingsMap);

                // Process wishlist
                setWishlistItems(wishlistData.wishlist);
                setWishlistCount(wishlistData.wishlist.length);
                setWishlistBooks(new Set(wishlistData.wishlist.map((item: WishlistItem) => item.id)));

                // Load recommendations if we have ratings
                if (Object.keys(ratingsMap).length > 0) {
                    await loadRecommendations();
                }
            } catch (error) {
                console.error('Error initializing data:', error);
                setError('Failed to load initial data. Please try again later.');
            }
        };

        initializeData();
    }, []);

    // Load recommendations from API
    const loadRecommendations = async () => {
        setLoadingRecommendations(true);
        try {
            const data = await bookApi.getRecommendations({
                user_history: Object.keys(userRatings),
                user_ratings: userRatings
            });

            if (data.recommendations) {
                const validRecommendations = data.recommendations
                    .filter((book: Book | null): book is Book => 
                        book !== null && 
                        typeof book === 'object' &&
                        'id' in book &&
                        'title' in book &&
                        'author' in book
                    );

                setRecommendations(validRecommendations);
                setError(null);
            }
        } catch (error) {
            console.error('Failed to load recommendations:', error);
            setError('Failed to load recommendations. Please try again later.');
            setRecommendations([]);
        } finally {
            setLoadingRecommendations(false);
        }
    };

    // Handle rating submission
    const handleRatingSubmit = async (bookId: string, rating: number) => {
        try {
            await bookApi.submitRating(bookId, rating);
            setUserRatings(prev => ({
                ...prev,
                [bookId]: rating
            }));
            await loadRecommendations();
        } catch (error) {
            console.error('Error submitting rating:', error);
            setError('Failed to submit rating. Please try again.');
        }
    };

    // Handle dismissing a book
    const handleDismissBook = async (bookId: string) => {
        try {
            await bookApi.dismissBook(bookId);
            setDismissedBooks(prev => new Set([...prev, bookId]));
        } catch (error) {
            console.error('Error dismissing book:', error);
            setError('Failed to dismiss book. Please try again.');
        }
    };

    // Handle adding to wishlist
    const handleAddToWishlist = async (bookId: string) => {
        try {
            await bookApi.addToWishlist(bookId);
            const wishlistData = await bookApi.getWishlist();
            setWishlistItems(wishlistData.wishlist);
            setWishlistCount(wishlistData.wishlist.length);
            setWishlistBooks(new Set(wishlistData.wishlist.map((item: WishlistItem) => item.id)));
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            setError('Failed to add to wishlist. Please try again.');
        }
    };

    // Handle removing from wishlist
    const handleRemoveFromWishlist = async (bookId: string) => {
        try {
            await bookApi.removeFromWishlist(bookId);
            const wishlistData = await bookApi.getWishlist();
            setWishlistItems(wishlistData.wishlist);
            setWishlistCount(wishlistData.wishlist.length);
            setWishlistBooks(new Set(wishlistData.wishlist.map((item: WishlistItem) => item.id)));
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            setError('Failed to remove from wishlist. Please try again.');
        }
    };

    // Handle category change
    const handleCategoryChange = (categories: string[]) => {
        setSelectedCategories(categories);
    };

    // Handle reordering wishlist
    const handleReorderWishlist = async (orders: { book_id: string; order: number }[]) => {
        try {
            // Update the order in the UI immediately
            const updatedItems = [...wishlistItems].sort((a, b) => {
                const orderA = orders.find(o => o.book_id === a.id)?.order ?? 0;
                const orderB = orders.find(o => o.book_id === b.id)?.order ?? 0;
                return orderA - orderB;
            });
            setWishlistItems(updatedItems);
        } catch (error) {
            console.error('Error reordering wishlist:', error);
            setError('Failed to reorder wishlist. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <div className="bg-gray-800 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold">AI Book Recommender</h1>
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