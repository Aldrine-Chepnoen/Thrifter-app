/**
 * Utility to pick the right image URL for a desired display width.
 * Handles both storage eras:
 * - R2-hosted images (current): pre-generated WebP variants at fixed widths,
 *   addressed by swapping the /wNNN.webp suffix. Picks the smallest variant
 *   that is >= the requested width.
 * - Cloudinary-hosted images (legacy): on-the-fly transformation parameters
 *   injected into the URL.
 * @param {string} url - The stored image URL.
 * @param {number} width - The desired display width for the image.
 * @returns {string} - The URL to render.
 */
import { isR2Blocked } from './imageHost';

const R2_VARIANT_WIDTHS = [200, 400, 600, 800];

export const getOptimizedCloudinaryUrl = (url, width = 400) => {
  if (!url) return url;

  if (/\/w\d+\.webp$/.test(url)) {
    const target = R2_VARIANT_WIDTHS.find((w) => w >= width)
      || R2_VARIANT_WIDTHS[R2_VARIANT_WIDTHS.length - 1];
    return url.replace(/\/w\d+\.webp$/, `/w${target}.webp`);
  }

  if (!url.includes('cloudinary.com')) return url;

  // Inject transformation parameters: width, auto quality, auto format
  // We use 'c_limit' to ensure it doesn't upscale small images
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_limit/`);
};

// Very old rows store a bare filename served from the backend's /images dir
const toAbsoluteUrl = (path) => {
  if (path.startsWith('http')) return path;
  const base = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
  return `${base}/images/${path.split(/[\\/]/).pop()}`;
};

/**
 * Resolves the URL to render for an image, honouring the session's R2
 * reachability verdict (see imageHost.js): sessions that can't reach the R2
 * domain get the image's Cloudinary fallback_url instead.
 * @param {object|string} image - An object carrying { image_path, fallback_url }
 *   (an item, an item image, or an ad-hoc literal), or a bare URL string.
 * @param {number} width - The desired display width.
 * @returns {string|null} - The URL to render.
 */
export const getImageSrc = (image, width = 400) => {
  if (!image) return null;
  if (typeof image === 'string') return getOptimizedCloudinaryUrl(toAbsoluteUrl(image), width);
  if (!image.image_path) return null;
  if (isR2Blocked() && image.fallback_url) {
    return getOptimizedCloudinaryUrl(image.fallback_url, width);
  }
  return getOptimizedCloudinaryUrl(toAbsoluteUrl(image.image_path), width);
};
