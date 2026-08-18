import React, { useState } from 'react';
import { createCheckout, payCheckout } from '../api';
import { getImageSrc } from '../utils';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

// Add 'nylon' here once its adapter is wired into the backend factory.
const PAYMENT_PROVIDERS = ['pesapal'];

const Checkout = ({ cartItems, onOrderPlaced }) => {
  const [form, setForm] = useState({ delivery_name: '', delivery_phone: '', delivery_address: '' });
  const [provider, setProvider] = useState('pesapal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const subtotal = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0);

  if (cartItems.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-12 text-center text-gray-500">
        <p>Your cart is empty.</p>
      </main>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.delivery_name.trim() || !form.delivery_phone.trim() || !form.delivery_address.trim()) {
      setError('Please fill in all delivery details.');
      return;
    }
    setSubmitting(true);
    try {
      const checkout = await createCheckout({
        items: cartItems.map((i) => ({ item_id: i.id })),
        delivery_name: form.delivery_name.trim(),
        delivery_phone: form.delivery_phone.trim(),
        delivery_address: form.delivery_address.trim(),
      });
      const payment = await payCheckout(checkout.id, provider);
      onOrderPlaced?.();
      window.location.href = payment.redirect_url;
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : detail;
      setError(msg || err?.message || 'Checkout failed, please try again.');
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
      <h2 className="text-xl font-serif font-bold mb-6">Checkout</h2>

      <div className="mb-8 space-y-2">
        {cartItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3 text-sm">
            <img src={getImageSrc(item, 100)} alt={item.name} className="w-10 h-12 object-cover rounded-md flex-shrink-0" />
            <span className="flex-1 truncate">{item.name}</span>
            <span className="font-semibold">{formatUGX(item.price)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
          <span>Subtotal</span>
          <span>{formatUGX(subtotal)}</span>
        </div>
        <p className="text-xs text-gray-400">Delivery fee is added at checkout. Delivery happens on the next Monday or Thursday pickup day.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input
            type="text"
            value={form.delivery_name}
            onChange={(e) => setForm((f) => ({ ...f, delivery_name: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone number</label>
          <input
            type="tel"
            value={form.delivery_phone}
            onChange={(e) => setForm((f) => ({ ...f, delivery_phone: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Delivery address</label>
          <textarea
            value={form.delivery_address}
            onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
            placeholder="Area, street, landmark..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Pay with</label>
          <div className={`grid gap-3 ${PAYMENT_PROVIDERS.length > 1 ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {PAYMENT_PROVIDERS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setProvider(p)}
                className={`py-3 rounded-xl border font-semibold uppercase text-sm transition-colors ${
                  provider === p
                    ? 'border-[#EAAD11] bg-[#EAAD11]/10 text-[#EAAD11]'
                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Redirecting to payment...' : 'Pay Now'}
        </button>
      </form>
    </main>
  );
};

export default Checkout;
