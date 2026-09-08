import React, { useState, useEffect, useRef } from 'react';
import { createCheckout, payCheckout, confirmCashOnDelivery, API_BASE_URL } from '../api';
import { getImageSrc, haversineKm } from '../utils';
import LocationPicker from './LocationPicker';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const Checkout = ({
  cartItems,
  onOrderPlaced,
  collectionPointLat,
  collectionPointLng,
  deliveryBaseFeeUgx,
  deliveryRatePerKmUgx,
  deliveryMaxRadiusKm,
  codRoundingUgx,
  reservationMinutes,
}) => {
  const [step, setStep] = useState('form'); // 'form' | 'confirm'
  const [checkout, setCheckout] = useState(null); // server-created Checkout, set once we move to 'confirm'
  const [form, setForm] = useState({
    delivery_name: '', delivery_phone: '', delivery_address: '',
    delivery_lat: null, delivery_lng: null, payment_method: 'mobile_money',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const didConfirmRef = useRef(false);

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
  const hasFeeConfig = collectionPointLat != null && collectionPointLng != null
    && deliveryBaseFeeUgx != null && deliveryRatePerKmUgx != null;
  const locationResolved = form.delivery_lat != null && form.delivery_lng != null;
  const distanceKm = (hasFeeConfig && locationResolved)
    ? haversineKm(collectionPointLat, collectionPointLng, form.delivery_lat, form.delivery_lng)
    : null;
  const outOfRange = distanceKm != null && deliveryMaxRadiusKm != null && distanceKm > deliveryMaxRadiusKm;
  const hasDeliveryFee = hasFeeConfig && locationResolved && !outOfRange;
  // Mirrors the backend's _calculate_delivery_fee (backend/main.py) — kept in
  // sync manually so the preview matches what /checkout actually charges.
  // Cash on delivery rounds up to the nearest codRoundingUgx (exact physical
  // cash); mobile money pays the precise amount digitally, so it isn't rounded.
  const rawDeliveryFee = hasDeliveryFee ? deliveryBaseFeeUgx + deliveryRatePerKmUgx * distanceKm : 0;
  const deliveryFee = hasDeliveryFee
    ? (form.payment_method === 'cash_on_delivery' && codRoundingUgx
        ? Math.ceil(rawDeliveryFee / codRoundingUgx) * codRoundingUgx
        : Math.round(rawDeliveryFee))
    : 0;
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
    if (!locationResolved) {
      setError('Please confirm your delivery location — select a suggestion, use your location, or pick it on the map.');
      return;
    }
    if (outOfRange) {
      setError(`Sorry, we don't deliver that far yet (max ${deliveryMaxRadiusKm}km from our collection point).`);
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCheckout({
        items: cartItems.map((i) => ({ item_id: i.id, quantity: i.cartQuantity || 1, note: i.cartNote?.trim() || undefined })),
        delivery_name: form.delivery_name.trim(),
        delivery_phone: form.delivery_phone.trim(),
        delivery_address: form.delivery_address.trim(),
        delivery_lat: form.delivery_lat,
        delivery_lng: form.delivery_lng,
        payment_method: form.payment_method,
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

  const handleConfirmCod = async () => {
    didConfirmRef.current = true;
    setError(null);
    setSubmitting(true);
    try {
      await confirmCashOnDelivery(checkout.id);
      onOrderPlaced?.();
      window.location.href = `/checkout/complete?checkout_id=${checkout.id}`;
    } catch (err) {
      didConfirmRef.current = false;
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : detail;
      setError(msg || err?.message || 'Could not place your order, please try again.');
      setSubmitting(false);
    }
  };

  const isCod = checkout?.payment_method === 'cash_on_delivery';

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
          {reservationMinutes != null && (
            isCod
              ? `Confirm within ${reservationMinutes} minutes — after that these items go back into stock. `
              : `Complete payment within ${reservationMinutes} minutes — after that these items go back into stock. `
          )}
        </p>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          onClick={isCod ? handleConfirmCod : handleConfirmPay}
          disabled={submitting}
          className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {isCod
            ? (submitting ? 'Placing order...' : 'Place order — pay on delivery')
            : (submitting ? 'Redirecting to payment...' : 'Confirm & Pay')}
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
            <span>
              {hasDeliveryFee
                ? formatUGX(deliveryFee)
                : (outOfRange ? 'Not available at this location' : 'Set delivery location to see cost')}
            </span>
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
          <label className="block text-sm font-medium mb-1">
            Phone number{form.payment_method === 'mobile_money' ? '(to receive PIN prompt)' : ''} <span className="text-red-500">*</span>
          </label>
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
          <label className="block text-sm font-medium mb-2">Payment method <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'mobile_money', label: 'Mobile Money', hint: 'Pay now via PIN prompt' },
              { value: 'cash_on_delivery', label: 'Cash on Delivery', hint: 'Pay when it arrives' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, payment_method: opt.value }))}
                className={`text-left px-4 py-2.5 rounded-xl border transition-colors ${
                  form.payment_method === opt.value
                    ? 'border-[#EAAD11] ring-2 ring-[#EAAD11] bg-[#EAAD11]/5'
                    : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900'
                }`}
              >
                <div className="font-semibold text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Delivery address <span className="text-red-500">*</span></label>
          <LocationPicker
            address={form.delivery_address}
            lat={form.delivery_lat}
            lng={form.delivery_lng}
            collectionPointLat={collectionPointLat}
            collectionPointLng={collectionPointLng}
            onChange={({ address, lat, lng }) => setForm((f) => ({
              ...f, delivery_address: address, delivery_lat: lat, delivery_lng: lng,
            }))}
          />
          {outOfRange && (
            <p className="text-sm text-red-600 mt-1.5">
              Sorry, we don't deliver that far yet (max {deliveryMaxRadiusKm}km from our collection point).
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || outOfRange}
          className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Please wait...' : 'Continue'}
        </button>
      </form>
    </main>
  );
};

export default Checkout;
