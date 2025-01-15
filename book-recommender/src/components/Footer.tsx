import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="mt-auto py-8 border-t border-gray-800">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
                    <div>
                        © Copyright 2025 <a href="https://vishsubramanian.me" className="text-primary hover:text-primary/80 transition-colors">vishsubramanian.me</a>
                    </div>
                    <div className="mt-4 md:mt-0 space-x-6">
                        <a href="/terms" className="hover:text-primary transition-colors">Terms Of Service</a>
                        <a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}; 