// This is the Tailwind CSS configuration file for the Thrifter frontend application. It specifies the content files to be scanned for class names, extends the default theme with custom font families, and includes an empty plugins array for any future Tailwind CSS plugins that may be added.
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}
