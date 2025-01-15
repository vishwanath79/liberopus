'use client';

import Link from 'next/link';

export const Navbar: React.FC = () => {
    return (
        <nav className="bg-card/50 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo/Home */}
                    <div className="flex-shrink-0">
                        <Link href="/" className="text-xl font-bold">
                            <span className="gradient-text">LIBER OPUS</span>
                        </Link>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex space-x-8">
                        <a
                            href="https://vishsubramanian.me"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-primary transition-colors"
                        >
                            About
                        </a>
                        <a
                            href="https://github.com/vishwanath79"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-primary transition-colors"
                        >
                            Docs
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    );
}; 