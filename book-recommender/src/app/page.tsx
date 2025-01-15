'use client';

import { useState, useEffect, useRef } from 'react';
import { Book, DBRating } from '../types/types';
import { bookApi } from '../api/bookApi';
import { BookCard } from '../components/BookCard';
import { AddBookForm } from '../components/AddBookForm';
import { SearchBar } from '../components/SearchBar';
import { Footer } from '../components/Footer';

export default function Home() {
    const [books, setBooks] = useState<Book[]>([]);
    const [recommendations, setRecommendations] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ratingStatus, setRatingStatus] = useState<{message: string, isError: boolean} | null>(null);
    const [userRatings, setUserRatings] = useState<{[key: string]: number}>({});
    
    // Refs for scrolling
    const booksRef = useRef<HTMLDivElement>(null);

    const loadUserRatings = async () => {
        try {
            const response = await fetch('http://localhost:8000/ratings');
            const data = await response.json();
            const ratings = data.ratings.reduce((acc: {[key: string]: number}, rating: DBRating) => {
                acc[rating.book_id] = rating.rating;
                return acc;
            }, {});
            setUserRatings(ratings);
            
            // Load recommendations if we have ratings
            if (Object.keys(ratings).length > 0) {
                await loadRecommendations(ratings);
            }
        } catch (error) {
            console.error('Failed to load user ratings:', error);
        }
    };

    const loadBooks = async () => {
        try {
            const response = await fetch('http://localhost:8000/books');
            const data = await response.json();
            setBooks(data.books || []);
            setError(null);
        } catch (error) {
            console.error('Failed to load books:', error);
            setError('Failed to load books. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const loadRecommendations = async (ratings = userRatings) => {
        try {
            const response = await bookApi.getRecommendations({
                user_history: Object.keys(ratings),
                user_ratings: ratings
            });
            if (response.recommendations) {
                setRecommendations(response.recommendations);
            }
        } catch (error) {
            console.error('Failed to load recommendations:', error);
        }
    };

    useEffect(() => {
        const initializeData = async () => {
            await loadBooks();
            await loadUserRatings();
        };
        initializeData();
    }, []);

    const handleRatingSubmit = async (bookId: string, rating: number) => {
        try {
            setRatingStatus({ message: 'Submitting rating...', isError: false });
            await bookApi.submitRating(bookId, rating);
            
            // Update user ratings
            const newRatings = {
                ...userRatings,
                [bookId]: rating
            };
            setUserRatings(newRatings);

            setRatingStatus({ message: 'Rating submitted successfully!', isError: false });

            // Load new recommendations
            await loadRecommendations(newRatings);

            // Clear success message after 3 seconds
            setTimeout(() => setRatingStatus(null), 3000);
        } catch (error) {
            console.error('Failed to submit rating:', error);
            setRatingStatus({
                message: 'Failed to submit rating. Please try again.',
                isError: true
            });
            setTimeout(() => setRatingStatus(null), 5000);
        }
    };

    const handleBookSelect = (book: Book) => {
        // Scroll to the book's position
        const bookElements = booksRef.current?.getElementsByClassName('book-card');
        if (bookElements) {
            for (let i = 0; i < bookElements.length; i++) {
                const element = bookElements[i] as HTMLElement;
                if (element.dataset.bookId === book.id) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Highlight the book card temporarily
                    element.classList.add('highlight-card');
                    setTimeout(() => element.classList.remove('highlight-card'), 2000);
                    break;
                }
            }
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="hero-gradient">
                <div className="max-w-7xl mx-auto py-20 px-4 text-center relative">
                    <div className="absolute right-4 top-4">
                        <SearchBar
                            books={books}
                            userRatings={userRatings}
                            onBookSelect={handleBookSelect}
                        />
                    </div>
                    <h1 className="text-5xl font-bold mb-6">
                         <span className="gradient-text">LIBER OPUS </span>
                    </h1>
                    <p className="text-xl text-gray-300 mb-8">
                        Discover and rate books. Get personalized recommendations based on your interests.
                    </p>
                </div>
            </div>

            {/* Status Messages */}
            {ratingStatus && (
                <div className={`fixed top-4 right-4 p-4 rounded-md shadow-md ${
                    ratingStatus.isError ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'
                }`}>
                    {ratingStatus.message}
                </div>
            )}

            <main className="max-w-7xl mx-auto py-12 px-4">
                {/* Add Book Section */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold mb-8">Add New Book</h2>
                    <AddBookForm onBookAdded={loadBooks} />
                </section>

                {/* Recommendations Section */}
                {recommendations.length > 0 && (
                    <section className="mb-16 bg-indigo-900/30 rounded-lg p-8">
                        <h2 className="text-3xl font-bold mb-8">
                            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 text-transparent bg-clip-text">
                                Recommended for You
                            </span>
                            <span className="text-lg font-normal text-gray-400 ml-4">
                                Based on {Object.keys(userRatings).length} rated books
                            </span>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {recommendations.map((book) => (
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    onRatingSubmit={handleRatingSubmit}
                                    currentRating={userRatings[book.id]}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* All Books Section */}
                <section ref={booksRef}>
                    <h2 className="text-3xl font-bold mb-8">All Books</h2>
                    {loading ? (
                        <div className="text-center py-10">Loading books...</div>
                    ) : error ? (
                        <div className="text-center py-10 text-red-500">{error}</div>
                    ) : books.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">No books available.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {books.map((book) => (
                                <div key={book.id} className="book-card" data-book-id={book.id}>
                                    <BookCard
                                        book={book}
                                        onRatingSubmit={handleRatingSubmit}
                                        currentRating={userRatings[book.id]}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            <Footer />

            <style jsx global>{`
                .highlight-card {
                    animation: highlight 2s ease-in-out;
                }
                
                @keyframes highlight {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: none;
                    }
                    50% {
                        transform: scale(1.02);
                        box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
                    }
                }
            `}</style>
        </div>
    );
}