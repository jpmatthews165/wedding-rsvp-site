// Measuring the rendered site for "Clean up" (editor only). Runs inside a hidden
// /preview-frame?measure=… iframe at a fixed desktop (1280 px) or phone (390 px)
// width; see src/admin/editor/measurer.js for the editor side.
//
// measureLayout: every selectable item of the chosen sections with where it really
//   sits (its own offsets and the phone re-flow included), relative to its section.
import { layoutBuffer, phoneBuffer } from '../content/fieldStyle.js';
import { resolvePhoneLayout } from './phoneLayout.js';
import { PHONE_QUERY } from './CoverImage.jsx';

const isPhone = () => window.matchMedia(PHONE_QUERY).matches;

// Layout box ignoring CSS transforms (e.g. the fade-in animation).
const layoutBox = (el) => {
  let x = 0, y = 0, n = el;
  while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
};

// The element's own translate (offsets + phone re-flow).
const ownTranslate = (el) => {
  const [tx = '0', ty = '0'] = (getComputedStyle(el).translate || '').split(' ');
  return { x: parseFloat(tx) || 0, y: parseFloat(ty) || 0 };
};
// Its translate plus that of the selectable items around it (a button in a moved card).
const totalTranslate = (el, sec) => {
  let x = 0, y = 0, n = el;
  while (n && n !== sec) {
    if (n.hasAttribute?.('data-el')) { const t = ownTranslate(n); x += t.x; y += t.y; }
    n = n.parentElement;
  }
  return { x, y };
};

const sectionOf = (root, base) => root.querySelector(`[data-section-base="${base}"] > section`);

export function measureLayout(root, bases, content) {
  resolvePhoneLayout(root, phoneBuffer(content.site));
  const phone = isPhone();
  return bases.map((base) => {
    const sec = sectionOf(root, base);
    if (!sec) return { base, missing: true };
    const s = layoutBox(sec);
    const cs = getComputedStyle(sec);
    const items = [...sec.querySelectorAll('[data-el]')]
      .filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0)
      .map((el) => {
        const path = el.getAttribute('data-el');
        const b = layoutBox(el);
        const t = totalTranslate(el, sec);
        const parent = el.parentElement?.closest('[data-el]');
        const kind = el.getAttribute('data-el-kind');
        const item = {
          key: path.slice(base.length + 1),
          kind,
          x: Math.round(b.left - s.left + t.x),
          y: Math.round(b.top - s.top + t.y),
          w: b.width,
          h: b.height,
        };
        if (parent && sec.contains(parent)) item.in = parent.getAttribute('data-el').slice(base.length + 1);
        if (kind === 'text') item.text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        return item;
      });
    return {
      base,
      device: phone ? 'phone' : 'desktop',
      width: s.width,
      height: s.height,
      paddingTop: Math.round(parseFloat(cs.paddingTop) || 0),
      paddingBottom: Math.round(parseFloat(cs.paddingBottom) || 0),
      buffer: phone ? phoneBuffer(content.site) : layoutBuffer(content.site),
      items,
    };
  });
}
