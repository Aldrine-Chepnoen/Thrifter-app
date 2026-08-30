import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import api, { createCheckout, payCheckout, API_BASE_URL } from '../api';
import { getImageSrc } from '../utils';
import { useToast } from '../context/ToastContext';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const Checkout = ({ cartItems, onOrderPlaced, deliveryFeeSingleVendor, deliveryFeeMultiVendor, reservationMinutes }) => {
  const { showToast } = useToast();
  const [step, setStep] = useState('form'); // 'form' | 'confirm'
  const [checkout, setCheckout] = useState(null); // server-created Checkout, set once we move to 'confirm'
  const [form, setForm] = useState({ delivery_name: '', delivery_phone: '', delivery_address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const didConfirmRef = useRef(false);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser. Please type your delivery address instead.');
      return;
    }
    if (!window.confirm('Are you sure you want to use your current location as your delivery address?')) {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.post('/geocode/reverse', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setForm((f) => ({ ...f, delivery_address: res.data.address }));
        } catch (e) {
          showToast(e?.response?.data?.detail || 'Could not determine your address. Please type your delivery address instead.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        showToast('Could not get your location. Please type your delivery address instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Release held stock as soon as the buyer leaves the confirm step without
  // paying, instead of making it wait out the full hold window — silent,
  // best-effort, no UI ever mentions this. `beforeunload` covers a hard tab
  // close/refresh; the cleanup function covers navigating elsewhere in the app.
  useEffect(() => {
    if (step !== 'confirm' || !checkout) return;
    const releaseIfAbandoned = () => {
      if (didConfirmRef.current) return;
      fetch(`${API_BASE_URL}/checkout/${checkout.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('thrifter_token')}` },
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', releaseIfAbandoned);
    return () => {
      window.removeEventListener('beforeunload', releaseIfAbandoned);
      releaseIfAbandoned();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, checkout]);

  const subtotal = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.cartQuantity || 1), 0);
  const vendorCount = new Set(cartItems.map((i) => i.vendor_id)).size;
  const hasDeliveryFee = deliveryFeeSingleVendor != null && deliveryFeeMultiVendor != null;
  const deliveryFee = vendorCount > 1 ? deliveryFeeMultiVendor : deliveryFeeSingleVendor;
  const tax = 0; // Thrifter charges no tax today; shown for price-breakdown transparency.
  const total = subtotal + (hasDeliveryFee ? deliveryFee : 0) + tax;

  if (cartItems.length === 0 && step === 'form') {
    return (
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-12 text-center text-gray-500">
        <p>Your cart is empty.</p>
      </main>
    );
  }

  const handleCreateCheckout = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.delivery_name.trim() || !form.delivery_phone.trim() || !form.delivery_address.trim()) {
      setError('Please fill in all delivery details.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCheckout({
        items: cartItems.map((i) => ({ item_id: i.id, quantity: i.cartQuantity || 1, note: i.cartNote?.trim() || undefined })),
        delivery_name: form.delivery_name.trim(),
        delivery_phone: form.delivery_phone.trim(),
        delivery_address: form.delivery_address.trim(),
      });
      setCheckout(created);
      setStep('confirm');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && Array.isArray(detail.items)) {
        const lines = detail.items.map((s) => {
          const item = cartItems.find((i) => i.id === s.item_id);
          const name = item?.name || `Item #${s.item_id}`;
          return s.available > 0
            ? `${name}: only ${s.available} left (you requested ${s.requested})`
            : `${name} is no longer available`;
        });
        setError(lines.join('; '));
      } else {
        const msg = typeof detail === 'object' ? detail.message : detail;
        setError(msg || err?.message || 'Checkout failed, please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPay = async () => {
    didConfirmRef.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const payment = await payCheckout(checkout.id, 'nylon');
      onOrderPlaced?.();
      window.location.href = payment.redirect_url;
    } catch (err) {
      // Payment initiation itself failed — the checkout is still just sitting
      // there pending, so leaving from here should still release it normally.
      didConfirmRef.current = false;
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : detail;
      setError(msg || err?.message || 'Could not start payment, please try again.');
      setSubmitting(false);
    }
  };

  if (step === 'confirm' && checkout) {
    return (
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        <h2 className="text-xl font-serif font-bold mb-6">Confirm your order</h2>

        <div className="mb-6 space-y-2">
          {checkout.orders.flatMap((order) => order.items).map((oi) => (
            <div key={oi.id} className="flex items-center gap-3 text-sm">
              <span className="flex-1 truncate">
                {oi.item_name_snapshot}{oi.quantity > 1 ? ` × ${oi.quantity}` : ''}
              </span>
              <span className="font-semibold">{formatUGX(oi.price_at_purchase * oi.quantity)}</span>
            </div>
          ))}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-1.5">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{formatUGX(checkout.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Delivery fee</span>
              <span>{formatUGX(checkout.delivery_fee)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Tax</span>
              <span>{formatUGX(tax)}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">{formatUGX(checkout.total_amount)}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-6">
          {reservationMinutes != null && `Complete payment within ${reservationMinutes} minutes — after that these items go back into stock. `}
        </p>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          onClick={handleConfirmPay}
          disabled={submitting}
          className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Redirecting to payment...' : 'Confirm & Pay'}
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
      <h2 className="text-xl font-serif font-bold mb-6">Checkout</h2>

      <div className="mb-8 space-y-2">
        {cartItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3 text-sm">
            <img src={getImageSrc(item, 100)} alt={item.name} className="w-10 h-12 object-cover rounded-md flex-shrink-0" />
            <span className="flex-1 truncate">
              {item.name}{item.cartQuantity > 1 ? ` × ${item.cartQuantity}` : ''}
            </span>
            <span className="font-semibold">{formatUGX(item.price * (item.cartQuantity || 1))}</span>
          </div>
        ))}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-1.5">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{formatUGX(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Shipping Cost</span>
            <span>{hasDeliveryFee ? formatUGX(deliveryFee) : '—'}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Tax</span>
            <span>{formatUGX(tax)}</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">{formatUGX(total)}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleCreateCheckout} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.delivery_name}
            onChange={(e) => setForm((f) => ({ ...f, delivery_name: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
            required
            minLength={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone number(to receive PIN prompt) <span className="text-red-500">*</span></label>
          <input
            type="tel"
            value={form.delivery_phone}
            onChange={(e) => setForm((f) => ({ ...f, delivery_phone: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
            required
            minLength={7}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Delivery address <span className="text-red-500">*</span></label>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="flex items-center gap-1.5 text-sm font-bold text-[#EAAD11] hover:underline disabled:opacity-50"
            >
              <MapPin className="w-4 h-4" />
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
          <textarea
            value={form.delivery_address}
            onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
            placeholder="Area, street, landmark..."
            required
            minLength={5}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Please wait...' : 'Continue'}
        </button>
      </form>
    </main>
  );
};

export default Checkout;
