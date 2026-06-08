// This is the Navbar component for the Thrifter frontend application. It provides a navigation bar with links to different pages, a search input for filtering items, and buttons for uploading outfit inspiration, building outfits, and accessing the wardrobe. The component also displays user information and a logout button if the user is logged in. It uses Tailwind CSS for styling and Lucide icons for visual elements. The Navbar is designed to be responsive and sticky at the top of the page for easy access while browsing the application.
import React, { useState } from 'react';
import { Search, PlusCircle, Camera, Heart, User, Shield, SlidersHorizontal, Moon, Sun } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { RoughNotation } from 'react-rough-notation';

const Navbar = ({
  onSearch,
  onImageSearchClick,
  user,
  onLogout,
  features,
  openAuthModal,
  hidden,
  feedType,
  onFeedTypeChange,
  onFilterClick,
  hasActiveFilters,
  darkMode,
  toggleDarkMode,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/';
  const showIcons = isHomePage;

  // Check if current page is the user's own vendor profile
  const isOwnProfile = user?.is_vendor && location.pathname === `/vendor/${encodeURIComponent(user.vendor_name)}`;

  const handleProtectedAction = (action, isPath = false) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (isPath) {
      navigate(action);
    } else {
      action();
    }
  };

  const handleLogoClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [activeTag, setActiveTag] = useState(null);

  const quickTags = [
    { label: 'Jerseys',   query: 'jersey'   },
    { label: 'Shirts',    query: 'shirt'    },
    { label: 'Jeans',     query: 'jeans'    },
    { label: 'Sneakers',  query: 'sneakers' },
    { label: 'Jackets',   query: 'jacket'   },
    { label: 'Hoodies',   query: 'hoodie'   },
    { label: 'Dresses',   query: 'dress'    },
    { label: 'Handbags',  query: 'handbag'  },
    { label: 'Accessories', query: 'accessories' },
  ];

  const handleTagClick = (query) => {
    if (activeTag === query) {
      setActiveTag(null);
      onSearch('');
    } else {
      setActiveTag(query);
      onSearch(query);
    }
  };

  const handleSearchInput = (value) => {
    if (activeTag) setActiveTag(null);
    onSearch(value);
  };

  return (
    <motion.nav 
      variants={{
        visible: { y: 0 },
        hidden: { y: "-100%" },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 py-3 px-4 md:py-4 md:px-6"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
        <div className="relative flex items-center justify-center w-full md:w-auto">
          <Link 
            to="/" 
            onClick={handleLogoClick}
            className="text-xl md:text-2xl font-serif font-bold tracking-tight text-[#EAAD11]"
          >
            Thrifter
          </Link>

          {/* Mobile Profile Button (Visible only to vendors not on their own profile) */}
          {user?.is_vendor && !isOwnProfile && (
            <Link 
              to={`/vendor/${encodeURIComponent(user.vendor_name)}`}
              className="absolute right-0 md:hidden p-2 bg-[#EAAD11] text-black rounded-full hover:opacity-90 transition-all input-shadow"
              title="My Profile"
            >
              <User className="w-5 h-5" />
            </Link>
          )}
        </div>
        
        {showIcons && (
          <div className="flex items-center justify-around md:justify-end gap-1 md:gap-2">
            <button
              onClick={() => handleProtectedAction(onImageSearchClick)}
              className="flex flex-col items-center gap-1 bg-[#EAAD11] text-black px-2 md:px-4 py-1.5 rounded-xl hover:opacity-90 transition-all font-medium input-shadow"
              title="Upload outfit inspiration"
            >
              <span className="text-[10px] md:text-xs tracking-tight">Image search</span>
              <Camera className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => handleProtectedAction('/wardrobe', true)}
              className="flex flex-col items-center gap-1 bg-[#EAAD11] text-black px-2 md:px-4 py-1.5 rounded-xl hover:opacity-90 transition-all font-medium input-shadow"
              title="Wardrobe"
            >
              <span className="text-[10px] md:text-xs tracking-tight">Wardrobe</span>
              <Heart className="w-3.5 h-3.5" />
            </button>

            {/* Desktop Profile Button (Visible only if not on own profile) */}
            {user?.is_vendor && !isOwnProfile && (
              <Link 
                to={`/vendor/${encodeURIComponent(user.vendor_name)}`}
                className="hidden md:flex flex-col items-center gap-1 bg-[#EAAD11] text-black px-2 md:px-4 py-1.5 rounded-xl hover:opacity-90 transition-all font-medium input-shadow"
                title="My Shop"
              >
                <span className="text-[10px] md:text-xs tracking-tight">My profile</span>
                <User className="w-3.5 h-3.5" />
              </Link>
            )}

            {user?.is_admin && (
              <Link
                to="/admin"
                className="flex flex-col items-center gap-1 bg-[#EAAD11] text-black px-2 md:px-4 py-1.5 rounded-xl hover:opacity-90 transition-all font-medium input-shadow banner-text-shadow"
                title="Admin Dashboard"
              >
                <span className="text-[10px] md:text-xs tracking-tight">Admin</span>
                <Shield className="w-3.5 h-3.5" />
              </Link>
            )}

            {user ? (
              <div className="flex flex-col items-center gap-1 ml-2">
                <span className="hidden lg:inline text-[10px] text-gray-500 font-medium">{user.is_vendor ? 'Vendor' : 'User'}</span>
                <button
                  onClick={onLogout}
                  className="px-3 py-1.5 bg-[#EAAD11] text-black font-bold rounded-lg hover:opacity-90 text-[10px] transition-all input-shadow banner-text-shadow"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="bg-[#EAAD11] text-black px-4 py-2 rounded-xl hover:opacity-90 transition-all font-bold text-sm ml-2 input-shadow"
              >
                Login
              </button>
            )}

            <button
              onClick={toggleDarkMode}
              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ml-1"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode
                ? <Sun className="w-4 h-4 text-[#EAAD11]" />
                : <Moon className="w-4 h-4 text-gray-600" />
              }
            </button>
          </div>
        )}

        {isHomePage && (
          <div className="w-full md:hidden mt-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 input-shadow rounded-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search items or categories..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 transition-all"
                  onChange={(e) => handleSearchInput(e.target.value)}
                />
              </div>
              <button
                onClick={onFilterClick}
                className="relative flex-shrink-0 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full input-shadow hover:border-gray-400 dark:hover:border-gray-500 transition-all"
                title="Filter"
              >
                <SlidersHorizontal className={`w-4 h-4 ${hasActiveFilters ? 'text-black' : 'text-gray-500'}`} />
                {hasActiveFilters && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#EAAD11] rounded-full" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {isHomePage && (
        <>
          <div className="max-w-7xl mx-auto hidden md:flex md:items-center md:gap-2 mt-3 md:mt-4">
            <div className="relative flex-1 input-shadow rounded-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search items or categories..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 transition-all"
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>
            <button
              onClick={onFilterClick}
              className="relative flex-shrink-0 p-2.5 bg-white border border-gray-200 rounded-full input-shadow hover:border-gray-400 transition-all"
              title="Filter"
            >
              <SlidersHorizontal className={`w-4 h-4 ${hasActiveFilters ? 'text-black' : 'text-gray-500'}`} />
              {hasActiveFilters && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#EAAD11] rounded-full" />
              )}
            </button>
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
            {quickTags.map((tag) => (
              <button
                key={tag.label}
                onClick={() => handleTagClick(tag.query)}
                className={`whitespace-nowrap flex-shrink-0 px-3 py-1 rounded-full border text-[10px] md:text-xs font-medium transition-all ${
                  activeTag === tag.query
                    ? 'bg-[#EAAD11] border-[#EAAD11] text-black'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-8 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => onFeedTypeChange('for_you')}
              className={`pb-2 px-2 text-sm font-bold transition-all relative ${feedType === 'for_you' ? 'text-black dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              <RoughNotation type="underline" show={feedType === 'for_you'} color="#EAAD11" strokeWidth={3} iterations={3} padding={2} animationDuration={600}>
                For You
              </RoughNotation>
            </button>
            <button
              onClick={() => onFeedTypeChange('latest')}
              className={`pb-2 px-2 text-sm font-bold transition-all relative ${feedType === 'latest' ? 'text-black dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              <RoughNotation type="underline" show={feedType === 'latest'} color="#EAAD11" strokeWidth={3} iterations={3} padding={2} animationDuration={600}>
                Latest
              </RoughNotation>
            </button>
            {features?.promo_10k_enabled && (
              <button
                onClick={() => onFeedTypeChange('promo')}
                className={`pb-2 px-2 text-sm font-bold transition-all relative ${feedType === 'promo' ? 'text-black dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                <RoughNotation type="underline" show={feedType === 'promo'} color="#EAAD11" strokeWidth={3} iterations={3} padding={2} animationDuration={600}>
                  10k Promotion
                </RoughNotation>
              </button>
            )}
          </div>
        </>
      )}
    </motion.nav>
  );
};

export default Navbar;
