// This is the VendorPage component for the Thrifter frontend application. It displays a list of items from a specific vendor, along with the vendor's information such as their WhatsApp contact if available. The component uses React hooks to manage state and side effects, fetching the vendor's items and information from the backend API when the component mounts or when the vendor name changes. It also includes a loading state while data is being fetched and handles cases where there are no items from the vendor. The items are displayed in a masonry grid layout using the MasonryGrid component. The page is styled with Tailwind CSS and includes a banner at the top with the vendor's name and item count. The component also handles errors gracefully by logging them to the console and displaying an appropriate message to the user if the items fail to load.
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MasonryGrid from './MasonryGrid';
import api from '../api';

const VendorPage = ({ setSelectedItem, user, onItemDeleted }) => {
  const { name } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState(null);

  const fetchVendorItems = async () => {
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

  useEffect(() => {
    fetchVendorItems();
  }, [name]);

  return (
    <main className="max-w-7xl mx-auto px-6">
      <div className="relative h-40 md:h-52 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden mb-8 shadow-inner">
        <div className="absolute inset-0 bg-[url('/banner-texture.svg')] opacity-10 pointer-events-none"></div>
        <div className="h-full w-full flex items-center">
          <div className="px-6 md:px-8">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">{name}</h1>
            <p className="text-sm text-gray-200 mt-1">
              {items.length} item(s)
            </p>
          </div>
        </div>
      </div>
      <div>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : items.length > 0 ? (
        <MasonryGrid items={items} onItemClick={setSelectedItem} />
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
