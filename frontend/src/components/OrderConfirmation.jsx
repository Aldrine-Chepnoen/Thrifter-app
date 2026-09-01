import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { getCheckout } from '../api';

const OrderConfirmation = () => {
  const [searchParams] = useSearchParams();
  const checkoutId = searchParams.get('checkout_id');
  const [checkout, setCheckout] = useState(null);
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef(null);

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
      ) : (
        <>
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h2 className="text-xl font-serif font-bold mb-2 capitalize">Payment {checkout.status}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Your items have been released back to the shop. You can try again.</p>
          <Link to="/cart" className="inline-block bg-[#EAAD11] text-black py-3 px-6 rounded-xl font-bold hover:opacity-90">
            Back to Cart
          </Link>
        </>
      )}
    </main>
  );
};

export default OrderConfirmation;
