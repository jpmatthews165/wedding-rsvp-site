import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { getAt } from '../content/paths.js';
import { cleanStyle, styleKey } from '../content/fieldStyle.js';
import { PHONE_QUERY } from './CoverImage.jsx';

// Editor-only overlay (inside the preview iframe) for the selected element(s):
// - a drag handle that moves the whole selection (Shift+click builds a group),
// - smart guides: the moving items' left/centre/right and top/middle/bottom snap to
//   the same lines of other items and to the section's centre and margins; only the
//   nearest guide per axis is drawn, and guides win over the grid,
// - a snapping grid inside the section's margins,
// - "align" commands from the editor's format bar,
// - resize handles for a single selected item (text: width; lines: length and
//   thickness; photos/buttons/boxes/map: all sides; photo corners keep proportions
//   unless Shift is held). The opposite edge stays put while resizing.
// Moving only changes each item's offset (CSS translate), never the layout around
// it. Desktop and phone offsets are stored separately (x/y vs mx/my).

const MARGIN_DESKTOP = 24;
const MARGIN_PHONE = 16;
const GUIDE_SNAP = 10; // px: how close an edge must be before it snaps to a guide

const splitPath = (sel) => {
  const m = /^(sections\.\d+)\.(.+)$/.exec(sel || '');
  return m ? { base: m[1], f: m[2] } : null;
};
const stylePathOf = (path) => {
  const p = splitPath(path);
  return p ? `${p.base}.styles.${styleKey(p.f)}` : null;
};
const findEl = (path) => document.querySelector(`[data-el="${CSS.escape(path)}"]`);
const isPhone = () => window.matchMedia(PHONE_QUERY).matches;
const deviceKeys = () => (isPhone() ? ['mx', 'my'] : ['x', 'y']);

// Where the element actually sits right now (its applied translate).
const currentOffset = (el) => {
  const [tx = '0', ty = '0'] = (getComputedStyle(el).translate || '').split(' ');
  const x = parseFloat(tx); const y = parseFloat(ty);
  return { x: Number.isFinite(x) ? Math.round(x) : 0, y: Number.isFinite(y) ? Math.round(y) : 0 };
};

const union = (rects) => {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};
const lines = (r) => ({
  x: [r.left, r.left + r.width / 2, r.right],
  y: [r.top, r.top + r.height / 2, r.bottom],
});

// The selected items that are on the page, with their paths, in selection order.
const liveItems = (selection) => selection
  .map((s) => ({ path: s.path, el: findEl(s.path) }))
  .filter((x) => x.el);

export default function DragLayer({ content, edit }) {
  const selection = edit.selection || [];
  const step = edit.grid?.step || 16;
  const [box, setBox] = useState(null);       // { items, union, section }
  const [guides, setGuides] = useState(null); // { dragging, x?: target, y?: target }
  const dragRef = useRef(null);
  const key = selection.map((s) => s.path).join('|');

  // Track the selected elements every frame while something is selected.
  useEffect(() => {
    if (!selection.length) { setBox(null); return; }
    let frame;
    const tick = () => {
      const items = liveItems(selection);
      const primary = items[items.length - 1]?.el;
      const section = primary?.closest('section');
      if (items.length && section) {
        const u = union(items.map((it) => it.el.getBoundingClientRect()));
        const s = section.getBoundingClientRect();
        setBox((b) => (b && b.items.length === items.length && b.union.left === u.left && b.union.top === u.top && b.union.width === u.width && b.union.height === u.height && b.section.top === s.top
          ? b : { items, union: u, section: s }));
      } else setBox(null);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Lines that other items (and the section) offer to snap to.
  const targets = (els, section) => {
    const margin = isPhone() ? MARGIN_PHONE : MARGIN_DESKTOP;
    const sectionEl = els[els.length - 1].closest('section');
    const out = {
      x: [
        { at: section.left + section.width / 2, from: section.top, to: section.bottom },
        { at: section.left + margin, from: section.top, to: section.bottom },
        { at: section.right - margin, from: section.top, to: section.bottom },
      ],
      y: [{ at: section.top + section.height / 2, from: section.left, to: section.right }],
    };
    for (const other of sectionEl.querySelectorAll('[data-el]')) {
      if (els.some((e) => e === other || e.contains(other) || other.contains(e))) continue;
      const r = other.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const l = lines(r);
      l.x.forEach((at) => out.x.push({ at, from: r.top, to: r.bottom }));
      l.y.forEach((at) => out.y.push({ at, from: r.left, to: r.right }));
    }
    return out;
  };

  // Snap a proposed move (dx, dy) of the group: nearest guide first, else the grid;
  // then keep every item inside its own section's margins.
  const solve = (d, dxRaw, dyRaw) => {
    const u0 = d.union0;
    const moved = { left: u0.left + dxRaw, top: u0.top + dyRaw, width: u0.width, height: u0.height };
    moved.right = moved.left + moved.width; moved.bottom = moved.top + moved.height;
    const ml = lines(moved);
    const best = (axis, mine) => {
      let hit = null;
      for (const t of d.targets[axis]) {
        for (const m of mine) {
          const diff = t.at - m;
          if (Math.abs(diff) <= GUIDE_SNAP && (!hit || Math.abs(diff) < Math.abs(hit.diff))) hit = { diff, t };
        }
      }
      return hit;
    };
    const gx = best('x', ml.x);
    const gy = best('y', ml.y);
    const dx = gx ? dxRaw + gx.diff : Math.round(dxRaw / step) * step;
    const dy = gy ? dyRaw + gy.diff : Math.round(dyRaw / step) * step;

    const margin = isPhone() ? MARGIN_PHONE : MARGIN_DESKTOP;
    let minDx = -Infinity, maxDx = Infinity, minDy = -Infinity, maxDy = Infinity;
    d.items.forEach(({ rect0, section }) => {
      if (rect0.width <= section.width - 2 * margin) {
        minDx = Math.max(minDx, section.left + margin - rect0.left);
        maxDx = Math.min(maxDx, section.right - margin - rect0.right);
      }
      if (rect0.height <= section.height - 2 * margin) {
        minDy = Math.max(minDy, section.top + margin - rect0.top);
        maxDy = Math.min(maxDy, section.bottom - margin - rect0.bottom);
      }
    });
    const cx = Math.min(maxDx, Math.max(minDx, dx));
    const cy = Math.min(maxDy, Math.max(minDy, dy));
    return { dx: Math.round(cx), dy: Math.round(cy), gx: gx && cx === dx ? gx.t : null, gy: gy && cy === dy ? gy.t : null };
  };

  const applyLive = (el, kx, ky, x, y) => {
    el.setAttribute('data-moved', '');
    el.style.setProperty(kx === 'x' ? '--dx' : '--mx', `${x}px`);
    el.style.setProperty(ky === 'y' ? '--dy' : '--my', `${y}px`);
  };

  // Save new offsets for one or more items as a single change (one Undo step).
  const commitOffsets = (entries) => {
    const [kx, ky] = deviceKeys();
    const changes = entries.map(({ path, x, y }) => {
      const sp = stylePathOf(path);
      return { path: sp, value: { ...cleanStyle(getAt(content, sp)), [kx]: x, [ky]: y } };
    }).filter((c) => c.path);
    if (changes.length) edit.onPatchMany(changes);
  };

  const snapshot = () => {
    const items = liveItems(selection).map(({ path, el }) => ({
      path, el, start: currentOffset(el), rect0: el.getBoundingClientRect(),
      section: el.closest('section').getBoundingClientRect(),
    }));
    return { items, union0: union(items.map((it) => it.rect0)) };
  };

  const onPointerDown = (e) => {
    if (!box) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [kx, ky] = deviceKeys();
    const snap = snapshot();
    dragRef.current = {
      ...snap, px: e.clientX, py: e.clientY, kx, ky, last: null,
      targets: targets(snap.items.map((it) => it.el), box.section),
    };
    setGuides({ dragging: true });
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const r = solve(d, e.clientX - d.px, e.clientY - d.py);
    d.last = r;
    d.items.forEach((it) => applyLive(it.el, d.kx, d.ky, it.start.x + r.dx, it.start.y + r.dy));
    setGuides({ dragging: true, x: r.gx, y: r.gy });
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setGuides(null);
    if (d?.last && (d.last.dx || d.last.dy)) {
      commitOffsets(d.items.map((it) => ({ path: it.path, x: it.start.x + d.last.dx, y: it.start.y + d.last.dy })));
    }
  };

  // Arrow keys nudge the selection by one grid step (text keeps arrows for the caret).
  useEffect(() => {
    const onKey = (e) => {
      if (!box || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (document.activeElement?.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
      e.preventDefault();
      const d = { ...snapshot(), targets: { x: [], y: [] } };
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      const r = solve(d, dx, dy);
      if (r.dx || r.dy) commitOffsets(d.items.map((it) => ({ path: it.path, x: it.start.x + r.dx, y: it.start.y + r.dy })));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Align command from the format bar: line the selected items up with each other.
  const lastAlign = useRef(null);
  useEffect(() => {
    const req = edit.alignRequest;
    if (!req || req.nonce === lastAlign.current) return;
    lastAlign.current = req.nonce;
    const { items } = snapshot();
    if (items.length < 2) return;
    const u = union(items.map((it) => it.rect0));
    commitOffsets(items.map(({ path, start, rect0: r }) => {
      let dx = 0, dy = 0;
      if (req.mode === 'left') dx = u.left - r.left;
      if (req.mode === 'right') dx = u.right - r.right;
      if (req.mode === 'center') dx = (u.left + u.width / 2) - (r.left + r.width / 2);
      if (req.mode === 'top') dy = u.top - r.top;
      if (req.mode === 'bottom') dy = u.bottom - r.bottom;
      if (req.mode === 'middle') dy = (u.top + u.height / 2) - (r.top + r.height / 2);
      return { path, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
    }));
  });

  // ---------------------------------------------------------------- resizing
  const kind = selection.length === 1 ? selection[0].kind : null;
  const HANDLES = {
    text: ['w', 'e'],
    line: ['w', 'e', 'n', 's'],
  };
  const handleDirs = kind ? (HANDLES[kind] || ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) : [];
  const resizeRef = useRef(null);
  const MIN = { text: [48, 0], line: [8, 1], button: [48, 24], box: [80, 60], map: [120, 80], image: [40, 40] };

  const onResizeDown = (dir) => (e) => {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { el } = box.items[0];
    const r0 = el.getBoundingClientRect();
    const phone = isPhone();
    resizeRef.current = {
      dir, el, path: box.items[0].path, px: e.clientX, py: e.clientY,
      start: currentOffset(el), r0, w0: r0.width, h0: r0.height,
      section: el.closest('section').getBoundingClientRect(),
      kw: phone ? 'mw' : 'w', kh: phone ? 'mh' : 'h', kx: phone ? 'mx' : 'x', ky: phone ? 'my' : 'y',
      last: null,
    };
    setGuides({ dragging: true });
  };
  const onResizeMove = (e) => {
    const d = resizeRef.current;
    if (!d) return;
    const margin = isPhone() ? MARGIN_PHONE : MARGIN_DESKTOP;
    const sx = d.dir.includes('e') ? 1 : d.dir.includes('w') ? -1 : 0;
    const sy = d.dir.includes('s') ? 1 : d.dir.includes('n') ? -1 : 0;
    const fine = kind === 'line' ? 1 : step; // line thickness moves in 1px steps
    let w = d.w0 + sx * Math.round((e.clientX - d.px) / step) * step;
    let h = d.h0 + sy * Math.round((e.clientY - d.py) / (sy && kind === 'line' ? fine : step)) * (sy && kind === 'line' ? fine : step);
    // Photo corners keep proportions unless Shift is held.
    if (kind === 'image' && sx && sy && !e.shiftKey) {
      const ratio = d.w0 / d.h0;
      if (Math.abs(w - d.w0) / d.w0 > Math.abs(h - d.h0) / d.h0) h = w / ratio; else w = h * ratio;
    }
    const [minW, minH] = MIN[kind] || [32, 32];
    w = Math.max(minW, Math.min(w, d.section.width - 2 * margin));
    h = Math.max(minH || 1, h);
    const setW = sx !== 0;
    const setH = sy !== 0 && kind !== 'text';
    const el = d.el;
    if (setW) { el.setAttribute(`data-${d.kw}`, ''); el.style.setProperty(`--${d.kw}`, `${Math.round(w)}px`); }
    if (setH) { el.setAttribute(`data-${d.kh}`, ''); el.style.setProperty(`--${d.kh}`, `${Math.round(h)}px`); }
    // Pin the opposite edge: measure with the starting offset, then correct it.
    applyLive(el, d.kx, d.ky, d.start.x, d.start.y);
    const r = el.getBoundingClientRect();
    let x = d.start.x, y = d.start.y;
    if (sx === 1) x += d.r0.left - r.left;
    else if (sx === -1) x += d.r0.right - r.right;
    else x += (d.r0.left + d.r0.width / 2) - (r.left + r.width / 2);
    if (sy === 1 || sy === 0) y += d.r0.top - r.top;
    else y += d.r0.bottom - r.bottom;
    x = Math.round(x); y = Math.round(y);
    applyLive(el, d.kx, d.ky, x, y);
    d.last = { w: setW ? Math.round(w) : undefined, h: setH ? Math.round(h) : undefined, x, y };
  };
  const onResizeUp = () => {
    const d = resizeRef.current;
    resizeRef.current = null;
    setGuides(null);
    if (!d?.last) return;
    const sp = stylePathOf(d.path);
    const cur = cleanStyle(getAt(content, sp));
    const next = { ...cur, [d.kx]: d.last.x, [d.ky]: d.last.y };
    if (d.last.w !== undefined) next[d.kw] = d.last.w;
    if (d.last.h !== undefined) next[d.kh] = d.last.h;
    edit.onPatchMany([{ path: sp, value: next }]);
  };

  // Safety net: finish a drag/resize even if the release happens off the handle.
  useEffect(() => {
    const up = () => { if (resizeRef.current) onResizeUp(); else if (dragRef.current) onPointerUp(); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });

  if (!box) return null;
  const { union: u, section } = box;
  const margin = isPhone() ? MARGIN_PHONE : MARGIN_DESKTOP;
  const showGrid = !!guides?.dragging || edit.grid?.show;
  const count = box.items.length;
  const lineColor = '#d4583a';

  return (
    <>
      {showGrid && (
        <div aria-hidden="true" data-grid="" className="fixed z-[90] pointer-events-none" style={{
          left: section.left, top: section.top, width: section.width, height: section.height,
          backgroundImage: 'linear-gradient(to right, rgba(108,93,132,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(108,93,132,0.10) 1px, transparent 1px)',
          backgroundSize: `${step}px ${step}px`,
        }}>
          <div className="absolute border border-dashed border-[#6c5d84]/55" style={{ inset: margin }} />
        </div>
      )}
      {guides?.x && (
        <div aria-hidden="true" data-guide="x" className="fixed z-[96] pointer-events-none" style={{
          left: guides.x.at - 0.5, width: 1, background: lineColor,
          top: Math.min(guides.x.from, u.top) - 8, height: Math.max(guides.x.to, u.bottom) - Math.min(guides.x.from, u.top) + 16,
        }} />
      )}
      {guides?.y && (
        <div aria-hidden="true" data-guide="y" className="fixed z-[96] pointer-events-none" style={{
          top: guides.y.at - 0.5, height: 1, background: lineColor,
          left: Math.min(guides.y.from, u.left) - 8, width: Math.max(guides.y.to, u.right) - Math.min(guides.y.from, u.left) + 16,
        }} />
      )}
      {count > 1 && (
        <div aria-hidden="true" className="fixed z-[94] pointer-events-none border border-dashed border-[#6c5d84] rounded-sm"
          style={{ left: u.left - 10, top: u.top - 10, width: u.width + 20, height: u.height + 20 }} />
      )}
      <button
        type="button"
        title={count > 1 ? `Drag to move all ${count} (Shift+click to add or remove)` : 'Drag to move (Shift+click another item to group)'}
        aria-label="Drag to move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="fixed z-[97] flex items-center gap-0.5 h-7 px-1.5 rounded-full bg-[#6c5d84] text-white shadow-lg cursor-grab active:cursor-grabbing touch-none text-[11px] font-semibold font-sans"
        style={{ left: Math.max(4, u.left - (count > 1 ? 52 : 34)), top: Math.max(4, u.top - 2) }}
      >
        <GripVertical className="w-4 h-4" />{count > 1 && count}
      </button>
      {count === 1 && handleDirs.map((dir) => {
        const hx = dir.includes('w') ? u.left : dir.includes('e') ? u.right : u.left + u.width / 2;
        const hy = dir.includes('n') ? u.top : dir.includes('s') ? u.bottom : u.top + u.height / 2;
        const cursor = { n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' }[dir];
        return (
          <span
            key={dir}
            role="button"
            aria-label={`Resize ${dir}`}
            data-resize={dir}
            onPointerDown={onResizeDown(dir)}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
            className="fixed z-[98] w-3 h-3 -ml-1.5 -mt-1.5 rounded-sm bg-white border-2 border-[#6c5d84] shadow touch-none"
            // Stay mounted while dragging (removing the grabbed handle would lose the
            // pointer); just hide them during a move.
            style={{ left: hx, top: hy, cursor: `${cursor}-resize`, opacity: guides?.dragging && !resizeRef.current ? 0 : 1 }}
          />
        );
      })}
    </>
  );
}
