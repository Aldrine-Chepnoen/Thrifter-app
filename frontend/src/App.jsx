// This is the main App component for the Thrifter frontend application. It manages the overall state of the application, including the list of items, search results, user authentication, and interactions with the backend API. The component uses React Router for navigation between different pages such as the home page, upload form, authentication page, vendor page, outfit builder, and wardrobe. It also handles file uploads for image-based searches and outfit building, and it displays a product modal when an item is clicked. The App component integrates various child components like Navbar, MasonryGrid, ProductModal, UploadForm, Auth, and VendorPage to create a cohesive user experience for browsing and managing thrifted fashion items.
import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle } from 'lucide-react';
import Navbar from './components/Navbar';
import MasonryGrid from './components/MasonryGrid';
import ProductModal from './components/ProductModal';
import UploadForm from './components/UploadForm';
import Auth from './components/Auth';
import api from './api';
import VendorPage from './components/VendorPage';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

function App() {
  const [items, setItems] = useState([]);
  const [outfitResults, setOutfitResults] = useState(null);
  const [builderResults, setBuilderResults] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const fileInputRef = useRef(null);
  const builderInputRef = useRef(null);
  const navigate = useNavigate();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await api.get('/items');
      const shuffled = [...response.data].sort(() => Math.random() - 0.5);
      setItems(shuffled);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    (async () => {
      setAuthLoading(true);
      const token = localStorage.getItem('thrifter_token');
      if (token) {
        try {
          const me = await api.get('/auth/me');
          setUser(me.data);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    })();
  }, []);

  const handleSearch = async (query) => {
    setOutfitResults(null);
    setBuilderResults(null);
    if (!query) {
      if (location.pathname !== '/') navigate('/');
      fetchItems();
      return;
    }
    try {
      const response = await api.get(`/search?query=${query}`);
      setItems(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    }
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
    if (location.pathname === '/wardrobe') {
      fetchWardrobe();
    }
  }, [location.pathname]);

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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 overflow-x-hidden">
      {location.pathname === '/auth' ? (
        <header className="py-10 flex justify-center mb-6">
          <h1 className="text-4xl font-serif font-bold tracking-tight text-gray-900">Thrifter</h1>
        </header>
      ) : (
        <Navbar 
          onSearch={handleSearch} 
          onImageSearchClick={handleImageSearchClick} 
          onOutfitBuilderClick={() => builderInputRef.current.click()}
          user={user}
          onLogout={() => { localStorage.removeItem('thrifter_token'); setUser(null); }}
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
      <input 
        type="file" 
        ref={builderInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleBuilderUpload}
      />

      <Routes>
        <Route path="/" element={
          !user ? <Navigate to="/auth" replace /> :
          <main className="max-w-7xl mx-auto">
            <div className="px-6 mb-4">
              <p className="text-xs text-gray-500">Tip: Click the camera to upload outfit inspiration and find similar items.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
              </div>
            ) : outfitResults ? (
              <>
                {(outfitResults.order || ['tops','bottoms','dresses']).map((section, idx) => (
                  <div key={section}>
                    <div className={`px-6 ${idx > 0 ? 'mt-8' : ''}`}>
                      <h2 className="text-xl font-serif font-bold mb-4">
                        {section === 'tops' ? 'Tops' : section === 'bottoms' ? 'Bottoms' : 'Dresses'}
                      </h2>
                    </div>
                    <MasonryGrid items={outfitResults[section] || []} onItemClick={setSelectedItem} />
                  </div>
                ))}
              </>
            ) : items.length > 0 ? (
              <MasonryGrid items={items} onItemClick={setSelectedItem} />
            ) : (
              <div className="text-center py-20 text-gray-500">
                <p className="mb-2">No items found.</p>
                <p className="text-sm">Try searching by style or brand, upload an inspiration image, or browse vendors above.</p>
              </div>
            )}
          </main>
        } />
        
        <Route path="/upload" element={<UploadForm />} />
        <Route path="/auth" element={<Auth onAuthed={setUser} />} />
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
        <Route path="/wardrobe" element={
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
        } />
      </Routes>

      <ProductModal 
        item={selectedItem} 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)}
        user={user}
        onDeleted={() => { fetchItems(); }}
        isWardrobe={location.pathname === '/wardrobe'}
      />
    </div>
  );
}

export default App;
