import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, MessageSquarePlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getImageSrc } from '../utils';
import api from '../api';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const NOTE_MAX_LENGTH = 200;

const Cart = ({ cartItems, onRemove, onUpdateQuantity, onUpdateNote, onClearCart, deliveryFeeSingleVendor, deliveryFeeMultiVendor, user, openAuthModal }) => {
  const navigate = useNavigate();
  // Notes that already have text start expanded; everything else starts
  // collapsed behind the "Leave a note?" toggle.
  const [openNoteIds, setOpenNoteIds] = useState(() => new Set(cartItems.filter((i) => i.cartNote).map((i) => i.id)));
  const toggleNote = (itemId) => {
    setOpenNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };
  const subtotal = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.cartQuantity || 1), 0);
  const vendorCount = new Set(cartItems.map((i) => i.vendor_id)).size;
  const hasDeliveryFee = deliveryFeeSingleVendor != null && deliveryFeeMultiVendor != null;
  const deliveryFee = vendorCount > 1 ? deliveryFeeMultiVendor : deliveryFeeSingleVendor;
  const tax = 0; // Thrifter charges no tax today; shown for price-breakdown transparency.
  const total = subtotal + (hasDeliveryFee ? deliveryFee : 0) + tax;

  // Silently correct the cart against live stock on every visit — no banner,
  // no mention of "reservation": an item that sold out elsewhere just quietly
  // disappears (or its quantity clamps down) instead of sitting there stale
  // until checkout rejects it. Checkout's own server-side check remains the
  // final authority regardless.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      cartItems.map((item) =>
        api.get(`/items/${item.id}`)
          .then((res) => ({ id: item.id, quantity: res.data.quantity }))
          .catch(() => ({ id: item.id, quantity: 0 }))
      )
    ).then((results) => {
      if (cancelled) return;
      for (const { id, quantity } of results) {
        const cartItem = cartItems.find((i) => i.id === id);
        if (!cartItem) continue;
        if (quantity <= 0) {
          onRemove(id);
        } else if ((cartItem.cartQuantity || 1) > quantity) {
          onUpdateQuantity(id, quantity);
        }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckout = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    navigate('/checkout');
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-serif font-bold">Your Cart</h2>
        {cartItems.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-sm font-semibold text-[#EAAD11] hover:underline"
          >
            Remove all
          </button>
        )}
      </div>
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
              <div key={item.id} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                <img src={getImageSrc(item, 160)} alt={item.name} className="w-16 h-20 object-cover rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold truncate">{item.name}</p>
                    <p className="text-sm font-bold flex-shrink-0">{formatUGX(item.price)}</p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.vendor_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Size - <span className="font-semibold text-gray-700 dark:text-gray-300">{item.size}</span></p>
                  {item.quantity > 1 && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onUpdateQuantity(item.id, Math.max(1, (item.cartQuantity || 1) - 1))}
                        className="w-7 h-7 rounded-full bg-[#EAAD11] text-black flex items-center justify-center font-bold hover:opacity-90"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{item.cartQuantity || 1}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, Math.min(item.quantity, (item.cartQuantity || 1) + 1))}
                        className="w-7 h-7 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-black flex items-center justify-center font-bold hover:opacity-90"
                      >
                        +
                      </button>
                    </div>
                  )}
                  {openNoteIds.has(item.id) ? (
                    <div className="mt-2">
                      <textarea
                        value={item.cartNote || ''}
                        onChange={(e) => onUpdateNote(item.id, e.target.value.slice(0, NOTE_MAX_LENGTH))}
                        onBlur={() => { if (!item.cartNote?.trim()) toggleNote(item.id); }}
                        placeholder="e.g. no perfume packaging, call before delivery…"
                        maxLength={NOTE_MAX_LENGTH}
                        rows={2}
                        autoFocus={!item.cartNote}
                        className="w-full text-sm p-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 resize-none"
                      />
                      <p className="text-[11px] text-gray-400 mt-0.5 text-right">{(item.cartNote || '').length}/{NOTE_MAX_LENGTH}</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleNote(item.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#EAAD11] hover:opacity-80 mt-2"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      Leave a note?
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onRemove(item.id)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600 self-start"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2 mb-6">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{formatUGX(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Delivery fee</span>
              <span>{hasDeliveryFee ? formatUGX(deliveryFee) : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Tax</span>
              <span>{formatUGX(tax)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">{formatUGX(total)}</span>
            </div>
          </div>

          {/* Coupon codes are not implemented yet — no promo/discount model or
              checkout-side validation exists. Add an "Enter Coupon Code" field
              here once that system is built. */}

          <button
            onClick={handleCheckout}
            className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors"
          >
            Checkout
          </button>
        </>
      )}
    </main>
  );
};

export default Cart;
