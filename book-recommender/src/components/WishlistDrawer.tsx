import { WishlistItem } from '../types/types';
import { useState, useMemo, useEffect, useRef } from 'react';

interface WishlistDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    wishlistItems: WishlistItem[];
    onRemoveFromWishlist: (bookId: string) => Promise<void>;
    onReorderWishlist: (orders: { book_id: string; order: number }[]) => Promise<void>;
}

export const WishlistDrawer = ({
    isOpen,
    onClose,
    wishlistItems,
    onRemoveFromWishlist,
    onReorderWishlist
}: WishlistDrawerProps) => {
    const [sortBy, setSortBy] = useState<'date' | 'title' | 'technical'>('date');
    const [filterTopic, setFilterTopic] = useState<string>('');
    const drawerRef = useRef<HTMLDivElement>(null);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // Handle escape key
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen, onClose]);

    // Sort and filter wishlist items
    const sortedItems = useMemo(() => {
        let items = [...wishlistItems];
        
        // Apply sorting
        switch (sortBy) {
            case 'date':
                items.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
                break;
            case 'title':
                items.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'technical':
                items.sort((a, b) => {
                    const aIsTechnical = a.topics.includes('Technical');
                    const bIsTechnical = b.topics.includes('Technical');
                    return bIsTechnical ? 1 : aIsTechnical ? -1 : 0;
                });
                break;
        }

        // Apply filter
        if (filterTopic) {
            items = items.filter(item => 
                item.topics.some(topic => 
                    topic.toLowerCase().includes(filterTopic.toLowerCase())
                )
            );
        }

        return items;
    }, [wishlistItems, sortBy, filterTopic]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50">
            <div 
                ref={drawerRef}
                className="fixed inset-y-0 right-0 w-96 bg-slate-900/95 shadow-xl transform transition-transform duration-300 ease-in-out border-l border-slate-700/50"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-700/50">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-white">
                            Wishlist
                            <span className="ml-2 text-sm text-gray-400">
                                ({wishlistItems.length} items)
                            </span>
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                            aria-label="Close wishlist"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Filters and Sorting */}
                    <div className="mt-4 flex gap-2">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'technical')}
                            className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm"
                        >
                            <option value="date">Sort by Date</option>
                            <option value="title">Sort by Title</option>
                            <option value="technical">Sort by Technical Level</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Filter by topic..."
                            value={filterTopic}
                            onChange={(e) => setFilterTopic(e.target.value)}
                            className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm flex-grow"
                        />
                    </div>
                </div>

                {/* Wishlist Items */}
                <div className="overflow-y-auto h-[calc(100vh-120px)] p-4">
                    {sortedItems.length > 0 ? (
                        <div className="space-y-4">
                            {sortedItems.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="bg-slate-800/50 rounded p-4 border border-slate-700/50 hover:border-indigo-500/50 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                                            <p className="text-sm text-gray-400">by {item.author}</p>
                                        </div>
                                        <button
                                            onClick={() => onRemoveFromWishlist(item.id)}
                                            className="text-gray-500 hover:text-red-400 transition-colors"
                                            title="Remove from wishlist"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {item.topics.map((topic, i) => (
                                            <span
                                                key={i}
                                                className="bg-indigo-900/30 text-indigo-300 text-xs px-2 py-1 rounded border border-indigo-800/50"
                                            >
                                                {topic}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500">
                                        Added {new Date(item.added_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            {filterTopic ? 'No matching books found' : 'Your wishlist is empty'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}; 