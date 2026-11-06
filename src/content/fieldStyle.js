// Per-element formatting and position, set from the editor's format bar and by
// dragging. Stored on each section as `styles`, keyed by the field path with dots
// replaced (e.g. "title", "items_0_q", "image"):
//
//   section.styles = {
//     title: { font: 'title', size: 1.25, color: 'brand' | '#a3401f', align: 'center',
//              bold: true, italic: false, x: 0, y: 24, mx: 0, my: 0 },
//   }
//
// font  — one of the theme roles (follows Site settings → Colors & fonts)
// size  — multiplier of the design's normal size (0.5–3), so phones still scale
// color — a theme color name (follows the palette) or a "#rrggbb" hex
// x, y  — desktop offset in px from the element's normal spot (snapped to a grid)
// mx,my — phone offset (screens up to 600 px); phones ignore desktop offsets
//
// Everything is validated here before it reaches CSS, so bad values are ignored.
import { isHex } from './theme.js';

export const styleKey = (f) => String(f).replace(/\./g, '_');

export const FONT_ROLES = [
  { key: 'title', label: 'Names & headings', css: 'var(--font-title)' },
  { key: 'subtitle', label: 'Labels & buttons', css: 'var(--font-subtitle)' },
  { key: 'body', label: 'Body text', css: 'var(--font-body)' },
];

// Theme color names → CSS. Keys match theme.colors (plus the derived brand-dark).
export const COLOR_TOKENS = [
  { key: 'brand', label: 'Main color', css: 'rgb(var(--c-brand))' },
  { key: 'ink', label: 'Text', css: 'rgb(var(--c-ink))' },
  { key: 'inkSoft', label: 'Soft text', css: 'rgb(var(--c-ink-soft))' },
  { key: 'accent', label: 'Accent', css: 'rgb(var(--c-accent))' },
  { key: 'accent2', label: 'Second accent', css: 'rgb(var(--c-accent2))' },
  { key: 'paper', label: 'Background', css: 'rgb(var(--c-paper))' },
  { key: 'paper2', label: 'Alternate background', css: 'rgb(var(--c-paper2))' },
];

export const ALIGNS = ['left', 'center', 'right', 'justify'];
export const OFFSET_LIMIT = 2000;

const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : undefined);

export const colorCss = (c) => {
  if (!c) return undefined;
  const token = COLOR_TOKENS.find((t) => t.key === c);
  if (token) return token.css;
  return isHex(c) ? (c.startsWith('#') ? c : `#${c}`) : undefined;
};

// Clean a raw style object (from content or the AI) to known keys and safe values.
export const cleanStyle = (s) => {
  if (!s || typeof s !== 'object') return {};
  const out = {};
  if (FONT_ROLES.some((r) => r.key === s.font)) out.font = s.font;
  const size = num(s.size, 0.5, 3); if (size !== undefined && size !== 1) out.size = size;
  if (colorCss(s.color)) out.color = s.color;
  if (ALIGNS.includes(s.align)) out.align = s.align;
  if (typeof s.bold === 'boolean') out.bold = s.bold;
  if (typeof s.italic === 'boolean') out.italic = s.italic;
  for (const k of ['x', 'y', 'mx', 'my']) {
    const v = num(s[k], -OFFSET_LIMIT, OFFSET_LIMIT);
    if (v) out[k] = Math.round(v);
  }
  return out;
};

// CSS for the text itself (font, size, color, weight, style).
export const textCss = (s) => {
  const st = cleanStyle(s);
  return {
    fontFamily: st.font ? FONT_ROLES.find((r) => r.key === st.font).css : undefined,
    fontSize: st.size ? `${st.size}em` : undefined,
    color: colorCss(st.color),
    fontWeight: st.bold === undefined ? undefined : st.bold ? 700 : 400,
    fontStyle: st.italic === undefined ? undefined : st.italic ? 'italic' : 'normal',
  };
};

// CSS for the element's box: alignment and drag offsets (see [data-moved] in index.css).
export const boxCss = (s) => {
  const st = cleanStyle(s);
  const css = { textAlign: st.align };
  if (st.x || st.y || st.mx || st.my) {
    css['--dx'] = `${st.x || 0}px`;
    css['--dy'] = `${st.y || 0}px`;
    css['--mx'] = `${st.mx || 0}px`;
    css['--my'] = `${st.my || 0}px`;
  }
  return css;
};

export const isMoved = (s) => {
  const st = cleanStyle(s);
  return !!(st.x || st.y || st.mx || st.my);
};
