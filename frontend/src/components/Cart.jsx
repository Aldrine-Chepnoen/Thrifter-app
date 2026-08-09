import React from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getImageSrc } from '../utils';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const Cart = ({ cartItems, onRemove, user, openAuthModal }) => {
  const navigate = useNavigate();
  const subtotal = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0);

  const handleCheckout = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    navigate('/checkout');
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <h2 className="text-xl font-serif font-bold mb-6">Your Cart</h2>
      {cartItems.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-2">Your cart is empty.</p>
          <Link to="/" className="text-sm text-[#EAAD11] font-semibold hover:underline">Continue browsing</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-8">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                <img src={getImageSrc(item, 160)} alt={item.name} className="w-16 h-20 object-cover rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.vendor_name}</p>
                  <p className="text-sm font-bold mt-1">{formatUGX(item.price)}</p>
                </div>
                <button
                  onClick={() => onRemove(item.id)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 flex items-center justify-between mb-6">
            <span className="text-gray-500 dark:text-gray-400">Subtotal ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</span>
            <span className="text-lg font-bold">{formatUGX(subtotal)}</span>
          </div>

          <button
            onClick={handleCheckout}
            className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors"
          >
            Proceed to Checkout
          </button>
        </>
      )}
    </main>
  );
};

export default Cart;
