import React, { useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const SWIPE_THRESHOLD_PX = 50;

// Full-size preview for a clicked thumbnail — click the backdrop, the image
// itself never closes it (only its own X button or the backdrop does).
// `images` is [{ src }, ...]; when there's more than one, arrow buttons,
// dot indicators, and a horizontal swipe all page through the rest without
// leaving the preview.
const ImageLightbox = ({ images, initialIndex = 0, alt, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef(null);
  const touchDeltaX = useRef(0);
  const didSwipeRef = useRef(false);

  if (!images || images.length === 0) return null;
  const hasMultiple = images.length > 1;

  const goPrev = (e) => { e.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length); };
  const goNext = (e) => { e.stopPropagation(); setIndex((i) => (i + 1) % images.length); };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (hasMultiple && Math.abs(touchDeltaX.current) > SWIPE_THRESHOLD_PX) {
      didSwipeRef.current = true;
      if (touchDeltaX.current < 0) setIndex((i) => (i + 1) % images.length);
      else setIndex((i) => (i - 1 + images.length) % images.length);
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };
  // A swipe still ends in a synthetic click on mobile browsers — swallow
  // that one click so releasing a swipe over the backdrop doesn't also
  // close the lightbox.
  const handleBackdropClick = () => {
    if (didSwipeRef.current) { didSwipeRef.current = false; return; }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6 touch-none"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
        aria-label="Close"
      >
        <X className="w-7 h-7" />
      </button>
      {hasMultiple && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      <img
        src={images[index].src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      {hasMultiple && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
          aria-label="Next image"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
      {hasMultiple && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/40'}`}
              aria-label={`Image ${i + 1} of ${images.length}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageLightbox;
