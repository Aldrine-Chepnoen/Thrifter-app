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
const R2_VARIANT_WIDTHS = [200, 600, 800];

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
