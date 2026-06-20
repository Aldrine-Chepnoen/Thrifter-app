import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
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
    <div className="pb-8">
      <div className="grid grid-cols-2 gap-3 md:gap-4">
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
  const coverImage = style.cover_image_path || style.sample_items?.[0]?.image_path || null;

  return (
    <button
      onClick={onClick}
      className="relative aspect-[3/4] rounded-2xl md:rounded-3xl overflow-hidden bg-gray-200 dark:bg-gray-800 group"
    >
      {coverImage ? (
        <img
          src={coverImage}
          alt={style.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-gray-400 opacity-20" />
        </div>
      )}

      {/* Gradient scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

      {/* Name at bottom */}
      <div className="absolute bottom-0 inset-x-0 p-4">
        <h3 className="text-white font-serif font-bold text-lg md:text-xl leading-tight drop-shadow-sm">
          {style.name}
        </h3>
        <p className="text-[#EAAD11] text-[10px] font-bold uppercase tracking-widest mt-1 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
          Explore →
        </p>
      </div>
    </button>
  );
};

export default StyleDiscovery;
