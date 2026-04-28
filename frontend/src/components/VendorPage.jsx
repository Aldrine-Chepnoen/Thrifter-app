// This is the VendorPage component for the Thrifter frontend application. It displays a list of items from a specific vendor, along with the vendor's information such as their WhatsApp contact if available. The component uses React hooks to manage state and side effects, fetching the vendor's items and information from the backend API when the component mounts or when the vendor name changes. It also includes a loading state while data is being fetched and handles cases where there are no items from the vendor. The items are displayed in a masonry grid layout using the MasonryGrid component. The page is styled with Tailwind CSS and includes a banner at the top with the vendor's name and item count. The component also handles errors gracefully by logging them to the console and displaying an appropriate message to the user if the items fail to load.
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MasonryGrid from './MasonryGrid';
import api from '../api';

const VendorPage = ({ setSelectedItem, user, onItemDeleted }) => {
  const { name } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState(null);

  const isOwnProfile = user?.vendor_name?.toLowerCase() === name?.toLowerCase();

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
      <div className="relative h-40 md:h-52 bg-gradient-to-r from-[#FAF6B5] via-[#F4BD13] to-[#D2850F] rounded-2xl overflow-hidden mb-8 shadow-inner input-shadow border border-[#EAAD11]/20">
        <div className="absolute inset-0 bg-[url('/banner-texture.svg')] opacity-5 pointer-events-none"></div>
        <div className="h-full w-full flex items-center justify-center">
          <div className="px-6 md:px-8 text-center">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-black tracking-tight">{name}</h1>
            <p className="text-sm text-black mt-2 font-semibold opacity-80">
              {items.length} curated item(s)
            </p>
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <div className="flex justify-end mb-6">
          <Link 
            to="/upload"
            className="flex items-center gap-2 bg-[#EAAD11] text-black px-6 py-3 rounded-xl hover:opacity-90 transition-all font-bold shadow-lg shadow-black/10 input-shadow"
          >
            <Plus className="w-5 h-5" />
            <span>Sell Item</span>
          </Link>
        </div>
      )}

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
