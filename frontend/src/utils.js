/**
 * Utility to optimize Cloudinary URLs by injecting transformation parameters.
 * @param {string} url - The original Cloudinary URL.
 * @param {number} width - The desired width for the image.
 * @returns {string} - The optimized URL.
 */
export const getOptimizedCloudinaryUrl = (url, width = 400) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  // Inject transformation parameters: width, auto quality, auto format
  // We use 'c_limit' to ensure it doesn't upscale small images
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_limit/`);
};
