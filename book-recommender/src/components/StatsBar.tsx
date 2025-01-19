'use client';

export const StatsBar: React.FC<{
    totalBooks: number;
    averageRating: number;
    wishlistCount: number;
    onWishlistClick: () => void;
}> = ({ totalBooks, averageRating, wishlistCount, onWishlistClick }) => {
    return (
        <div className="bg-card/50 backdrop-blur-sm border-y border-gray-800 py-4 mb-8">
            <div className="max-w-7xl mx-auto px-4 flex justify-around">
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{totalBooks}</div>
                    <div className="text-sm text-gray-400">Total Books</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{averageRating}</div>
                    <div className="text-sm text-gray-400">Average Rating</div>
                </div>
                <button 
                    onClick={onWishlistClick}
                    className="text-center hover:text-primary transition-colors"
                >
                    <div className="text-2xl font-bold">{wishlistCount}</div>
                    <div className="text-sm text-gray-400">Wishlist</div>
                </button>
            </div>
        </div>
    );
};