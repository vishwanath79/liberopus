'use client';

import { useState, useEffect } from 'react';
import { Book } from '../types/types';
import { bookApi } from '../api/bookApi';
import { BookCard } from '../components/BookCard';
import { AddBookForm } from '../components/AddBookForm';

export default function Home() {
    const [books, setBooks] = useState<Book[]>([]);
    const [recommendations, setRecommendations] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ratingStatus, setRatingStatus] = useState<{message: string, isError: boolean} | null>(null);

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

    useEffect(() => {
        loadBooks();
    }, []);

    const handleRatingSubmit = async (bookId: string, rating: number) => {
        try {
            setRatingStatus({ message: 'Submitting rating...', isError: false });
            await bookApi.submitRating(bookId, rating);
            setRatingStatus({ message: 'Rating submitted successfully!', isError: false });

            // After rating, get recommendations
            const response = await bookApi.getRecommendations({
                user_history: [bookId],
                user_ratings: { [bookId]: rating }
            });
            if (response.recommendations) {
                setRecommendations(response.recommendations);
            }

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

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="hero-gradient">
                <div className="max-w-7xl mx-auto py-20 px-4 text-center">
                    <h1 className="text-5xl font-bold mb-6">
                        Technical <span className="gradient-text">Book Recommendations</span>
                    </h1>
                    <p className="text-xl text-gray-300 mb-8">
                        Discover and rate technical books. Get personalized recommendations based on your interests.
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
                    <section className="mb-16">
                        <h2 className="text-3xl font-bold mb-8">Recommended for You</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {recommendations.map((book) => (
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    onRatingSubmit={handleRatingSubmit}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* All Books Section */}
                <section>
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
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    onRatingSubmit={handleRatingSubmit}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}