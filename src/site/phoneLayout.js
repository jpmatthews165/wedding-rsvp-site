import { useLayoutEffect } from 'react';
import { PHONE_QUERY } from './CoverImage.jsx';

// Automatic phone layout (screens up to 600 px), worked out on the phone itself.
//
// 1. Re-flow: sections with a saved desktop reading order (data-phone-order, set by
//    the editor whenever something in the section is moved or resized on desktop)
//    are re-stacked in that order — "left-top to bottom-right" on desktop becomes
//    top-to-bottom on the phone. Items that share a line on the phone move together,
//    and the phone's own spacing between items is kept, so the section keeps its
//    height. Implemented as a vertical shift (--ry) per item; nothing in the page
//    structure changes.
// 2. Placement: items laid out automatically (data-pl = desktop placement, 0 = left
//    buffer … 1 = right buffer) are placed at the same relative spot horizontally,
//    never past the section's buffer.
// Items hand-tuned in the editor's phone preview keep their own offsets (--mx/--my);
// the re-flow shift is added underneath so they stay in reading order.

// Layout box ignoring CSS transforms/translate (e.g. the fade-in animation).
const layoutBox = (el) => {
  let x = 0, y = 0, n = el;
  while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
};

const topLevelItems = (root) => [...root.querySelectorAll('[data-el]')].filter((el) => {
  const outer = el.parentElement?.closest('[data-el]');
  return !outer || !root.contains(outer);
});

function reflowSection(wrapper) {
  let order;
  try { order = JSON.parse(wrapper.getAttribute('data-phone-order')); } catch { return; }
  const base = wrapper.getAttribute('data-section-base');
  const items = topLevelItems(wrapper).filter((el) => el.offsetHeight > 0);
  items.forEach((el) => el.style.setProperty('--ry', '0px'));
  if (items.length < 2) return;

  // Natural phone positions, grouped into lines (items sharing vertical space).
  const boxes = items.map((el) => ({ el, key: el.getAttribute('data-el').slice(base.length + 1), ...layoutBox(el) }));
  boxes.sort((a, b) => a.top - b.top);
  const lines = [];
  for (const b of boxes) {
    const line = lines[lines.length - 1];
    if (line && b.top < line.bottom - 2) { line.items.push(b); line.bottom = Math.max(line.bottom, b.bottom); }
    else lines.push({ top: b.top, bottom: b.bottom, items: [b] });
  }
  // Gap after each line in the natural phone layout (kept when re-stacking).
  lines.forEach((l, i) => { l.gapAfter = i < lines.length - 1 ? Math.max(0, lines[i + 1].top - l.bottom) : 0; });

  // Desired order of lines: by the earliest desktop reading position of their items.
  const rank = (key) => { const i = order.indexOf(key); return i === -1 ? Infinity : i; };
  lines.forEach((l, i) => { l.natural = i; l.rank = Math.min(...l.items.map((b) => rank(b.key))); });
  const sorted = [...lines].sort((a, b) => (a.rank - b.rank) || (a.natural - b.natural));
  if (sorted.every((l, i) => l === lines[i])) return; // already in reading order

  // Re-stack: same start, each line followed by its own natural gap.
  let cursor = lines[0].top;
  for (const l of sorted) {
    const dy = Math.round(cursor - l.top);
    l.items.forEach((b) => {
      b.el.style.setProperty('--ry', `${dy}px`);
      b.el.setAttribute('data-reflow', '');
    });
    cursor += (l.bottom - l.top) + l.gapAfter;
  }
}

function placeHorizontally(root, buffer) {
  root.querySelectorAll('[data-pl]').forEach((el) => {
    const section = el.closest('section');
    if (!section) return;
    const s = layoutBox(section);
    const r = layoutBox(el);
    const inner = s.width - 2 * buffer;
    const free = inner - r.width;
    const pl = Math.min(1, Math.max(0, parseFloat(el.getAttribute('data-pl')) || 0));
    let mx = 0;
    if (free > 0) {
      mx = s.left + buffer + pl * free - r.left;
      mx = Math.max(s.left + buffer - r.left, Math.min(s.right - buffer - r.right, mx));
    }
    el.style.setProperty('--mx', `${Math.round(mx)}px`);
    el.setAttribute('data-moved', '');
  });
}

export function resolvePhoneLayout(root, buffer) {
  if (!root) return;
  if (!window.matchMedia(PHONE_QUERY).matches) {
    root.querySelectorAll('[data-reflow]').forEach((el) => { el.removeAttribute('data-reflow'); el.style.removeProperty('--ry'); });
    return;
  }
  root.querySelectorAll('[data-phone-order]').forEach(reflowSection);
  placeHorizontally(root, buffer);
}

// Re-run after every render and on resize/orientation change.
export function usePhoneLayout(rootRef, buffer, deps) {
  useLayoutEffect(() => {
    let frame = 0;
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => resolvePhoneLayout(rootRef.current, buffer)); };
    run();
    // Fonts and photos change sizes as they load.
    const t = setTimeout(run, 600);
    const t2 = setTimeout(run, 2000);
    window.addEventListener('resize', run);
    window.addEventListener('load', run);
    document.fonts?.ready?.then(run).catch(() => {});
    return () => {
      cancelAnimationFrame(frame); clearTimeout(t); clearTimeout(t2);
      window.removeEventListener('resize', run); window.removeEventListener('load', run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
