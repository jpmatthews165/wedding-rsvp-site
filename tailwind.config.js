/** @type {import('tailwindcss').Config} */
// Site colors and fonts come from CSS variables so they can be changed in the
// editor (Site settings → Colors & fonts). Defaults live in src/index.css :root.
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: c('paper'),
        paper2: c('paper2'),
        brand: { DEFAULT: c('brand'), dark: c('brand-dark') },
        ink: { DEFAULT: c('ink'), soft: c('ink-soft') },
        accent: c('accent'),
        accent2: c('accent2'),
      },
      fontFamily: {
        title: ['var(--font-title)', 'serif'],
        subtitle: ['var(--font-subtitle)', 'sans-serif'],
        details: ['var(--font-body)', 'serif'],
      },
    },
  },
  plugins: [],
}
