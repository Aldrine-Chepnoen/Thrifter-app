import React, { useEffect, useRef, useState } from 'react';
import { X, ShoppingBag, MessageSquarePlus, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getImageSrc } from '../utils';
import api from '../api';


const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const NOTE_MAX_LENGTH = 200;
// How often to re-check live stock while the buyer stays on this page — a
// one-time check on mount misses an item going unavailable mid-session
// (e.g. while they're filling in checkout in another tab).
const AVAILABILITY_POLL_MS = 20000;

const Cart = ({ cartItems, onRemove, onUpdateQuantity, onUpdateNote, onClearCart, deliveryBaseFeeUgx, user, openAuthModal }) => {
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
  // Delivery is distance-based and the buyer's location isn't known until
  // checkout — never show a number here, not even a floor, so the total
  // below stays just the items until checkout confirms the real fee.
  const hasDeliveryFee = deliveryBaseFeeUgx != null;
  const tax = 0; // Thrifter charges no tax today; shown for price-breakdown transparency.
  const total = subtotal + tax;

  // Items confirmed gone (quantity 0) stay visible with a clear tag rather
  // than being silently dropped, and block checkout until the buyer removes
  // them — the point is to catch this here instead of after they've filled
  // in delivery details, only for checkout's own stock check to reject them.
  // A partial shortfall (some stock left, just less than they want) is still
  // auto-clamped below rather than flagged, since that's not a blocker.
  const [unavailableIds, setUnavailableIds] = useState(() => new Set());
  const cartItemsRef = useRef(cartItems);
  useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);

  useEffect(() => {
    let cancelled = false;
    const checkAvailability = () => {
      const items = cartItemsRef.current;
      Promise.all(
        items.map((item) =>
          api.get(`/items/${item.id}`)
            .then((res) => ({ id: item.id, quantity: res.data.quantity }))
            .catch(() => ({ id: item.id, quantity: 0 }))
        )
      ).then((results) => {
        if (cancelled) return;
        const stillGone = new Set();
        for (const { id, quantity } of results) {
          const cartItem = cartItemsRef.current.find((i) => i.id === id);
          if (!cartItem) continue;
          if (quantity <= 0) {
            stillGone.add(id);
          } else if ((cartItem.cartQuantity || 1) > quantity) {
            onUpdateQuantity(id, quantity);
          }
        }
        setUnavailableIds(stillGone);
      });
    };
    checkAvailability();
    const interval = setInterval(checkAvailability, AVAILABILITY_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasUnavailable = cartItems.some((i) => unavailableIds.has(i.id));

  const handleCheckout = () => {
    if (hasUnavailable) return;
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
            {cartItems.map((item) => {
              const isUnavailable = unavailableIds.has(item.id);
              return (
              <div key={item.id} className={`flex items-center gap-4 bg-gray-50 dark:bg-gray-900 border rounded-xl p-3 ${isUnavailable ? 'border-red-200 dark:border-red-900' : 'border-gray-200 dark:border-gray-800'}`}>
                <img src={getImageSrc(item, 160)} alt={item.name} className={`w-16 h-20 object-cover rounded-lg flex-shrink-0 ${isUnavailable ? 'grayscale opacity-50' : ''}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold truncate">{item.name}</p>
                    <p className="text-sm font-bold flex-shrink-0">{formatUGX(item.price)}</p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.vendor_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Size - <span className="font-semibold text-gray-700 dark:text-gray-300">{item.size}</span></p>
                  {isUnavailable ? (
                    <p className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 mt-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      No longer available — remove it to continue
                    </p>
                  ) : item.quantity > 1 && (
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
                  {!isUnavailable && (openNoteIds.has(item.id) ? (
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
                      Add Order details (Size/Colors)?
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onRemove(item.id)}
                  className={`p-2 rounded-full self-start ${isUnavailable ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-600'}`}
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              );
            })}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2 mb-6">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{formatUGX(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Delivery fee</span>
              <span>{hasDeliveryFee ? 'Depends on delivery location' : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Tax</span>
              <span>{formatUGX(tax)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">{formatUGX(total)}</span>
            </div>
            {hasDeliveryFee && (
              <p className="text-xs text-gray-400 pt-1">Delivery fee is calculated after you enter your delivery location at checkout.</p>
            )}
          </div>

          {/* Coupon codes are not implemented yet — no promo/discount model or
              checkout-side validation exists. Add an "Enter Coupon Code" field
              here once that system is built. */}

          {hasUnavailable && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 mb-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Remove the unavailable item{cartItems.filter((i) => unavailableIds.has(i.id)).length > 1 ? 's' : ''} above to continue.
            </p>
          )}
          <button
            onClick={handleCheckout}
            disabled={hasUnavailable}
            className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50"
          >
            Checkout
          </button>
        </>
      )}
    </main>
  );
};

export default Cart;
