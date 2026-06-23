import React, { useState, useRef, useEffect } from 'react';
import { Search, Camera, Heart, User, Shield, SlidersHorizontal, Moon, Sun, Menu, X, Sparkles } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { RoughNotation } from 'react-rough-notation';

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.78a4.85 4.85 0 0 1-1-.09z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
);

const ContactDropdown = ({ onClose }) => (
  <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden z-50">
    <p className="px-4 pt-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
      Find us on
    </p>
    <a
      href="https://www.tiktok.com/@thrifter_app?_r=1&_t=ZS-975gP5Z50Uf"
      target="_blank" rel="noopener noreferrer"
      onClick={onClose}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      <TikTokIcon />TikTok
    </a>
    <a
      href="https://www.instagram.com/thrifter.ug?igsh=OWRpa2h6dmRvYXUy"
      target="_blank" rel="noopener noreferrer"
      onClick={onClose}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      <InstagramIcon />Instagram
    </a>
    <a
      href="https://wa.me/256794185787"
      target="_blank" rel="noopener noreferrer"
      onClick={onClose}
      className="flex items-center gap-3 px-4 pb-3 pt-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      <WhatsAppIcon />WhatsApp
    </a>
  </div>
);

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

  const isOwnProfile = user?.is_vendor && location.pathname === `/vendor/${encodeURIComponent(user.vendor_name)}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const desktopMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      const outsideMobile = !mobileMenuRef.current?.contains(e.target);
      const outsideDesktop = !desktopMenuRef.current?.contains(e.target);
      if (outsideMobile && outsideDesktop) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    { label: 'Jerseys',     query: 'jersey'      },
    { label: 'Shirts',      query: 'shirt'       },
    { label: 'Jeans',       query: 'jeans'       },
    { label: 'Sneakers',    query: 'sneakers'    },
    { label: 'Jackets',     query: 'jacket'      },
    { label: 'Hoodies',     query: 'hoodie'      },
    { label: 'Dresses',     query: 'dress'       },
    { label: 'Handbags',    query: 'handbag'     },
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

          {/* Mobile-only: hamburger top-right of logo row, homepage only */}
          {isHomePage && (
            <div ref={mobileMenuRef} className="absolute right-0 md:hidden">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                title="Contact & socials"
              >
                {menuOpen ? <X className="w-4 h-4 text-gray-600" /> : <Menu className="w-4 h-4 text-gray-600" />}
              </button>
              {menuOpen && <ContactDropdown onClose={() => setMenuOpen(false)} />}
            </div>
          )}
        </div>

        {showIcons && (
          <div className="flex items-center justify-around md:justify-end gap-1 md:gap-2">
            <button
              onClick={() => handleProtectedAction('/wardrobe', true)}
              className="flex flex-col items-center gap-1 bg-[#EAAD11] text-black px-2 md:px-4 py-1.5 rounded-xl hover:opacity-90 transition-all font-medium input-shadow"
              title="Wardrobe"
            >
              <span className="text-[10px] md:text-xs tracking-tight">Wardrobe</span>
              <Heart className="w-3.5 h-3.5" />
            </button>

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
              <div className="flex flex-col items-center gap-1 ml-1">
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

            {user?.is_vendor && !isOwnProfile && (
              <Link
                to={`/vendor/${encodeURIComponent(user.vendor_name)}`}
                className="flex flex-col items-center gap-1 bg-[#EAAD11] text-black px-2 md:px-4 py-1.5 rounded-xl hover:opacity-90 transition-all font-medium input-shadow"
                title="My Shop"
              >
                <span className="text-[10px] md:text-xs tracking-tight">My profile</span>
                <User className="w-3.5 h-3.5" />
              </Link>
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

            {/* Desktop-only: hamburger at far right of icons row */}
            <div ref={desktopMenuRef} className="relative hidden md:block">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                title="Contact & socials"
              >
                {menuOpen ? <X className="w-4 h-4 text-gray-600 dark:text-gray-400" /> : <Menu className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
              </button>
              {menuOpen && <ContactDropdown onClose={() => setMenuOpen(false)} />}
            </div>

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
                  className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 transition-all"
                  onChange={(e) => handleSearchInput(e.target.value)}
                />
                <button
                  onClick={() => handleProtectedAction(onImageSearchClick)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#EAAD11] transition-colors"
                  title="Image search"
                >
                  <Camera className="w-4 h-4" />
                </button>
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
                className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 transition-all"
                onChange={(e) => handleSearchInput(e.target.value)}
              />
              <button
                onClick={() => handleProtectedAction(onImageSearchClick)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#EAAD11] transition-colors"
                title="Image search"
              >
                <Camera className="w-4 h-4" />
              </button>
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
