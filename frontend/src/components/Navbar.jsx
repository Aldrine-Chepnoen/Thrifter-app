import React from 'react';
import { Search, PlusCircle, Camera, Heart, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = ({ onSearch, onImageSearchClick, onOutfitBuilderClick, user, onLogout }) => {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 py-3 px-4 md:py-4 md:px-6 mb-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xl md:text-2xl font-serif font-bold tracking-tight">Thrifter</Link>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={onOutfitBuilderClick}
              className="px-3 py-2 border border-gray-200 rounded-full hover:bg-gray-100 transition-all text-sm flex items-center gap-2 text-purple-600 border-purple-100 bg-purple-50"
              title="Outfit Builder"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Build Outfit</span>
            </button>
            <button 
              onClick={onImageSearchClick}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Upload outfit inspiration"
            >
              <Camera className="w-6 h-6" />
            </button>
            <Link 
              to="/wardrobe" 
              className="px-3 py-2 border border-gray-200 rounded-full hover:bg-gray-100 transition-all text-sm flex items-center gap-2"
              title="Wardrobe"
            >
              <Heart className="w-4 h-4" />
              Wardrobe
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
              className="flex items-center gap-2 bg-black text-white px-3 md:px-4 py-2 rounded-full hover:bg-gray-800 transition-all font-medium text-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Sell Item
            </Link>
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs text-gray-600">{user.email}{user.is_vendor ? ' • Vendor' : ''}</span>
                <button onClick={onLogout} className="px-3 py-1 text-xs border border-gray-200 rounded-full hover:bg-gray-100">Logout</button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 md:mt-4 flex items-center gap-3 md:gap-4">
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
      </div>
    </nav>
  );
};

export default Navbar;
