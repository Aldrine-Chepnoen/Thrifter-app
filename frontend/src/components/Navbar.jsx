// This is the Navbar component for the Thrifter frontend application. It provides a navigation bar with links to different pages, a search input for filtering items, and buttons for uploading outfit inspiration, building outfits, and accessing the wardrobe. The component also displays user information and a logout button if the user is logged in. It uses Tailwind CSS for styling and Lucide icons for visual elements. The Navbar is designed to be responsive and sticky at the top of the page for easy access while browsing the application.
import React from 'react';
import { Search, PlusCircle, Camera, Heart, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = ({ onSearch, onImageSearchClick, onOutfitBuilderClick, user, onLogout }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 py-3 px-4 md:py-4 md:px-6 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
        <div className="flex justify-center md:justify-start">
          <Link to="/" className="text-xl md:text-2xl font-serif font-bold tracking-tight">Thrifter</Link>
        </div>
        
        <div className="flex items-center justify-around md:justify-end gap-1 md:gap-4">
          <button 
            onClick={onOutfitBuilderClick}
            className="flex flex-col items-center gap-1 px-2 md:px-4 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-gray-700 font-medium"
            title="Outfit Builder"
          >
            <span className="text-[10px] md:text-xs tracking-tight">Outfit builder</span>
            <Sparkles className="w-4 h-4" />
          </button>
          <button 
            onClick={onImageSearchClick}
            className="flex flex-col items-center gap-1 p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-700"
            title="Upload outfit inspiration"
          >
            <span className="text-[10px] md:text-xs tracking-tight">AI search</span>
            <Camera className="w-5 h-5" />
          </button>
          <Link 
            to="/wardrobe" 
            className="flex flex-col items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-gray-700"
            title="Wardrobe"
          >
            <span className="text-[10px] md:text-xs tracking-tight">Wardrobe</span>
            <Heart className="w-4 h-4" />
          </Link>
          {!user && (
            <Link 
              to="/auth" 
              className="px-3 py-2 border border-gray-200 rounded-full hover:bg-gray-100 transition-all text-sm"
            >
              Login
            </Link>
          )}
          <Link 
            to="/upload" 
            className="flex flex-col items-center gap-1 px-2 md:px-4 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-gray-700 font-medium"
          >
            <span className="text-[10px] md:text-xs tracking-tight">Sell item</span>
            <PlusCircle className="w-4 h-4" />
          </Link>
          {user && (
            <div className="flex flex-col items-center gap-1">
              <span className="hidden lg:inline text-[10px] text-gray-500">{user.is_vendor ? 'Vendor' : 'User'}</span>
              <button onClick={onLogout} className="px-2 py-1 text-[10px] border border-gray-200 rounded-lg hover:bg-gray-100">Logout</button>
            </div>
          )}
        </div>

        {isHomePage && (
          <div className="w-full md:hidden mt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search items..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:ring-black transition-all"
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {isHomePage && (
        <div className="max-w-7xl mx-auto hidden md:block mt-3 md:mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search items..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:ring-black transition-all"
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
