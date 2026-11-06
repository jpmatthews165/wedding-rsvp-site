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
// w, h  — desktop size in px (text boxes: width only); mw, mh — phone size
// fill  — background color for buttons, lines and boxes (token or hex)
// radius— corner rounding in px for photos, buttons, boxes and the map
// mAuto — false once phone values were hand-tuned in the phone preview; until then
//         phone values are worked out automatically from desktop edits
// si, pw, ew, pl — desktop measurements saved with the last desktop edit (section
//         inner width, container width, item width, placement ×1000) so the phone
//         approximation can be redone later
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
export const SIZE_MIN = 1;
export const SIZE_MAX = 4000;
export const RADIUS_MAX = 400;

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
  for (const k of ['w', 'h', 'mw', 'mh']) {
    const v = num(s[k], SIZE_MIN, SIZE_MAX);
    if (v) out[k] = Math.round(v);
  }
  if (colorCss(s.fill)) out.fill = s.fill;
  const radius = num(s.radius, 0, RADIUS_MAX); if (radius !== undefined) out.radius = Math.round(radius);
  if (s.mAuto === false) out.mAuto = false;
  for (const k of ['si', 'pw', 'ew']) { const v = num(s[k], 1, SIZE_MAX); if (v) out[k] = Math.round(v); }
  { const v = num(s.pl, 0, 1000); if (v !== undefined) out.pl = Math.round(v); }
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

// CSS for the element's box: alignment, fill, rounding, drag offsets and size
// (see [data-moved] / [data-w] … in index.css).
export const boxCss = (s) => {
  const st = cleanStyle(s);
  const css = { textAlign: st.align };
  if (st.fill) css.backgroundColor = colorCss(st.fill);
  if (st.radius !== undefined) css.borderRadius = `${st.radius}px`;
  if (st.x || st.y || st.mx || st.my) {
    css['--dx'] = `${st.x || 0}px`;
    css['--dy'] = `${st.y || 0}px`;
    css['--mx'] = `${st.mx || 0}px`;
    css['--my'] = `${st.my || 0}px`;
  }
  for (const k of ['w', 'h', 'mw', 'mh']) if (st[k]) css[`--${k}`] = `${st[k]}px`;
  return css;
};

// data-* attributes that switch the position/size CSS on for this element.
export const boxAttrs = (s) => {
  const st = cleanStyle(s);
  const flag = (on) => (on ? '' : undefined);
  return {
    'data-moved': flag(st.x || st.y || st.mx || st.my),
    'data-w': flag(st.w), 'data-h': flag(st.h), 'data-mw': flag(st.mw), 'data-mh': flag(st.mh),
    // Automatic phone layout: where it sits horizontally (resolved on phones).
    'data-pl': st.mAuto !== false && st.x ? String((st.pl ?? 500) / 1000) : undefined,
  };
};

export const isMoved = (s) => {
  const st = cleanStyle(s);
  return !!(st.x || st.y || st.mx || st.my);
};
export const isSized = (s) => {
  const st = cleanStyle(s);
  return !!(st.w || st.h || st.mw || st.mh);
};

// ---- Layout settings shared by the editor (grid, buffer)
export const GRID_SIZES = [16, 24, 32, 48];
export const BUFFER_SIZES = [16, 24, 32, 48, 64];
export const layoutGrid = (site) => (GRID_SIZES.includes(site?.layoutGrid) ? site.layoutGrid : 16);
export const layoutBuffer = (site) => (BUFFER_SIZES.includes(site?.layoutBuffer) ? site.layoutBuffer : 24);
export const phoneBuffer = (site) => Math.max(8, Math.round(layoutBuffer(site) * 2 / 3));

// ---- Close approximation of phone values from a desktop edit.
// Phones stack columns, so pixel offsets don't transfer. Instead:
// - size: the same share of the container (buttons/lines keep their px, capped),
//   photos keep their shape;
// - horizontal: the same *relative placement* within the free space (0 = at the
//   left buffer, 1 = at the right buffer), resolved on the phone itself by
//   src/site/phoneLayout.js (so it never crosses the buffer);
// - vertical: from the section's desktop reading order (re-flow on the phone).
// `m` = desktop measurements at the edit: sectionInner, parentWidth, width (item
// width) and placement (0–1). Phone reference width: 390 px.
export const PHONE_REF_WIDTH = 390;
export const approximatePhone = (st, kind, m, site) => {
  const inner = PHONE_REF_WIDTH - 2 * phoneBuffer(site);
  const out = { mx: undefined, my: undefined, mw: undefined, mh: undefined };
  if (st.w) {
    const share = Math.min(1, st.w / (m.parentWidth || st.w));
    out.mw = Math.round(Math.min(inner, kind === 'button' || kind === 'line' ? st.w : share * inner));
  }
  if (st.h) {
    if (kind === 'line') out.mh = st.h;
    else if (st.w && out.mw) out.mh = Math.round(out.mw * (st.h / st.w));
    else out.mh = Math.round(st.h * Math.min(1, inner / (m.parentWidth || inner)));
  }
  // Horizontal position is not guessed here: the phone works it out from the saved
  // placement (`pl`) against its real layout — see src/site/phoneLayout.js.
  // Vertical position comes from re-flowing the section in desktop reading order
  // (phoneOrder + src/site/phoneLayout.js), so desktop y moves aren't copied.
  return out;
};

// ---- Section height (dragging a section's bottom edge in the editor).
// Stored on the section as `layout`:
//   h, pb   — desktop: minimum height and bottom padding in px
//   mh, mpb — phone: the same (set when fine-tuned in the phone preview)
//   d       — desktop change vs the design's own height (px); phones without their
//             own values get half of it, worked out on the phone (phoneLayout.js)
export const cleanSectionLayout = (l) => {
  if (!l || typeof l !== 'object') return {};
  const out = {};
  for (const k of ['h', 'pb', 'mh', 'mpb']) {
    const v = num(l[k], 0, 8000);
    if (v !== undefined) out[k] = Math.round(v);
  }
  const d = num(l.d, -8000, 8000); if (d) out.d = Math.round(d);
  return out;
};

// Props for the wrapper around a section (CSS in index.css: [data-sh] > section …).
export const sectionLayoutProps = (l) => {
  const st = cleanSectionLayout(l);
  const props = { style: {} };
  if (st.h !== undefined) {
    props['data-sh'] = '';
    props.style['--sh'] = `${st.h}px`;
    props.style['--spb'] = `${st.pb ?? 0}px`;
  }
  if (st.mh !== undefined) {
    props['data-msh'] = '';
    props.style['--msh'] = `${st.mh}px`;
    props.style['--mspb'] = `${st.mpb ?? 0}px`;
  } else if (st.d) {
    props['data-sd'] = String(st.d); // automatic phone height (resolved on phones)
  }
  return props;
};

// ---- Section background (click empty space in a section in the editor).
// Stored on the section as `bg`:
//   color        — theme color name or "#rrggbb": the section's background color
//   image, imagePos — a background photo + its focal point/zoom (like any photo)
//   imageOpacity — 0–100 (default 100); a see-through photo shows the color under it
// Sections whose design already has a background photo (cover, registry, RSVP) keep
// using their own `image` field; `bg` only adds the color and the photo's opacity.
export const NATIVE_BG_IMAGE = ['hero', 'registry', 'rsvp'];
export const bgImageField = (type) => (NATIVE_BG_IMAGE.includes(type) ? 'image' : 'bg.image');

export const cleanSectionBg = (b) => {
  if (!b || typeof b !== 'object') return {};
  const out = {};
  if (colorCss(b.color)) out.color = b.color;
  const io = num(b.imageOpacity, 0, 100); if (io !== undefined) out.imageOpacity = Math.round(io);
  if (typeof b.image === 'string' && b.image.trim()) out.image = b.image;
  if (b.imagePos && typeof b.imagePos === 'object') out.imagePos = b.imagePos;
  return out;
};

// Wrapper props: switch on the background layer (and the native photo's opacity).
export const sectionBgProps = (section) => {
  const bg = cleanSectionBg(section?.bg);
  const native = NATIVE_BG_IMAGE.includes(section?.type);
  const props = { style: {} };
  if (bg.color || (!native && bg.image)) props['data-has-bg'] = '';
  if (native && bg.imageOpacity !== undefined && bg.imageOpacity !== 100) {
    props['data-bgio'] = '';
    props.style['--bgio'] = String(bg.imageOpacity / 100);
  }
  return props;
};
