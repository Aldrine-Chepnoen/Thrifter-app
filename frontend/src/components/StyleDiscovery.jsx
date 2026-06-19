import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import api from '../api';
import ThrifterLoader from './ThrifterLoader';

const StyleDiscovery = ({ onOpenModal }) => {
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStyles = async () => {
      try {
        const res = await api.get('/outfit-styles');
        setStyles(res.data);
      } catch (e) {
        console.error('Failed to fetch styles', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStyles();
  }, []);

  if (loading) return <ThrifterLoader />;

  if (styles.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 italic">No styles discovered yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 md:px-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-6 px-4 md:px-0">
        {styles.map((style) => (
          <StyleTile
            key={style.id}
            style={style}
            onClick={() => onOpenModal(style)}
          />
        ))}
      </div>
    </div>
  );
};

const StyleTile = ({ style, onClick }) => {
  const sampleImages = (style.sample_items || []).map(item => item.image_path).filter(Boolean);

  return (
    <button
      onClick={onClick}
      className="w-full group relative h-48 md:h-64 rounded-[2rem] overflow-hidden bg-gray-100 dark:bg-gray-800 transition-all hover:scale-[1.01] input-shadow border border-gray-100 dark:border-gray-800 text-left flex"
    >
      {/* Left Side: Image */}
      <div className="w-1/3 md:w-2/5 h-full relative overflow-hidden shrink-0 border-r border-gray-100/10">
        {style.cover_image_path ? (
          <img src={style.cover_image_path} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
        ) : (
          <div className="grid grid-cols-2 gap-0.5 h-full">
            {sampleImages.length > 0 ? (
              <>
                <img
                  src={sampleImages[0]}
                  className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${sampleImages.length === 1 ? 'col-span-2' : ''}`}
                  alt=""
                  onError={(e) => { e.target.src = '/placeholder.svg' }}
                />
                {sampleImages.length > 1 && (
                  <div className="grid grid-rows-2 gap-0.5">
                    <img
                      src={sampleImages[1]}
                      className="w-full h-full object-cover"
                      alt=""
                      onError={(e) => { e.target.src = '/placeholder.svg' }}
                    />
                    {sampleImages.length > 2 ? (
                      <img
                        src={sampleImages[2]}
                        className="w-full h-full object-cover"
                        alt=""
                        onError={(e) => { e.target.src = '/placeholder.svg' }}
                      />
                    ) : (
                      <div className="bg-gray-200 dark:bg-gray-700 w-full h-full" />
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="col-span-2 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                <Sparkles className="w-8 h-8 text-gray-400 opacity-20" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Side: Content Area with Gradient */}
      <div className="flex-1 relative flex items-center p-6 md:p-10">
        <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent dark:from-black/40 group-hover:bg-black/5 transition-colors" />

        <div className="relative z-10 max-w-lg">
          <h3 className="text-gray-900 dark:text-white font-serif font-bold text-2xl md:text-3xl leading-tight mb-2 group-hover:text-[#EAAD11] transition-colors">{style.name}</h3>
          <p className="text-gray-500 dark:text-white/60 text-sm md:text-base line-clamp-2 md:line-clamp-3 font-medium mb-6">{style.description}</p>

          <div className="flex items-center text-[#EAAD11] text-xs font-bold uppercase tracking-wider gap-2 group-hover:gap-3 transition-all">
            Explore Aesthetic
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </button>
  );
};

export default StyleDiscovery;
