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
    </div>
  );
};

const Section = ({ title, items, onSelectItem, icon }) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div>
      <div className="px-4 md:px-6 mb-4 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h2 className="text-xl font-serif font-bold text-gray-900 dark:text-white">{title}</h2>
        <span className="text-xs text-gray-500 font-medium ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
          {items.length} options
        </span>
      </div>

      <div
        className={`flex overflow-x-auto no-scrollbar pb-4 snap-x -mx-4 md:mx-0 md:px-6 md:gap-4 ${
          isMobile ? 'snap-mandatory' : 'gap-4 px-4'
        }`}
        style={isMobile ? { scrollPaddingInline: 'calc(50% - 120px)' } : undefined}
      >
        {items.length > 0 ? (
          <>
            {isMobile && (
              <div className="flex-shrink-0" style={{ width: 'calc(50% - 120px)' }} />
            )}
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`flex-shrink-0 w-[240px] md:w-[280px] ${
                  isMobile ? `snap-center${idx > 0 ? ' ml-4' : ''}` : 'snap-start'
                }`}
              >
                <ItemCard item={item} onClick={() => onSelectItem(item)} />
              </div>
            ))}
            {isMobile && (
              <div className="flex-shrink-0" style={{ width: 'calc(50% - 120px)' }} />
            )}
          </>
        ) : (
          <div className="w-full py-12 flex flex-col items-center justify-center text-gray-400 italic bg-white dark:bg-gray-900 rounded-3xl mx-4 md:mx-0 border border-dashed border-gray-200 dark:border-gray-800">
            <ShoppingBag className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-sm">No {title.toLowerCase()} found for this aesthetic yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleBuilder;
