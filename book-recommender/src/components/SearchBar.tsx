'use client';

import { useState } from 'react';
import { Book } from '../types/types';

interface SearchBarProps {
    books: Book[];
    userRatings: {[key: string]: number};
    onBookSelect: (book: Book) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ books, userRatings, onBookSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter rated books based on search query
    const filteredBooks = books.filter(book => {
        const hasRating = userRatings[book.id] !== undefined;
        const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            book.author.toLowerCase().includes(searchQuery.toLowerCase());
        return hasRating && matchesSearch;
    });

    return (
        <div className="relative">
            {/* Search Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
                {isOpen ? 'Close Search' : 'Search Rated Books'}
            </button>

            {/* Search Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-card rounded-lg shadow-lg p-4 z-50">
                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="Search by title or author..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-2 mb-4 rounded bg-background border border-gray-700 text-foreground"
                    />

                    {/* Results List */}
                    <div className="max-h-96 overflow-y-auto">
                        {filteredBooks.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">
                                {searchQuery ? 'No rated books found' : 'Start typing to search rated books'}
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {filteredBooks.map(book => (
                                    <div
                                        key={book.id}
                                        onClick={() => {
                                            onBookSelect(book);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                        className="p-3 hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-colors"
                                    >
                                        <div className="font-medium text-foreground">{book.title}</div>
                                        <div className="text-sm text-gray-400">by {book.author}</div>
                                        <div className="text-sm text-yellow-400 mt-1">
                                            Your rating: {userRatings[book.id]} ★
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}; 