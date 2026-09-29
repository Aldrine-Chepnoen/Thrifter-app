import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { getCheckout, createCheckout, confirmCashOnDelivery } from '../api';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const OrderConfirmation = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutId = searchParams.get('checkout_id');
  const [checkout, setCheckout] = useState(null);
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef(null);
  // Cash-on-delivery retry after a failed mobile money payment: null until the
  // buyer opts in, then holds the newly created (not yet confirmed) COD
  // checkout for review, plus any in-flight/error state for that retry.
  const [codRetry, setCodRetry] = useState(null);

  useEffect(() => {
    if (!checkoutId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const data = await getCheckout(checkoutId);
        if (cancelled) return;
        setCheckout(data);
        attempts += 1;
        if (data.status === 'pending') {
          if (attempts < 20) {
            pollRef.current = setTimeout(poll, 3000);
          } else {
            setTimedOut(true);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.detail || 'Could not load order status.');
      }
    };
    poll();

    return () => { cancelled = true; clearTimeout(pollRef.current); };
  }, [checkoutId]);

  // Rebuilds a checkout from the failed one's own item_id/quantity/note and
  // delivery fields rather than the buyer's cart — the cart was already
  // cleared the moment they were redirected to the mobile money provider
  // (see Checkout.jsx's onOrderPlaced), so it's empty by the time they land
  // back here.
  const handleTryCod = async () => {
    setCodRetry({ checkout: null, error: null, submitting: true });
    try {
      const items = checkout.orders
        .flatMap((o) => o.items)
        .filter((oi) => oi.item_id != null)
        .map((oi) => ({ item_id: oi.item_id, quantity: oi.quantity, note: oi.note || undefined }));
      const created = await createCheckout({
        items,
        delivery_name: checkout.delivery_name,
        delivery_phone: checkout.delivery_phone,
        delivery_address: checkout.delivery_address,
        delivery_lat: checkout.delivery_lat,
        delivery_lng: checkout.delivery_lng,
        payment_method: 'cash_on_delivery',
      });
      setCodRetry({ checkout: created, error: null, submitting: false });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const nameById = new Map(checkout.orders.flatMap((o) => o.items).map((oi) => [oi.item_id, oi.item_name_snapshot]));
      let msg;
      if (detail && typeof detail === 'object' && Array.isArray(detail.items)) {
        msg = detail.items.map((s) => {
          const name = nameById.get(s.item_id) || `Item #${s.item_id}`;
          return s.available > 0
            ? `${name}: only ${s.available} left (you requested ${s.requested})`
            : `${name} is no longer available`;
        }).join('; ');
      } else {
        msg = (typeof detail === 'object' ? detail.message : detail) || err?.message || 'Could not start a cash-on-delivery order, please try again.';
      }
      setCodRetry({ checkout: null, error: msg, submitting: false });
    }
  };

  const handlePlaceCodRetry = async () => {
    setCodRetry((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const placed = await confirmCashOnDelivery(codRetry.checkout.id);
      // Reuses the existing "paid" success view above by swapping in the new
      // checkout, rather than duplicating that UI for the retry path.
      setSearchParams({ checkout_id: String(placed.id) });
      setCheckout(placed);
      setCodRetry(null);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = (typeof detail === 'object' ? detail.message : detail) || err?.message || 'Could not place your order, please try again.';
      setCodRetry((prev) => ({ ...prev, submitting: false, error: msg }));
    }
  };

  if (!checkoutId) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center text-gray-500">
        <p className="mb-4">No order to show.</p>
        <Link to="/" className="text-[#EAAD11] font-semibold hover:underline">Back to feed</Link>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-16 text-center">
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : timedOut && (!checkout || checkout.status === 'pending') ? (
        <>
          <Loader className="w-10 h-10 mx-auto mb-4 text-[#EAAD11]" />
          <h2 className="text-xl font-serif font-bold mb-2">This is taking longer than usual</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            We're still waiting to hear back from the payment provider. If you completed the mobile money prompt, your order should appear in My Orders shortly — no need to pay again.
          </p>
          <Link to="/orders" className="inline-block bg-[#EAAD11] text-black py-3 px-6 rounded-xl font-bold hover:opacity-90">
            Check My Orders
          </Link>
        </>
      ) : !checkout || checkout.status === 'pending' ? (
        <>
          <Loader className="w-10 h-10 mx-auto mb-4 animate-spin text-[#EAAD11]" />
          <h2 className="text-xl font-serif font-bold mb-2">Confirming your payment...</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">This usually takes a few seconds.</p>
        </>
      ) : checkout.status === 'paid' ? (
        <>
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
          <h2 className="text-xl font-serif font-bold mb-2">Order confirmed!</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Delivery scheduled for{' '}
            {new Date(checkout.delivery_day).toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })}.
          </p>
          <Link to="/orders" className="inline-block bg-[#EAAD11] text-black py-3 px-6 rounded-xl font-bold hover:opacity-90">
            View My Orders
          </Link>
        </>
      ) : codRetry?.checkout ? (
        <div className="text-left">
          <h2 className="text-xl font-serif font-bold mb-6 text-center">Confirm cash on delivery</h2>
          <div className="mb-6 space-y-2">
            {codRetry.checkout.orders.flatMap((o) => o.items).map((oi) => (
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
                <span>{formatUGX(codRetry.checkout.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Delivery fee</span>
                <span>{formatUGX(codRetry.checkout.delivery_fee)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold">{formatUGX(codRetry.checkout.total_amount)}</span>
              </div>
            </div>
          </div>
          {codRetry.error && <p className="text-sm text-red-600 mb-4">{codRetry.error}</p>}
          <button
            onClick={handlePlaceCodRetry}
            disabled={codRetry.submitting}
            className="w-full bg-[#EAAD11] text-black py-4 px-6 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {codRetry.submitting ? 'Placing order...' : 'Place order — pay on delivery'}
          </button>
          <button
            onClick={() => setCodRetry(null)}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-3"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h2 className="text-xl font-serif font-bold mb-2 capitalize">Payment {checkout.status}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Your items have been released back to the shop. You can try again.</p>
          {codRetry?.error && <p className="text-sm text-red-600 mb-4">{codRetry.error}</p>}
          <div className="flex flex-col gap-3">
            {checkout.status === 'failed' && checkout.payment_method === 'mobile_money' && (
              <button
                onClick={handleTryCod}
                disabled={codRetry?.submitting}
                className="inline-block bg-[#EAAD11] text-black py-3 px-6 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
              >
                {codRetry?.submitting ? 'Setting up...' : 'Try Cash on Delivery instead'}
              </button>
            )}
            <Link to="/cart" className="inline-block text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium">
              Back to Cart
            </Link>
          </div>
        </>
      )}
    </main>
  );
};

export default OrderConfirmation;
