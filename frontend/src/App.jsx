// This is the main App component for the Thrifter frontend application. It manages the overall state of the application, including the list of items, search results, user authentication, and interactions with the backend API. The component uses React Router for navigation between different pages such as the home page, upload form, authentication page, vendor page, outfit builder, and wardrobe. It also handles file uploads for image-based searches and outfit building, and it displays a product modal when an item is clicked. The App component integrates various child components like Navbar, MasonryGrid, ProductModal, UploadForm, Auth, and VendorPage to create a cohesive user experience for browsing and managing thrifted fashion items.
import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle } from 'lucide-react';
import Navbar from './components/Navbar';
import MasonryGrid from './components/MasonryGrid';
import ProductModal from './components/ProductModal';
import UploadForm from './components/UploadForm';
import AuthModal from './components/AuthModal';
import api from './api';
import VendorPage from './components/VendorPage';
import AdminDashboard from './components/AdminDashboard';
import FilterSheet from './components/FilterSheet';
import ThrifterLoader from './components/ThrifterLoader';
import SurveyPopup from './components/SurveyPopup';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { onImageHostChange } from './imageHost';
import posthog from 'posthog-js';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

import StyleDiscovery from './components/StyleDiscovery';
import StyleModal from './components/StyleModal';
import StyleBuilder from './components/StyleBuilder';
import DemandBoard from './components/DemandBoard';

function App() {
  const [items, setItems] = useState([]);
  const [outfitResults, setOutfitResults] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [features, setFeatures] = useState({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedSeed, setFeedSeed] = useState(null);
  const [feedType, setFeedType] = useState('for_you');
  const [activeFilters, setActiveFilters] = useState({ minPrice: null, maxPrice: null });
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);
  const [showSurvey, setShowSurvey] = useState(false);
  const [activeStyle, setActiveStyle] = useState(null);
  const [isBuilderMode, setIsBuilderMode] = useState(false);
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [activeStyleForModal, setActiveStyleForModal] = useState(null);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [wardrobeIds, setWardrobeIds] = useState(new Set());
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('thrifter_dark_mode');
    const isDark = saved !== null ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    return isDark;
  });
  // Bump when the R2 reachability verdict flips so every mounted <img>
  // re-resolves its src through getImageSrc (see imageHost.js)
  const [, setImageHostTick] = useState(0);
  useEffect(() => onImageHostChange(() => setImageHostTick((t) => t + 1)), []);
  const activeFiltersRef = useRef({ minPrice: null, maxPrice: null });
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();

  const [headerHidden, setHeaderHidden] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    if (latest > previous && latest > 150) {
      setHeaderHidden(true);
    } else {
      setHeaderHidden(false);
    }
  });

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('thrifter_dark_mode', String(next));
      return next;
    });
  };

  const openAuthModal = () => setIsAuthModalOpen(true);

  const fetchItems = async (isNew = true, currentSeed = null, type = null) => {
    const activeType = type || feedType;
    if (!isNew && (loadingMore || !hasMore)) return;

    if (isNew && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (isNew) {
      abortControllerRef.current = new AbortController();
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const rid = ++requestIdRef.current;
    const currentPage = isNew ? 0 : page;
    const limit = 20;
    const activeSeed = currentSeed !== null ? currentSeed : feedSeed;

    try {
      let url = `/items?skip=${currentPage * limit}&limit=${limit}&sort=${activeType}`;
      if ((activeType === 'random' || activeType === 'for_you') && activeSeed !== null) url += `&seed=${activeSeed}`;
      const { minPrice, maxPrice } = activeFiltersRef.current;
      if (minPrice !== null) url += `&min_price=${minPrice}`;
      if (maxPrice !== null) url += `&max_price=${maxPrice}`;

      const response = await api.get(url, {
        signal: isNew ? abortControllerRef.current.signal : undefined
      });
      
      if (rid !== requestIdRef.current) return;

      const newItems = response.data;
      if (isNew) {
        setItems(newItems);
        setPage(1);
      } else {
        setItems(prev => [...prev, ...newItems]);
        setPage(currentPage + 1);
      }
      setHasMore(newItems.length === limit);
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error('Error fetching items:', error);
      }
    } finally {
      if (rid === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const handleFeedTypeChange = (newType) => {
    if (newType === feedType && !outfitResults) return;
    setOutfitResults(null);
    setFeedType(newType);
    setItems([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (newType !== 'polls') fetchItems(true, feedSeed, newType);
  };

  const handleFiltersApply = (filters) => {
    activeFiltersRef.current = filters;
    setActiveFilters(filters);
    setItems([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchItems(true, feedSeed, feedType);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        if (!loading && !loadingMore && hasMore && !outfitResults && items.length > 0) {
          fetchItems(false);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, items.length, outfitResults, feedSeed, page]);

  useEffect(() => {
    const seed = Math.random() * 2 - 1; // Range -1 to 1 for Postgres setseed
    setFeedSeed(seed);
    fetchItems(true, seed);
    // ... rest of init logic ...
    (async () => {
      setAuthLoading(true);
      
      // Fetch feature flags
      try {
        const fres = await api.get('/features');
        setFeatures(fres.data);
      } catch (e) {
        console.error('Failed to fetch features', e);
      }

      const token = localStorage.getItem('thrifter_token');
      if (token) {
        try {
          const me = await api.get('/auth/me');
          setUser(me.data);
          if (me.data) {
            posthog.identify(me.data.id, {
              email: me.data.email,
              is_vendor: me.data.is_vendor,
              vendor_name: me.data.vendor_name
            });
            api.get('/wardrobe').then(wr => {
              setWardrobeIds(new Set(wr.data.map(i => i.id)));
            }).catch(() => {});
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem(`survey_seen_${user.id}`)) return;
    if (sessionStorage.getItem(`survey_dismissed_${user.id}`)) return;
    const t = setTimeout(() => setShowSurvey(true), 1000);
    return () => clearTimeout(t);
  }, [user?.id]);

  const handleSurveyDismiss = () => {
    if (user?.id) sessionStorage.setItem(`survey_dismissed_${user.id}`, 'true');
    setShowSurvey(false);
  };

  const handleSearch = (query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query) {
      setOutfitResults(null);
      setItems([]);
      setLoading(true);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const rid = ++requestIdRef.current;

      if (!query) {
        setOutfitResults(null);
        if (location.pathname !== '/') navigate('/');
        fetchItems();
        return;
      }

      try {
        const response = await api.get(`/search?query=${query}`, {
          signal: abortControllerRef.current.signal
        });
        if (rid !== requestIdRef.current) return;
        setItems(response.data);
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error('Search failed:', error);
        }
      } finally {
        if (rid === requestIdRef.current) setLoading(false);
      }
    }, 500);
  };
  
  const handleFilterByVendor = async (vendor) => {
    await fetchItems(vendor);
  };

  const handleImageSearchClick = () => {
    fileInputRef.current.click();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setItems([]);
    setOutfitResults(null);
    setLoading(true);
    try {
      const response = await api.post('/outfit-search', formData);
      setOutfitResults(response.data);
      posthog.capture('image_search_performed', { 
        result_count: response.data.length 
      });
      navigate('/');
    } catch (error) {
      console.error('Image search failed:', error);
      alert('Image search failed');
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  };

  useEffect(() => {
    if (location.state?.autoBuildStyle) {
      setActiveStyle(location.state.autoBuildStyle);
      setIsBuilderMode(true);
      // Clear state so it doesn't re-trigger on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const [wardrobeItems, setWardrobeItems] = useState([]);
  const fetchWardrobe = async () => {
    setLoading(true);
    try {
      const res = await api.get('/wardrobe');
      setWardrobeItems(res.data);
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to load wardrobe';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };
  const fetchWardrobeIds = async () => {
    try {
      const res = await api.get('/wardrobe');
      setWardrobeIds(new Set(res.data.map(item => item.id)));
    } catch { /* ignore */ }
  };

  const addToWardrobe = async (id, isSaved) => {
    if (!user) { openAuthModal(); throw new Error('not authed'); }
    if (isSaved) {
      await api.delete(`/wardrobe/${id}`);
      setWardrobeIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      await api.post(`/wardrobe/${id}`);
      setWardrobeIds(prev => new Set([...prev, id]));
    }
  };

  const removeFromWardrobe = async (id) => {
    setWardrobeItems(prev => prev.filter(i => i.id !== id));
    setWardrobeIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    try {
      await api.delete(`/wardrobe/${id}`);
    } catch (e) {
      fetchWardrobe();
      const msg = e?.response?.data?.detail || 'Failed to remove from wardrobe';
      alert(msg);
    }
  };
  
  useEffect(() => {
    if (location.pathname === '/wardrobe' && user) {
      fetchWardrobe();
    }
    if (location.pathname !== '/outfit-builder') {
      setIsBuilderMode(false);
    }
    // Check if we navigated here from Admin with a specific style to build
    if (location.pathname === '/outfit-builder' && location.state?.autoBuildStyle) {
      setActiveStyle(location.state.autoBuildStyle);
      setIsBuilderMode(true);
      // Clear state so it doesn't re-trigger on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.pathname, user, location.state]);

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    const filename = path.split(/[\\/]/).pop();
    return `${base}/images/${filename}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <ThrifterLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100">
      {!(isBuilderMode && location.pathname === '/outfit-builder') && (
        <Navbar
          onSearch={handleSearch}
          onImageSearchClick={handleImageSearchClick}
          user={user}
          onLogout={() => {
            if (user?.id) sessionStorage.removeItem(`survey_dismissed_${user.id}`);
            localStorage.removeItem('thrifter_token');
            setUser(null);
            setWardrobeIds(new Set());
          }}
          features={features}
          openAuthModal={openAuthModal}
          hidden={headerHidden}
          feedType={feedType}
          onFeedTypeChange={handleFeedTypeChange}
          onFilterClick={() => setIsFilterSheetOpen(true)}
          hasActiveFilters={activeFilters.minPrice !== null || activeFilters.maxPrice !== null}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleImageUpload}
      />

      <Routes>
        <Route path="/" element={
          <main className="max-w-7xl mx-auto">
            {outfitResults ? (
              <>
                <div className="px-6 mb-4 mt-4 flex items-center justify-between">
                  <h2 className="text-xl font-serif font-bold">Similar Items</h2>
                  <button
                    onClick={() => { setOutfitResults(null); fetchItems(true, feedSeed, feedType); }}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    ← Back to feed
                  </button>
                </div>
                <MasonryGrid items={outfitResults} onItemClick={setSelectedItem} onAddToWardrobe={addToWardrobe} wardrobeIds={wardrobeIds} />
              </>
            ) : feedType === 'polls' ? (
              <DemandBoard user={user} onAuthRequired={() => setIsAuthModalOpen(true)} />
            ) : (
              <>
                {/* Homepage Banner */}
                <div className="px-4 md:px-6 mb-8 mt-2">
                  <div className="relative h-[150px] md:h-[130px] w-full bg-gradient-to-r from-[#D2850F] via-[#F4BD13] to-[#FAF6B5] rounded-2xl overflow-hidden input-shadow flex items-center justify-between px-8 md:px-12 border border-[#EAAD11]/20">
                    <div className="z-10 max-w-[65%] banner-text-shadow">
                      <h2 className="text-xl md:text-3xl font-serif font-bold text-white leading-tight">
                        Secure your next fit.
                      </h2>
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] md:text-xs text-white font-medium">
                          Discover fashion around Kampala
                        </p>
                        <p className="text-[10px] md:text-xs text-white font-medium">
                          Thrift stores, Clothing brands, Fashion Designers
                        </p>
                        <p className="text-[9px] md:text-[10px] text-white/90 font-medium italic pt-1 border-t border-white/10 mt-1">
                          Tip: Add items to your wardrobe for a personalized 'For You' feed.
                        </p>
                      </div>
                    </div>
                    <div className="absolute right-0 bottom-0 h-full w-[45%] md:w-[40%] flex items-end justify-end pointer-events-none">
                      <img
                        src="https://res.cloudinary.com/dqhcuxgu9/image/upload/w_400,q_auto,f_auto,c_limit/v1782600189/homepage-banner_c6nneb.png"
                        alt="Fashion showcase"
                        className="h-[120%] w-full object-contain object-bottom transform translate-y-[10%]"
                      />
                    </div>
                    <div className="absolute inset-0 bg-[url('/banner-texture.svg')] opacity-5 pointer-events-none"></div>
                  </div>
                </div>

                {loading ? (
                  <ThrifterLoader />
                ) : items.length > 0 ? (
                  <div className="mt-4">
                    <MasonryGrid items={items} onItemClick={setSelectedItem} onAddToWardrobe={addToWardrobe} wardrobeIds={wardrobeIds} />
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500">
                    <p className="mb-2">No items found.</p>
                    <p className="text-sm">Try searching by style or brand, upload an inspiration image, or browse vendors above.</p>
                  </div>
                )}
                
                {loadingMore && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#EAAD11]"></div>
                  </div>
                )}
                {!hasMore && items.length > 5 && (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-sm font-serif italic">You've reached the end of the collection.</p>
                  </div>
                )}
              </>
            )}
          </main>
        } />
        
        <Route path="/upload" element={user ? <UploadForm /> : <Navigate to="/" replace />} />
        <Route path="/demand-board" element={
          <DemandBoard user={user} onAuthRequired={() => setIsAuthModalOpen(true)} />
        } />
        <Route path="/vendor/:name" element={
          <VendorPage
            setSelectedItem={setSelectedItem}
            user={user}
            onItemDeleted={fetchItems}
            refreshKey={vendorRefreshKey}
            onVendorRenamed={(newName) => setUser(prev => ({ ...prev, vendor_name: newName }))}
          />
        } />
        <Route path="/outfit-builder" element={
          <main className="max-w-7xl mx-auto">
            {isBuilderMode && activeStyle ? (
              <StyleBuilder
                style={activeStyle}
                onBack={() => { setIsBuilderMode(false); window.scrollTo(0, 0); }}
                onSelectItem={setSelectedItem}
              />
            ) : (
              <div className="px-6 py-8">
                <div className="mb-10 text-center max-w-2xl mx-auto">
                  <h2 className="text-3xl font-serif font-bold mb-3">Outfit Builder</h2>
                  <p className="text-gray-600 dark:text-gray-400">Discover your next aesthetic. Our AI analyzes thousands of items to find the perfect style clusters for you.</p>
                </div>
                
                <StyleDiscovery 
                  onOpenModal={(style) => {
                    setActiveStyleForModal(style);
                    setStyleModalOpen(true);
                  }} 
                />
              </div>
            )}
          </main>
        } />
        <Route path="/admin" element={
          user?.is_admin
            ? <AdminDashboard user={user} onOutfitBuilderClick={() => navigate('/outfit-builder')} />
            : <Navigate to="/" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/wardrobe" element={user ? (
          <main className="max-w-7xl mx-auto">
            <div className="px-6 mb-4 flex items-center justify-between">
              <h2 className="text-xl font-serif font-bold">Wardrobe</h2>
              {!loading && wardrobeItems.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span><span className="font-semibold text-gray-900 dark:text-gray-100">{wardrobeItems.length}</span> items</span>
                  <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
                  <span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      UGX {wardrobeItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0).toLocaleString('en-UG')}
                    </span> total
                  </span>
                </div>
              )}
            </div>
            {loading ? (
              <ThrifterLoader />
            ) : wardrobeItems.length > 0 ? (
              <MasonryGrid items={wardrobeItems} onItemClick={setSelectedItem} onRemove={removeFromWardrobe} />
            ) : (
              <div className="text-center py-20 text-gray-500">
                <p className="mb-2">Your wardrobe is empty.</p>
                <p className="text-sm">Add items from search results or listings.</p>
              </div>
            )}
          </main>
        ) : <Navigate to="/" replace />} />
      </Routes>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthed={(userData) => {
          setUser(userData);
          fetchWardrobeIds();
          setShowWelcomeToast(true);
          setTimeout(() => setShowWelcomeToast(false), 2000);
        }}
      />

      <AnimatePresence>
        {showWelcomeToast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 left-0 right-0 mx-auto w-fit z-[200] bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-5 py-3 rounded-full shadow-xl"
          >
            Welcome back to Thrifter
          </motion.div>
        )}
      </AnimatePresence>

      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        activeFilters={activeFilters}
        onApply={handleFiltersApply}
      />

      {showSurvey && (
        <SurveyPopup user={user} onDismiss={handleSurveyDismiss} />
      )}

      <AnimatePresence>
        {styleModalOpen && activeStyleForModal && (
          <StyleModal
            style={activeStyleForModal}
            onClose={() => setStyleModalOpen(false)}
            onBuild={(style) => {
              setActiveStyle(style);
              setIsBuilderMode(true);
              setStyleModalOpen(false);
              window.scrollTo(0, 0);
            }}
          />
        )}
      </AnimatePresence>

      <ProductModal 
        item={selectedItem} 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)}
        user={user}
        onDeleted={() => { fetchItems(); setVendorRefreshKey(k => k + 1); }}
        onUpdated={(updatedItem) => {
          setSelectedItem(null);
          fetchItems();
          setVendorRefreshKey(k => k + 1);
        }}
        isWardrobe={location.pathname === '/wardrobe'}
        openAuthModal={openAuthModal}
      />
    </div>
  );
}

export default App;
