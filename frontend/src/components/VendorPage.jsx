import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MasonryGrid from './MasonryGrid';
import api from '../api';

const VendorPage = () => {
  const { name } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/items?vendor=${encodeURIComponent(name)}`);
        setItems(res.data || []);
        const vres = await api.get('/vendors');
        const info = (vres.data || []).find((v) => v.name?.toLowerCase() === name?.toLowerCase());
        setVendorInfo(info || null);
      } catch (e) {
        console.error('Failed to load vendor items', e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [name]);

  return (
    <main className="max-w-7xl mx-auto">
      <div className="relative h-40 md:h-52 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900">
        <div className="absolute inset-0 bg-[url('/banner-texture.svg')] opacity-10 pointer-events-none"></div>
        <div className="h-full w-full flex items-center">
          <div className="px-6 md:px-8">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">Vendor: {name}</h1>
            <p className="text-sm text-gray-200 mt-1">
              {items.length} item(s){vendorInfo?.whatsapp ? ` • WhatsApp: ${vendorInfo.whatsapp}` : ''}
            </p>
          </div>
        </div>
      </div>
      <div className="px-6">
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : items.length > 0 ? (
        <MasonryGrid items={items} onItemClick={() => {}} />
      ) : (
        <div className="text-center py-20 text-gray-500">
          <p>No items from this vendor yet.</p>
        </div>
      )}
      </div>
    </main>
  );
};

export default VendorPage;
