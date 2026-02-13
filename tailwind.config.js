/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#E30613',
          hover: '#b90510',
          yellow: '#FFDE00',
          black: '#0F172A'
        }
      }
    }
  },
  plugins: [],
}
