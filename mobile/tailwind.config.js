/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Mirrors frontend/tailwind.config.js's pairing (DM Sans / Playfair
      // Display) — font family names here must match the keys registered
      // with useFonts in app/_layout.tsx exactly, since RN has no generic
      // font-weight fallback the way CSS font-family + font-weight does.
      fontFamily: {
        sans: ["DMSans_400Regular"],
        "sans-medium": ["DMSans_500Medium"],
        "sans-bold": ["DMSans_700Bold"],
        serif: ["PlayfairDisplay_400Regular"],
        "serif-bold": ["PlayfairDisplay_700Bold"],
      },
    },
  },
  plugins: [],
};
