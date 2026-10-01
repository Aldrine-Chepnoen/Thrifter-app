
import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AddToCartToast = ({ productName, onClose }) => {
  const navigate = useNavigate();

  // Automatically hide after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:w-[400px] z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl px-4 py-3">

        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-[#EAAD11] flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-black" />
            </div>

            <span className="text-sm font-semibold">
              Added to cart
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product name */}
        <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1 ml-8">
          {productName}
        </p>

        {/* Checkout */}
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={handleCheckout}
            className="text-sm font-bold text-[#EAAD11] hover:opacity-80 transition-opacity"
          >
            Checkout? →
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddToCartToast;

