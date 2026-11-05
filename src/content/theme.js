// Colors and fonts for the public site, editable in Site settings → Colors & fonts.
// Stored in content.theme; turned into CSS variables by <ThemeStyle /> (src/site/ThemeStyle.jsx).

export const COLOR_FIELDS = [
  { key: 'paper', label: 'Background', help: 'Main page background.' },
  { key: 'paper2', label: 'Alternate background', help: 'Every other section, cards, hotel box.' },
  { key: 'brand', label: 'Main color', help: 'Names, headings, buttons, countdown band.' },
  { key: 'ink', label: 'Text', help: 'Body text.' },
  { key: 'inkSoft', label: 'Soft text', help: 'Small labels like "When" and "Where".' },
  { key: 'accent', label: 'Accent', help: 'Decline button, error messages, text highlight.' },
  { key: 'accent2', label: 'Second accent', help: 'Thin lines next to travel details.' },
];

export const FONT_SLOTS = [
  { key: 'title', label: 'Names & big headings', sample: 'Josh & Sneha' },
  { key: 'subtitle', label: 'Labels & buttons', sample: 'WE INVITE YOU TO CELEBRATE' },
  { key: 'body', label: 'Body text', sample: 'Saturday, May 29th at Lucien’s Manor' },
];

// Fonts bundled with the site (public/fonts).
export const BUILTIN_FONTS = [
  { family: 'Le Major', fallback: 'serif' },
  { family: 'Ablation', fallback: 'sans-serif' },
  { family: 'Cardo', fallback: 'serif' },
  { family: 'Georgia', fallback: 'serif' },
  { family: 'Helvetica Neue', fallback: 'sans-serif' },
];

// A starting list of Google Fonts that suit wedding sites. Any Google Fonts family
// name works (fonts.google.com); this is just for the suggestions dropdown.
export const GOOGLE_FONT_SUGGESTIONS = [
  'Cormorant Garamond', 'Cormorant', 'Playfair Display', 'Great Vibes', 'Parisienne', 'Pinyon Script',
  'Allura', 'Alex Brush', 'Dancing Script', 'Sacramento', 'Italianno', 'Tangerine', 'Mrs Saint Delafield',
  'Cinzel', 'Cinzel Decorative', 'Bodoni Moda', 'Libre Baskerville', 'EB Garamond', 'Lora', 'Marcellus',
  'Josefin Sans', 'Montserrat', 'Raleway', 'Lato', 'Jost', 'Tenor Sans', 'Poppins', 'Quicksand',
  'Bellefair', 'Italiana', 'Gilda Display', 'Fraunces', 'DM Serif Display', 'Prata', 'Forum',
];

export const DEFAULT_THEME = {
  colors: {
    paper: '#e6dbcc', paper2: '#dccfb9', brand: '#6c5d84', ink: '#333036',
    inkSoft: '#4a4552', accent: '#d4a5a5', accent2: '#b0c4de',
  },
  fonts: {
    title: { source: 'builtin', family: 'Le Major', url: '' },
    subtitle: { source: 'builtin', family: 'Ablation', url: '' },
    body: { source: 'builtin', family: 'Cardo', url: '' },
  },
};

export const THEME_PRESETS = [
  { name: 'Lavender (original)', colors: DEFAULT_THEME.colors },
  { name: 'Sage', colors: { paper: '#eef0e8', paper2: '#dfe4d6', brand: '#5f7356', ink: '#2f332c', inkSoft: '#4c5346', accent: '#d9b8a3', accent2: '#a9bfa8' } },
  { name: 'Dusty rose', colors: { paper: '#f5ebe8', paper2: '#ead8d3', brand: '#9b5f6b', ink: '#3a2e31', inkSoft: '#5a4a4e', accent: '#c9a27e', accent2: '#d9b8c0' } },
  { name: 'Navy & gold', colors: { paper: '#f6f2ea', paper2: '#e9e1d1', brand: '#1f3354', ink: '#1d2230', inkSoft: '#3e4558', accent: '#c8a45c', accent2: '#9fb3cf' } },
  { name: 'Terracotta', colors: { paper: '#f4ece2', paper2: '#e8d9c6', brand: '#b45f3c', ink: '#3b2a22', inkSoft: '#5e4637', accent: '#d9a46b', accent2: '#c2b38f' } },
  { name: 'Emerald', colors: { paper: '#f3f0e8', paper2: '#e2ddcf', brand: '#1f5a46', ink: '#1f2b27', inkSoft: '#3e4c46', accent: '#c9a96e', accent2: '#9cbfae' } },
  { name: 'Black & white', colors: { paper: '#fafafa', paper2: '#efefef', brand: '#1a1a1a', ink: '#222222', inkSoft: '#555555', accent: '#bdbdbd', accent2: '#cccccc' } },
];

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isHex = (v) => typeof v === 'string' && HEX.test(v.trim());

const toRgb = (hex) => {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const channels = (hex) => toRgb(hex).join(' ');
const darken = (hex, amount = 0.24) => toRgb(hex).map((v) => Math.round(v * (1 - amount))).join(' ');

const cssString = (s) => `'${String(s).replace(/['\\\n\r]/g, '')}'`;
const fallbackFor = { title: 'serif', subtitle: 'sans-serif', body: 'serif' };

// Returns { css, googleFamilies } for a theme. Invalid values fall back to defaults.
export const buildTheme = (theme = {}) => {
  const colors = { ...DEFAULT_THEME.colors };
  Object.entries(theme.colors || {}).forEach(([k, v]) => { if (k in colors && isHex(v)) colors[k] = v; });

  const vars = [
    `--c-paper: ${channels(colors.paper)}`, `--c-paper2: ${channels(colors.paper2)}`,
    `--c-brand: ${channels(colors.brand)}`, `--c-brand-dark: ${darken(colors.brand)}`,
    `--c-ink: ${channels(colors.ink)}`, `--c-ink-soft: ${channels(colors.inkSoft)}`,
    `--c-accent: ${channels(colors.accent)}`, `--c-accent2: ${channels(colors.accent2)}`,
  ];

  const faces = [];
  const googleFamilies = [];
  FONT_SLOTS.forEach(({ key }) => {
    const f = { ...DEFAULT_THEME.fonts[key], ...(theme.fonts?.[key] || {}) };
    let family = f.family || DEFAULT_THEME.fonts[key].family;
    if (f.source === 'custom' && f.url) {
      family = `Wedding ${key}`;
      faces.push(`@font-face { font-family: ${cssString(family)}; src: url(${JSON.stringify(f.url)}); font-display: swap; }`);
    } else if (f.source === 'google' && f.family) {
      googleFamilies.push(f.family);
    }
    vars.push(`--font-${key}: ${cssString(family)}, ${fallbackFor[key]}`);
  });

  return { css: `${faces.join('\n')}\n:root { ${vars.join('; ')}; }`, googleFamilies: [...new Set(googleFamilies)] };
};

export const googleFontsHref = (families) => families.length
  ? `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f.trim()).replace(/%20/g, '+')}`).join('&')}&display=swap`
  : null;
