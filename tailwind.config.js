/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        title: ['Le Major', 'serif'],
        subtitle: ['Ablation', 'sans-serif'],
        details: ['Cardo', 'serif'],
      },
    },
  },
  plugins: [],
}
