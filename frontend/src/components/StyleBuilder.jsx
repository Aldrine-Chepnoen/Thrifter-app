import React, { useState, useEffect } from 'react';
import { ChevronLeft, ShoppingBag, Sparkles } from 'lucide-react';
import api from '../api';
import ThrifterLoader from './ThrifterLoader';
import ItemCard from './ItemCard';

const StyleBuilder = ({ style, onBack, onSelectItem }) => {
  const [pools, setPools] = useState({ tops: [], bottoms: [], accessories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPools = async () => {
      try {
        const res = await api.get(`/outfit-styles/${style.slug}/items`);
        setPools(res.data);
      } catch (e) {
        console.error('Failed to fetch style pools', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPools();
    window.scrollTo(0, 0);
  }, [style]);

  if (loading) return <ThrifterLoader />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-4 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-medium hover:text-black dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to styles
          </button>
          
          <div className="text-center absolute left-1/2 -translate-x-1/2">
            <h1 className="text-lg font-serif font-bold text-gray-900 dark:text-white">{style.name}</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#EAAD11] font-bold">Style Builder</p>
          </div>

          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8">
        <Section title="Tops" items={pools.tops} onSelectItem={onSelectItem} icon="👕" />
        <Section title="Bottoms" items={pools.bottoms} onSelectItem={onSelectItem} icon="👖" />
        {pools.accessories.length > 0 && (
          <Section title="Accessories" items={pools.accessories} onSelectItem={onSelectItem} icon="👜" />
        )}
      </div>
      
      {/* Floating Sparkle Info */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 z-40 border border-white/10">
        <Sparkles className="w-4 h-4 text-[#EAAD11]" />
        <span className="text-xs font-medium">Items selected by AI similarity</span>
      </div>
    </div>
  );
};

const Section = ({ title, items, onSelectItem, icon }) => (
  <div className="mb-10 last:mb-0">
    <div className="px-4 md:px-6 mb-4 flex items-center gap-2">
      <span className="text-xl">{icon}</span>
      <h2 className="text-xl font-serif font-bold text-gray-900 dark:text-white">{title}</h2>
      <span className="text-xs text-gray-500 font-medium ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
        {items.length} options
      </span>
    </div>
    
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x -mx-4 px-4 md:mx-0 md:px-6">
      {items.length > 0 ? (
        items.map((item) => (
          <div key={item.id} className="flex-shrink-0 w-[240px] md:w-[280px] snap-start">
            <ItemCard 
              item={item} 
              onClick={() => onSelectItem(item)} 
            />
          </div>
        ))
      ) : (
        <div className="w-full py-12 flex flex-col items-center justify-center text-gray-400 italic bg-white dark:bg-gray-900 rounded-3xl mx-4 md:mx-0 border border-dashed border-gray-200 dark:border-gray-800">
          <ShoppingBag className="w-8 h-8 opacity-20 mb-2" />
          <p className="text-sm">No {title.toLowerCase()} found for this aesthetic yet</p>
        </div>
      )}
    </div>
  </div>
);

export default StyleBuilder;
