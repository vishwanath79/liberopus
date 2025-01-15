'use client';

import { useState, useRef } from 'react';
import { bookApi } from '../api/bookApi';

interface AddBookFormProps {
    onBookAdded: () => void;
}

export const AddBookForm: React.FC<AddBookFormProps> = ({ onBookAdded }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        try {
            setStatus({ message: 'Adding book...', isError: false });
            
            // Prepare book data with required fields
            const bookData = {
                title: (formData.get('title') as string)?.trim() || '',
                author: (formData.get('author') as string)?.trim() || '',
                categories: ['General'],  // Default category
                technical_level: 'intermediate',  // Default level
                topics: ['General'],  // Default topic
                description: `A book titled '${formData.get('title')}' by ${formData.get('author')}`,  // Default description
                avg_rating: 0,
                page_count: 300,  // Default page count
                publication_year: new Date().getFullYear()  // Current year as default
            };

            // Validate required fields
            if (!bookData.title || !bookData.author) {
                throw new Error('Title and author are required');
            }

            console.log('Sending book data:', bookData);
            const response = await bookApi.analyzeBook(bookData);
            console.log('Server response:', response);

            // Reset form and update state
            if (formRef.current) {
                formRef.current.reset();
            }
            
            setStatus({ message: 'Book added successfully!', isError: false });
            onBookAdded();
            setIsOpen(false);
            
            // Clear success message after 3 seconds
            setTimeout(() => setStatus(null), 3000);
        } catch (error) {
            console.error('Failed to add book:', error);
            setStatus({
                message: error instanceof Error ? error.message : 'Failed to add book. Please try again.',
                isError: true
            });
            // Keep error message visible for longer
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleCancel = () => {
        if (formRef.current) {
            formRef.current.reset();
        }
        setIsOpen(false);
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
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Title</label>
                            <input
                                type="text"
                                name="title"
                                required
                                placeholder="Enter book title"
                                className="w-full p-2 rounded bg-background border border-gray-700 text-foreground"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Author</label>
                            <input
                                type="text"
                                name="author"
                                required
                                placeholder="Enter author name"
                                className="w-full p-2 rounded bg-background border border-gray-700 text-foreground"
                            />
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                        >
                            Add Book
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex-1 py-3 bg-gray-700 text-gray-200 rounded-lg hover:opacity-90 transition-opacity"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}; 