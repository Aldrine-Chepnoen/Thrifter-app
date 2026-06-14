import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ThrifterLoader from './ThrifterLoader';

const StyleDiscovery = ({ onOpenModal }) => {
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#EAAD11]" />
            Style Discovery
          </h2>
          <p className="text-sm text-gray-500 mt-1">Explore aesthetics curated by our AI from current listings.</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 md:mx-0 md:px-0">
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
  // We'll parse the JSON list of sample items
  const sampleIds = JSON.parse(style.sample_item_ids || '[]');
  const [sampleImages, setSampleImages] = useState([]);

  useEffect(() => {
    const fetchSamples = async () => {
      // If we have a custom cover, we don't need to fetch samples for the tile
      if (style.cover_image_path || sampleIds.length === 0) return;
      try {
        // We only need the first 2-3 images for the tile preview
        const promises = sampleIds.slice(0, 3).map(id => api.get(`/items/${id}`));
        const results = await Promise.all(promises);
        setSampleImages(results.map(r => r.data.image_path));
      } catch (e) {
        console.error('Failed to fetch sample images', e);
      }
    };
    fetchSamples();
  }, [style.sample_item_ids, style.cover_image_path]);

  return (
    <button 
      onClick={onClick}
      className="flex-shrink-0 w-64 md:w-72 group relative aspect-[4/5] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 transition-all hover:scale-[1.02] input-shadow border border-gray-100 dark:border-gray-800 text-left"
    >
      <div className="absolute inset-0">
        {style.cover_image_path ? (
          <img src={style.cover_image_path} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="grid grid-cols-2 gap-0.5 h-full">
            {sampleImages.length > 0 ? (
              <>
                <img 
                  src={sampleImages[0]} 
                  className={`w-full h-full object-cover ${sampleImages.length === 1 ? 'col-span-2' : ''}`}
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
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
      
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h3 className="text-white font-serif font-bold text-xl leading-tight mb-1">{style.name}</h3>
        <p className="text-white/70 text-xs line-clamp-2 font-medium">{style.description}</p>
        
        <div className="mt-4 flex items-center text-[#EAAD11] text-xs font-bold uppercase tracking-wider gap-1 group-hover:gap-2 transition-all">
          Explore Style
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
};

export default StyleDiscovery;
