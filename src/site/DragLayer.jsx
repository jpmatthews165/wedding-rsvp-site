import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { getAt } from '../content/paths.js';
import { cleanStyle, styleKey } from '../content/fieldStyle.js';
import { PHONE_QUERY } from './CoverImage.jsx';

// Editor-only overlay (inside the preview iframe) for the selected element:
// a drag handle, a snapping grid with margins, and a centre guide.
// Dragging changes only the element's offset (CSS translate), never the layout
// around it. Desktop and phone offsets are stored separately (x/y vs mx/my).

const MARGIN_DESKTOP = 24;
const MARGIN_PHONE = 16;
const CENTER_SNAP = 8; // px: how close to the centre line before it snaps

const splitPath = (sel) => {
  const m = /^(sections\.\d+)\.(.+)$/.exec(sel || '');
  return m ? { base: m[1], f: m[2] } : null;
};

export default function DragLayer({ content, edit }) {
  const sel = edit.selectedEl;
  const step = edit.grid?.step || 8;
  const [box, setBox] = useState(null);        // { el, rect, section } in viewport coords
  const [drag, setDrag] = useState(null);       // live drag info for guides
  const dragRef = useRef(null);

  const parts = splitPath(sel);
  const style = parts ? cleanStyle(getAt(content, `${parts.base}.styles.${styleKey(parts.f)}`)) : {};
  const stylePath = parts ? `${parts.base}.styles.${styleKey(parts.f)}` : null;

  // Track the selected element's position every frame while selected.
  useEffect(() => {
    if (!sel) { setBox(null); return; }
    let frame;
    const tick = () => {
      const el = document.querySelector(`[data-el="${CSS.escape(sel)}"]`);
      const section = el?.closest('section');
      if (el && section) {
        const r = el.getBoundingClientRect();
        const s = section.getBoundingClientRect();
        setBox((b) => (b && b.el === el && b.rect.top === r.top && b.rect.left === r.left && b.rect.width === r.width && b.rect.height === r.height && b.section.top === s.top
          ? b : { el, rect: r, section: s }));
      } else setBox(null);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [sel]);

  const isPhone = () => window.matchMedia(PHONE_QUERY).matches;
  const keys = () => (isPhone() ? ['mx', 'my'] : ['x', 'y']);
  // Where the element actually sits right now (its applied translate), so a drag
  // always starts from what's on screen even if saved content is a moment behind.
  const currentOffset = (el) => {
    const [tx = '0', ty = '0'] = (getComputedStyle(el).translate || '').split(' ');
    const x = parseFloat(tx); const y = parseFloat(ty);
    return { x: Number.isFinite(x) ? Math.round(x) : 0, y: Number.isFinite(y) ? Math.round(y) : 0 };
  };

  // Snap + keep inside the section's margins. dx/dy: proposed offset change.
  const solve = (start, rect0, section, dxRaw, dyRaw) => {
    const margin = isPhone() ? MARGIN_PHONE : MARGIN_DESKTOP;
    // Centre guide wins over the grid: if the element's centre is close to the
    // section's centre line, put it exactly on it; otherwise snap to the grid.
    const centreX = section.left + section.width / 2;
    const rawX = start.x + dxRaw;
    const rawCentre = rect0.left + rect0.width / 2 + (rawX - start.x);
    let centred = false;
    let x;
    if (Math.abs(rawCentre - centreX) <= Math.max(CENTER_SNAP, step)) {
      x = rawX + (centreX - rawCentre);
      centred = true;
    } else {
      x = Math.round(rawX / step) * step;
    }
    let y = Math.round((start.y + dyRaw) / step) * step;
    // Clamp inside margins.
    const left = rect0.left + (x - start.x);
    const right = rect0.right + (x - start.x);
    const top = rect0.top + (y - start.y);
    const bottom = rect0.bottom + (y - start.y);
    if (rect0.width <= section.width - 2 * margin) {
      if (left < section.left + margin) x += section.left + margin - left;
      if (right > section.right - margin) x -= right - (section.right - margin);
    }
    if (rect0.height <= section.height - 2 * margin) {
      if (top < section.top + margin) y += section.top + margin - top;
      if (bottom > section.bottom - margin) y -= bottom - (section.bottom - margin);
    }
    return { x: Math.round(x), y: Math.round(y), centred };
  };

  const applyLive = (el, kx, ky, x, y) => {
    el.setAttribute('data-moved', '');
    el.style.setProperty(kx === 'x' ? '--dx' : '--mx', `${x}px`);
    el.style.setProperty(ky === 'y' ? '--dy' : '--my', `${y}px`);
  };

  const commit = (x, y) => {
    const [kx, ky] = keys();
    edit.onPatch(stylePath, { ...style, [kx]: x, [ky]: y });
  };

  const onPointerDown = (e) => {
    if (!box) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [kx, ky] = keys();
    dragRef.current = {
      px: e.clientX, py: e.clientY,
      start: currentOffset(box.el),
      rect0: box.el.getBoundingClientRect(), section: box.section, el: box.el, kx, ky, last: null,
    };
    setDrag({ centred: false });
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const r = solve(d.start, d.rect0, d.section, e.clientX - d.px, e.clientY - d.py);
    d.last = r;
    applyLive(d.el, d.kx, d.ky, r.x, r.y);
    setDrag({ centred: r.centred });
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (d?.last && (d.last.x !== d.start.x || d.last.y !== d.start.y)) commit(d.last.x, d.last.y);
  };

  // Arrow keys nudge a selected photo by one grid step (text keeps arrows for the caret).
  useEffect(() => {
    const onKey = (e) => {
      if (!box || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (document.activeElement?.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
      e.preventDefault();
      const start = currentOffset(box.el);
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      const r = solve(start, box.el.getBoundingClientRect(), box.section, dx, dy);
      commit(r.x, r.y);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!box) return null;
  const { rect, section } = box;
  const margin = isPhone() ? MARGIN_PHONE : MARGIN_DESKTOP;
  const showGrid = !!drag || edit.grid?.show;

  return (
    <>
      {showGrid && (
        <div aria-hidden="true" className="fixed z-[90] pointer-events-none" style={{
          left: section.left, top: section.top, width: section.width, height: section.height,
          backgroundImage: 'linear-gradient(to right, rgba(108,93,132,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(108,93,132,0.12) 1px, transparent 1px)',
          backgroundSize: `${step}px ${step}px`,
        }}>
          <div className="absolute border border-dashed border-[#6c5d84]/60" style={{ inset: margin }} />
          <div className="absolute top-0 bottom-0 w-px" style={{ left: '50%', background: drag?.centred ? '#d4583a' : 'rgba(108,93,132,0.35)' }} />
        </div>
      )}
      <button
        type="button"
        title="Drag to move (snaps to the grid). Arrow keys nudge photos."
        aria-label="Drag to move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="fixed z-[95] flex items-center justify-center w-7 h-7 rounded-full bg-[#6c5d84] text-white shadow-lg cursor-grab active:cursor-grabbing touch-none"
        style={{ left: Math.max(4, rect.left - 34), top: Math.max(4, rect.top - 2) }}
      >
        <GripVertical className="w-4 h-4" />
      </button>
    </>
  );
}
