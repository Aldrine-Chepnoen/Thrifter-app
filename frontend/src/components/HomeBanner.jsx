import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// How long each banner stays up before the carousel advances to the next one.
const ROTATE_INTERVAL_MS = 5000;

const scrollToItems = () =>
  window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });

// Shared across every slide so the one actual action (jump to the listings)
// looks and behaves identically no matter which banner design is showing.
function ExploreButton({ className = '' }) {
  return (
    <button
      type="button"
      onClick={scrollToItems}
      className={`inline-flex w-fit items-center justify-center gap-1 rounded-full bg-[#252B32] dark:bg-[#EAAD11] px-3 py-1 text-[10px] font-bold text-white dark:text-black shadow-md transition-all duration-200 hover:scale-[1.02] hover:bg-[#1D2228] dark:hover:bg-[#EAAD11]/90 active:scale-95 md:gap-2.5 md:px-6 md:py-2.5 md:text-[14px] ${className}`}
    >
      <span>Explore now</span>
      <span className="text-xs leading-none md:text-lg" aria-hidden="true">
        →
      </span>
    </button>
  );
}

// The banner shipped today (cream card, two-column grid, "new-banner.png").
// Desktop sizing redone to a real three-level scale (headline / body / tip)
// in a compact 232px masthead, rather than the four ad-hoc sizes stacked
// into a 390px hero this replaced — see HomeBanner's git history for that
// version. Mobile's fixed 134px row height is untouched; the image column
// is 45% (up from 36%) so the cropped banner photo's 560x432 frame fits the
// fixed-height row without cropping into the jeans or tote bag on either
// side — at that height a landscape photo this wide needs ~46% of a ~390px
// phone's banner width to show edge-to-edge; narrower phones still crop a
// few px, but far less than at 36%.
function CurrentBanner() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl md:rounded-[20px] border-2 border-[#D99A1E] dark:border-[#EAAD11] bg-[#F8F5ED] dark:bg-gray-900 shadow-sm">
      <div className="grid grid-cols-[1fr_45%] h-[134px] md:grid-cols-[1.15fr_1fr] md:h-[232px]">
        <div className="flex flex-col justify-center px-4 py-2 md:px-10 lg:px-12">
          <div className="max-w-[460px]">
            <h2 className="font-serif text-[15px] leading-[1.15] font-bold text-[#252B32] dark:text-gray-100 md:text-[32px] md:leading-[1.15]">
              Secure your next fit
            </h2>

            <div className="mt-1 md:mt-3">
              <p className="text-[9px] leading-[1.35] font-semibold text-[#252B32] dark:text-gray-200 md:text-[16px] md:font-medium md:leading-[1.4]">
                Discover fashion around Kampala
              </p>
              <p className="text-[8px] leading-[1.35] font-semibold text-[#252B32] dark:text-gray-200 md:text-[16px] md:font-medium md:leading-[1.4]">
                Thrift stores, clothing brands, fashion designers
              </p>
            </div>

            <ExploreButton className="mt-1.5 md:mt-5" />

            <p className="mt-2 hidden max-w-[300px] text-[12.5px] italic leading-[1.4] text-[#252B32]/55 dark:text-gray-500 md:block">
              Tip: add items to your wardrobe for a personalized 'For You' feed.
            </p>
          </div>
        </div>

        <div className="relative h-full overflow-hidden bg-[#F8F5ED] dark:bg-gray-900">
          <img
            src="/new-banner.png"
            alt="Thrifter fashion showcase"
            className="absolute inset-0 h-full w-full object-cover object-center md:object-contain md:object-right"
          />
        </div>
      </div>
    </div>
  );
}

// Vendor-facing promo slide, ported from the Figma "SELL AN ITEM NOW" frame.
// Originally kept the source's own gold gradient, white/stroked Inter
// uppercase treatment — recolored to CurrentBanner's exact palette and type
// scale (serif headline, same cream/navy or gray-900/gray-100 card, same
// body/tip sizes) instead, so the carousel reads as one consistent banner
// rather than three differently-styled ones. No button in the source design
// (the arrow-flow line stands in for one) — left non-interactive as-is.
// Desktop text sized up beyond CurrentBanner/BuyBanner's scale (mobile
// separately below) since this is the one slide with no image reserving
// half the card — the full banner width is free for text, so it can run
// bigger without the wrapping risk a split-column slide would have.
// Mobile also got a size pass: no button and no second body line means this
// slide uses noticeably less of its fixed 134px row than CurrentBanner does,
// leaving enough slack to grow the text and show the tip without growing
// the row itself — the shared 134px stays untouched so the carousel doesn't
// jump height between slides.
function SellBanner() {
  return (
    <div className="relative w-full h-[134px] md:h-[232px] overflow-hidden rounded-2xl md:rounded-[20px] border-2 border-[#D99A1E] dark:border-[#EAAD11] bg-[#F8F5ED] dark:bg-gray-900 shadow-sm">
      <div className="flex h-full flex-col justify-center px-4 py-2 md:px-10 lg:px-12">
        <div className="max-w-[460px] md:max-w-[620px]">
          <h2 className="font-serif text-[19px] leading-[1.15] font-bold text-[#252B32] dark:text-gray-100 md:text-[46px] md:leading-[1.1]">
            Sell an item now
          </h2>

          <p className="mt-1.5 text-[13px] leading-[1.35] font-semibold text-[#252B32] dark:text-gray-200 md:mt-4 md:text-[20px] md:font-medium md:leading-[1.4]">
            Sign up as a brand → Upload items → We deliver
          </p>

          <p className="mt-2 max-w-[300px] text-[10px] italic leading-[1.35] text-[#252B32]/55 dark:text-gray-500 md:max-w-[400px] md:text-[14px] md:leading-[1.4]">
            Tip: share your vendor link on socials to get more page visits.
          </p>
        </div>
      </div>
    </div>
  );
}

// Buyer-facing promo slide, ported from the Figma "GET YOUR ITEMS NOW"
// frame — same recoloring as SellBanner, plus the frame's own image (hands
// taping a delivery box, exported from Figma as delivery-box.png).
// Absolutely positioned bottom-right and floated directly on the card's own
// background rather than a separate colored panel — the same treatment
// CurrentBanner's photo already uses since its image column background was
// matched to the card color. Mobile sized up like SellBanner (same slack
// from having no button/second body line to fill the fixed 134px row), but
// a bit more conservatively since the image still takes 42% of the width
// here — the shared 134px row height itself is unchanged.
function BuyBanner() {
  return (
    <div className="relative w-full h-[134px] md:h-[232px] overflow-hidden rounded-2xl md:rounded-[20px] border-2 border-[#D99A1E] dark:border-[#EAAD11] bg-[#F8F5ED] dark:bg-gray-900 shadow-sm">
      <div className="relative z-10 flex h-full max-w-[62%] flex-col justify-center px-4 py-2 md:max-w-[58%] md:px-10 lg:px-12">
        <h2 className="font-serif text-[17px] leading-[1.15] font-bold text-[#252B32] dark:text-gray-100 md:text-[40px] md:leading-[1.15]">
          Get your items now
        </h2>

        <p className="mt-1.5 text-[11.5px] leading-[1.3] font-semibold text-[#252B32] dark:text-gray-200 md:mt-4 md:text-[19px] md:font-medium md:leading-[1.4]">
          Add to cart → Checkout → We deliver
        </p>

        <p className="mt-1.5 max-w-[200px] text-[9px] italic leading-[1.3] text-[#252B32]/55 dark:text-gray-500 md:mt-3 md:max-w-[320px] md:text-[13.5px] md:leading-[1.4]">
          Tip: order from multiple vendors and receive all pieces in one delivery.
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-0 right-0 flex h-full w-[42%] items-end justify-end md:w-[38%]">
        <img
          src="/delivery-box.png"
          alt="Hands taping up a delivery box"
          className="h-full w-full object-contain object-bottom md:h-[105%]"
        />
      </div>
    </div>
  );
}

const SLIDES = [CurrentBanner, SellBanner, BuyBanner];

export default function HomeBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ).current;

  useEffect(() => {
    if (prefersReducedMotion || paused || SLIDES.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, prefersReducedMotion]);

  const Slide = SLIDES[index];

  return (
    <div
      className="px-3 md:px-6 mb-8 mt-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Slide />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
