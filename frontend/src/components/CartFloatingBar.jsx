import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

// Always-present nudge (not time-based) shown whenever the cart has items —
// floats above page content so it stays visible regardless of scroll
// position, on any page except the cart/checkout flow itself (where it'd be
// redundant). Links to /cart (review + existing availability checks there)
// rather than straight to /checkout. Ported from the mobile app's
// mobile/components/CartFloatingBar.tsx.
const HIDDEN_ON = ['/cart', '/checkout', '/checkout/complete'];

const CartFloatingBar = ({ cartItems, cartPulseKey = 0 }) => {
  const location = useLocation();
  const controls = useAnimation();
  const count = cartItems.length;
  const total = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.cartQuantity || 1), 0);

  useEffect(() => {
    if (cartPulseKey === 0 || count === 0) return;
    controls.set({ scale: 1 });
    controls.start({
      scale: [1, 1.04, 1],
      transition: { duration: 0.35, times: [0, 0.4, 1], ease: 'easeOut' },
    });
  }, [cartPulseKey, count, controls]);

  if (count === 0 || HIDDEN_ON.includes(location.pathname)) return null;

  return (
    <div className="fixed bottom-5 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <motion.div animate={controls} className="w-full max-w-[420px] pointer-events-auto">
        <Link
          to="/cart"
          className="flex items-center gap-3 bg-black dark:bg-gray-800 text-white rounded-2xl px-4 py-3 shadow-2xl hover:opacity-95 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-[#EAAD11] flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-4 h-4 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-300">
              {count} item{count !== 1 ? 's' : ''} · {formatUGX(total)}
            </p>
            <p className="text-sm font-bold">Complete your order</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[#EAAD11] font-bold text-sm">Checkout</span>
            <ArrowRight className="w-4 h-4 text-[#EAAD11]" />
          </div>
        </Link>
      </motion.div>
    </div>
  );
};

export default CartFloatingBar;
