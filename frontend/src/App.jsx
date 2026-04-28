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
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import posthog from 'posthog-js';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';

function App() {
  const [items, setItems] = useState([]);
  const [outfitResults, setOutfitResults] = useState(null);
  const [builderResults, setBuilderResults] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [features, setFeatures] = useState({ outfit_builder: true });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedSeed, setFeedSeed] = useState(null);
  const [feedType, setFeedType] = useState('random'); // 'random' (For You) or 'latest'
  const fileInputRef = useRef(null);
  const builderInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const navigate = useNavigate();

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
      if (activeType === 'random' && activeSeed !== null) url += `&seed=${activeSeed}`;

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
    if (newType === feedType) return;
    setFeedType(newType);
    setItems([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchItems(true, feedSeed, newType);
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
          // Identify user in PostHog
          if (me.data) {
            posthog.identify(me.data.id, {
              email: me.data.email,
              is_vendor: me.data.is_vendor,
              vendor_name: me.data.vendor_name
            });
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

  const handleSearch = (query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const rid = ++requestIdRef.current;
      setOutfitResults(null);
      setBuilderResults(null);
      
      if (!query) {
        if (location.pathname !== '/') navigate('/');
        fetchItems();
        return;
      }

      setLoading(true);
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

    setLoading(true);
    setBuilderResults(null);
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

  const handleBuilderUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    setOutfitResults(null);
    try {
      const response = await api.post('/outfit-builder', formData);
      setBuilderResults(response.data.outfits);
      posthog.capture('outfit_builder_performed', { 
        outfit_count: response.data.outfits.length 
      });
      navigate('/outfit-builder');
    } catch (error) {
      console.error('Outfit builder failed:', error);
      alert('Outfit builder failed');
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  };
  
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
  const removeFromWardrobe = async (id) => {
    setLoading(true);
    try {
      await api.delete(`/wardrobe/${id}`);
      setWardrobeItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to remove from wardrobe';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === '/wardrobe' && user) {
      fetchWardrobe();
    }
  }, [location.pathname, user]);

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    const filename = path.split(/[\\/]/).pop();
    return `${base}/images/${filename}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar 
        onSearch={handleSearch} 
        onImageSearchClick={handleImageSearchClick} 
        onOutfitBuilderClick={() => builderInputRef.current.click()}
        user={user}
        onLogout={() => { localStorage.removeItem('thrifter_token'); setUser(null); }}
        features={features}
        openAuthModal={openAuthModal}
        hidden={headerHidden}
        feedType={feedType}
        onFeedTypeChange={handleFeedTypeChange}
      />
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleImageUpload}
      />
      <input 
        type="file" 
        ref={builderInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleBuilderUpload}
      />

      <Routes>
        <Route path="/" element={
          <main className="max-w-7xl mx-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
              </div>
            ) : outfitResults ? (
              <>
                <div className="px-6 mb-4 mt-4">
                  <h2 className="text-xl font-serif font-bold">Similar Items</h2>
                </div>
                <MasonryGrid items={outfitResults} onItemClick={setSelectedItem} />
              </>
            ) : items.length > 0 ? (              <>
                <div className="mt-4">
                  <MasonryGrid items={items} onItemClick={setSelectedItem} />
                </div>
                {loadingMore && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                  </div>
                )}
                {!hasMore && items.length > 5 && (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-sm font-serif italic">You've reached the end of the collection.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-gray-500">
                <p className="mb-2">No items found.</p>
                <p className="text-sm">Try searching by style or brand, upload an inspiration image, or browse vendors above.</p>
              </div>
            )}
          </main>
        } />
        
        <Route path="/upload" element={user ? <UploadForm /> : <Navigate to="/" replace />} />
        <Route path="/vendor/:name" element={
          <VendorPage 
            setSelectedItem={setSelectedItem} 
            user={user} 
            onItemDeleted={fetchItems} 
          />
        } />
        <Route path="/outfit-builder" element={
          <main className="max-w-7xl mx-auto px-6">
            <div className="mb-8">
              <h2 className="text-2xl font-serif font-bold mb-2">Outfit Builder</h2>
              <p className="text-gray-600">Based on your inspiration, we've matched these pieces from our collection.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
              </div>
            ) : builderResults && builderResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {builderResults.map((outfit, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Option {idx + 1}</span>
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full">Match Score: {Math.round(outfit.score * 100)}%</span>
                    </div>
                    
                    {outfit.type === 'combination' ? (
                      <div className="space-y-4">
                        <div 
                          onClick={() => setSelectedItem(outfit.top)}
                          className="cursor-pointer group"
                        >
                          <div className="aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 mb-2">
                            <img 
                              src={getImageUrl(outfit.top.image_path)} 
                              alt={outfit.top.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                          <p className="text-sm font-medium line-clamp-1">{outfit.top.name}</p>
                          <p className="text-xs text-gray-500">Top • UGX{outfit.top.price.toLocaleString()}</p>
                        </div>
                        
                        <div className="flex justify-center">
                          <PlusCircle className="w-5 h-5 text-gray-300" />
                        </div>

                        <div 
                          onClick={() => setSelectedItem(outfit.bottom)}
                          className="cursor-pointer group"
                        >
                          <div className="aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 mb-2">
                            <img 
                              src={getImageUrl(outfit.bottom.image_path)} 
                              alt={outfit.bottom.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                          <p className="text-sm font-medium line-clamp-1">{outfit.bottom.name}</p>
                          <p className="text-xs text-gray-500">Bottom • UGX{outfit.bottom.price.toLocaleString()}</p>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => setSelectedItem(outfit.item)}
                        className="cursor-pointer group"
                      >
                        <div className="aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 mb-2">
                          <img 
                            src={getImageUrl(outfit.item.image_path)} 
                            alt={outfit.item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <p className="text-sm font-medium line-clamp-1">{outfit.item.name}</p>
                        <p className="text-xs text-gray-500">Dress • UGX{outfit.item.price.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">
                <p className="mb-4">Upload an inspiration image to build an outfit.</p>
                <button 
                  onClick={() => builderInputRef.current.click()}
                  className="bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 transition-all font-medium"
                >
                  Upload Inspiration
                </button>
              </div>
            )}
          </main>
        } />
        <Route path="/wardrobe" element={user ? (
          <main className="max-w-7xl mx-auto">
            <div className="px-6 mb-4 flex items-center justify-between">
              <h2 className="text-xl font-serif font-bold">Wardrobe</h2>
              <button 
                onClick={fetchWardrobe}
                className="px-3 py-2 border border-gray-200 rounded-full hover:bg-gray-100 transition-all text-sm"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
              </div>
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
        onAuthed={setUser}
      />

      <ProductModal 
        item={selectedItem} 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)}
        user={user}
        onDeleted={() => { fetchItems(); }}
        isWardrobe={location.pathname === '/wardrobe'}
        openAuthModal={openAuthModal}
      />
    </div>
  );
}

export default App;
