import { useLayoutEffect } from 'react';
import { PHONE_QUERY } from './CoverImage.jsx';

// Automatic phone layout (screens up to 600 px).
// Desktop edits save each item's *intent* — its horizontal placement within its
// section (data-pl: 0 = left buffer … 1 = right buffer) and a scaled vertical move —
// instead of phone pixels. Here, on the phone itself, we measure the real phone
// layout and work out the exact offset, so the item lands in the same relative spot
// and never crosses the section's buffer. Items whose phone layout was hand-tuned in
// the editor don't carry data-pl and are left alone.

const measureNatural = (el) => {
  const prev = el.style.translate;
  el.style.translate = '0px 0px';
  const r = el.getBoundingClientRect();
  el.style.translate = prev;
  return r;
};

export function resolvePhoneLayout(root, buffer) {
  if (!root || !window.matchMedia(PHONE_QUERY).matches) return;
  root.querySelectorAll('[data-pl]').forEach((el) => {
    const section = el.closest('section');
    if (!section) return;
    const s = section.getBoundingClientRect();
    const r = measureNatural(el);
    const inner = s.width - 2 * buffer;
    const free = inner - r.width;
    const pl = Math.min(1, Math.max(0, parseFloat(el.getAttribute('data-pl')) || 0));
    let mx = 0;
    if (free > 0) mx = s.left + buffer + pl * free - r.left;
    // Never past the left/right buffer.
    mx = Math.max(s.left + buffer - r.left, Math.min(s.right - buffer - r.right, mx));
    if (free <= 0) mx = 0;
    // Vertical: keep the saved (scaled) move, but inside the top/bottom buffer.
    let my = parseFloat(getComputedStyle(el).getPropertyValue('--my')) || 0;
    if (r.height < s.height - 2 * buffer) {
      my = Math.max(s.top + buffer - r.top, Math.min(s.bottom - buffer - r.bottom, my));
    }
    el.style.setProperty('--mx', `${Math.round(mx)}px`);
    el.style.setProperty('--my', `${Math.round(my)}px`);
    el.setAttribute('data-moved', '');
  });
}

// Re-run after every render and on resize/orientation change.
export function usePhoneLayout(rootRef, buffer, deps) {
  useLayoutEffect(() => {
    let frame = 0;
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => resolvePhoneLayout(rootRef.current, buffer)); };
    run();
    // Fonts and photos change sizes as they load.
    const t = setTimeout(run, 600);
    window.addEventListener('resize', run);
    document.fonts?.ready?.then(run).catch(() => {});
    return () => { cancelAnimationFrame(frame); clearTimeout(t); window.removeEventListener('resize', run); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
