'use client';

import React from 'react';

interface CategoryFilterProps {
    onCategoriesChange: (categories: string[]) => void;
    categories?: string[];
    selectedCategories?: string[];
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ 
    onCategoriesChange,
    categories = ["Technical", "Non-Technical"],
    selectedCategories = []
}) => {
    const handleCategoryClick = (category: string) => {
        if (selectedCategories.includes(category)) {
            onCategoriesChange(selectedCategories.filter(c => c !== category));
        } else {
            onCategoriesChange([...selectedCategories, category]);
        }
    };

    return (
        <div className="mb-6">
            <h3 className="text-xl font-semibold mb-4 text-white">Filter by Category</h3>
            <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                    <button
                        key={category}
                        onClick={() => handleCategoryClick(category)}
                        className={`px-4 py-2 rounded-full transition-colors ${
                            selectedCategories.includes(category)
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-gray-300 hover:bg-indigo-900'
                        }`}
                    >
                        {category}
                    </button>
                ))}
            </div>
        </div>
    );
}; 