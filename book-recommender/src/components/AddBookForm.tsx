'use client';

import { useState } from 'react';
import { bookApi } from '../api/bookApi';

interface AddBookFormProps {
    onBookAdded: () => void;
}

export const AddBookForm: React.FC<AddBookFormProps> = ({ onBookAdded }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        try {
            setStatus({ message: 'Adding book...', isError: false });
            
            const bookData = {
                title: formData.get('title') as string,
                author: formData.get('author') as string,
                categories: (formData.get('categories') as string).split(',').map(c => c.trim()),
                technical_level: formData.get('technical_level') as string,
                topics: (formData.get('topics') as string).split(',').map(t => t.trim()),
                description: formData.get('description') as string,
                avg_rating: 0,
                page_count: parseInt(formData.get('page_count') as string),
                publication_year: parseInt(formData.get('publication_year') as string)
            };

            await bookApi.analyzeBook(bookData);
            setStatus({ message: 'Book added successfully!', isError: false });
            onBookAdded();
            setIsOpen(false);
            
            // Reset form
            e.currentTarget.reset();
            
            // Clear success message after 3 seconds
            setTimeout(() => setStatus(null), 3000);
        } catch (error) {
            console.error('Failed to add book:', error);
            setStatus({
                message: 'Failed to add book. Please try again.',
                isError: true
            });
        }
    };

    return (
        <div className="mb-8">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="mb-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
                {isOpen ? 'Cancel' : '+ Add New Book'}
            </button>

            {status && (
                <div className={`mb-4 p-4 rounded-lg ${
                    status.isError ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'
                }`}>
                    {status.message}
                </div>
            )}

            {isOpen && (
                <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Title</label>
                            <input
                                type="text"
                                name="title"
                                required
                                className="w-full p-2 rounded bg-background border border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Author</label>
                            <input
                                type="text"
                                name="author"
                                required
                                className="w-full p-2 rounded bg-background border border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Categories (comma-separated)</label>
                            <input
                                type="text"
                                name="categories"
                                required
                                placeholder="e.g. Programming, Machine Learning"
                                className="w-full p-2 rounded bg-background border border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Topics (comma-separated)</label>
                            <input
                                type="text"
                                name="topics"
                                required
                                placeholder="e.g. Python, Neural Networks"
                                className="w-full p-2 rounded bg-background border border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Technical Level</label>
                            <select
                                name="technical_level"
                                required
                                className="w-full p-2 rounded bg-background border border-gray-700"
                            >
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Page Count</label>
                            <input
                                type="number"
                                name="page_count"
                                required
                                min="1"
                                className="w-full p-2 rounded bg-background border border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Publication Year</label>
                            <input
                                type="number"
                                name="publication_year"
                                required
                                min="1900"
                                max={new Date().getFullYear()}
                                className="w-full p-2 rounded bg-background border border-gray-700"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            name="description"
                            required
                            rows={4}
                            className="w-full p-2 rounded bg-background border border-gray-700"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Add Book
                    </button>
                </form>
            )}
        </div>
    );
}; 