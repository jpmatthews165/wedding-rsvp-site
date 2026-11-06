import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ImagePlus, Move } from 'lucide-react';
import { getAt } from '../content/paths.js';
import { boxAttrs, boxCss, cleanSectionLayout, isTextBox, layoutGrid, styleKey, textCss } from '../content/fieldStyle.js';
import { PHONE_QUERY } from './CoverImage.jsx';
import { safeUrl } from '../lib/safeUrl.js';

// When the site renders inside the editor, EditContext carries callbacks back to it.
// On the public site it's null and everything renders as plain text.
export const EditContext = createContext(null);
export const SectionContext = createContext({ section: {}, base: '' });
// The selectable box (Movable) an element sits in: { path, kind }.
const BoxContext = createContext(null);

export const useEdit = () => useContext(EditContext);
export const useSection = () => useContext(SectionContext);

const hasText = (v) => typeof v === 'string' && v.trim() !== '';

// innerText applies CSS like `uppercase`, so a label styled in capitals would be saved
// in capitals. Read it with text-transform switched off to get what was actually typed.
const readText = (el) => {
  const prev = el.style.textTransform;
  el.style.textTransform = 'none';
  const text = el.innerText;
  el.style.textTransform = prev;
  return text;
};

// ---- Picking what a click selects (Figma/Canva style)
// Selectable items can sit inside each other: a heading block (group) holds a title,
// subtitle and line; a card holds a photo, text and a button. The first click picks
// the outermost item, so the whole block moves together; clicking again inside the
// selected item goes one level deeper (down to the text itself, which then edits).
// Clicking next to a selected item inside the same block stays at that depth.

// Selectable items from the section down to `el` (outermost first).
const chainAt = (el) => {
  const sec = el?.closest('section');
  const chain = [];
  let n = el?.closest('[data-el]');
  while (n && sec?.contains(n)) { chain.unshift(n); n = n.parentElement?.closest('[data-el]'); }
  return chain;
};

const pickInChain = (chain, selection) => {
  if (!chain.length) return null;
  const selected = (selection || []).map((s) => document.querySelector(`[data-el="${CSS.escape(s.path)}"]`)).filter(Boolean);
  let k = -1;
  chain.forEach((el, i) => { if (selected.some((s) => el.contains(s))) k = i; });
  return chain[Math.min(k + 1, chain.length - 1)];
};

const isSelected = (el, selection) => !!el && (selection || []).some((s) => s.path === el.getAttribute('data-el'));

// Select a picked element (Shift: add to / remove from the selection).
const selectEl = (edit, el, additive) => {
  const path = el.getAttribute('data-el');
  const base = /^(sections\.\d+)\./.exec(path)?.[1];
  if (base) edit.onSelect(base);
  edit.onSelectEl(path, el.getAttribute('data-el-kind'), additive);
};

// Formatting + position saved for one element (see content/fieldStyle.js).
export const useFieldStyle = (f) => {
  const { section } = useSection();
  return section.styles?.[styleKey(f)];
};

// Props for an element's outer box: position offset, alignment, and (in the editor)
// the hooks the selection/drag layer uses to find it.
const useBoxProps = (f, kind, style) => {
  const edit = useEdit();
  const { base } = useSection();
  const st = useFieldStyle(f);
  const path = `${base}.${f}`;
  return {
    style: { ...style, ...boxCss(st) },
    ...boxAttrs(st),
    'data-el': edit ? path : undefined,
    'data-el-kind': edit ? kind : undefined,
    'data-el-selected': edit && edit.selection?.some((x) => x.path === path) ? '' : undefined,
  };
};

// <T f="title" as="h2" className="..." />  — renders section[f] with its saved
// formatting and position, and makes it click-to-edit in the editor.
// Use `multiline` to allow line breaks. The outer tag keeps the design's classes
// (so sizes stay responsive); an inner span carries the element's own formatting.
//
// Inside a button the text is locked to the button: it isn't moved or sized on its
// own, the button is selected first, and a second click edits the words.
export function T({ f, as: Tag = 'span', className = '', multiline = false, placeholder, style }) {
  const edit = useEdit();
  const { section, base } = useSection();
  const value = getAt(section, f) ?? '';
  const st = useFieldStyle(f);
  const around = useContext(BoxContext);
  const locked = around?.kind === 'button';
  const boxProps = useBoxProps(f, 'text', style);
  const box = locked
    ? { style, 'data-label': edit ? `${base}.${f}` : undefined }
    : { ...boxProps, 'data-tbox': isTextBox(st) ? '' : undefined };
  const ref = useRef(null);
  const blockFocus = useRef(false);

  // Keep the editable DOM in sync with outside changes (undo, AI edits, side panel)
  // without fighting the cursor while the person is typing.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && readText(el) !== value) el.innerText = value;
  }, [value, edit]);

  if (!edit) {
    if (!hasText(value)) return null;
    return (
      <Tag className={`${className} whitespace-pre-line`} {...box}>
        <span style={textCss(st)}>{value}</span>
      </Tag>
    );
  }

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    let next = readText(el).replace(/\u00a0/g, ' ');
    if (!multiline) next = next.replace(/\n+/g, ' ');
    next = next.replace(/\n$/, '');
    if (next !== value) edit.onEdit(`${base}.${f}`, next);
  };

  return (
    <Tag
      className={`${className} whitespace-pre-line`}
      {...box}
      // First click selects the block it's in (see pickInChain); Shift+click adds to
      // the selection; otherwise the click edits the text.
      onPointerDown={(e) => {
        e.stopPropagation();
        blockFocus.current = false; // (a blocked click's mousedown may never arrive to reset it)
        if (e.button !== 0) return;
        const chain = chainAt(e.currentTarget);
        const pick = pickInChain(chain, edit.selection);
        const self = locked ? chain[chain.length - 1] : e.currentTarget;
        const editHere = pick === self && !e.shiftKey && (!locked || isSelected(self, edit.selection));
        if (editHere || !pick) return;
        blockFocus.current = true;
        e.preventDefault();
        selectEl(edit, pick, e.shiftKey);
      }}
      onMouseDown={(e) => { if (blockFocus.current) { e.preventDefault(); blockFocus.current = false; } }}
    >
      <span
        ref={ref}
        style={textCss(st)}
        data-editable=""
        data-placeholder={placeholder || 'Click to add text'}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck
        onFocus={() => { if (locked) return; edit.onSelect(base); edit.onSelectEl(`${base}.${f}`, 'text', false); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.currentTarget.innerText = value; e.currentTarget.blur(); }
          if (e.key === 'Enter' && !multiline) { e.preventDefault(); e.currentTarget.blur(); }
        }}
        onPaste={(e) => {
          // Fallback for browsers without plaintext-only: strip formatting.
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
      />
    </Tag>
  );
}

// Any block that can be selected, moved and resized in the editor: photos, buttons,
// divider lines, boxes (cards), the map.  `kind` decides which handles it gets.
// <Movable f="image" className="relative h-[80vh] …">…</Movable>
// <Movable as="button" kind="button" f="_btn" onClick={…} className="…">…</Movable>
// Fields starting with "_" (e.g. "_btn", "_divider", "_map") are layout-only keys:
// they hold formatting/position in `styles` but no content.
// kind "group" is a block that only holds other items (e.g. a heading with its
// line) so they move together; see <Group>.
export function Movable({ f, kind = 'image', as: Tag = 'div', className = '', style, children, ...rest }) {
  const edit = useEdit();
  const { base } = useSection();
  const st = useFieldStyle(f);
  const box = useBoxProps(f, kind, style);
  return (
    <Tag
      className={className}
      {...rest}
      {...box}
      data-tbox={kind === 'group' && isTextBox(st) ? '' : undefined}
      onPointerDown={edit ? (e) => {
        // The editor's own photo buttons aren't for this box.
        const btn = e.target.closest('button');
        if (btn && btn !== e.currentTarget && !btn.hasAttribute('data-el')) return;
        if (e.button !== 0) return;
        e.stopPropagation(); // the innermost handler decides for the whole stack
        const pick = pickInChain(chainAt(e.currentTarget), edit.selection);
        if (pick) selectEl(edit, pick, e.shiftKey);
      } : rest.onPointerDown}
    >
      <BoxContext.Provider value={{ kind, path: `${base}.${f}` }}>{children}</BoxContext.Provider>
      {/* The map is an embedded page that swallows clicks; cover it while editing. */}
      {edit && kind === 'map' && <span aria-hidden="true" className="absolute inset-0 z-[5]" />}
    </Tag>
  );
}

// Items that belong together (a heading, its subtitle and line; a label with its
// text) so they're selected and moved as one block. Click again to pick one inside.
// Layout-only key, e.g. <Group f="_head">…</Group> or f="items.2._item".
export function Group({ f, className = '', as = 'div', children }) {
  return <Movable f={f} kind="group" as={as} className={className}>{children}</Movable>;
}

// Where a button goes: a section on this page ("#rsvp") or a web address.
// `field` is the button's own link field if the type has one (e.g. "hotels.0.url",
// "buttonUrl"); otherwise it's stored as section.linkTo.<style key>, falling back to
// `fallback` (the design's default, e.g. "#rsvp"). In the editor the element gets
// data-link (the content path) so the format bar can offer "Link to…".
export const useLink = (f, field, fallback = '') => {
  const edit = useEdit();
  const { section, base } = useSection();
  const path = field || `linkTo.${styleKey(f)}`;
  const href = safeUrl(getAt(section, path) || fallback);
  return {
    href,
    internal: href.startsWith('#'),
    linkProps: edit ? { 'data-link': `${base}.${path}`, 'data-link-default': fallback || undefined } : {},
  };
};

// True if the field has text, or we're in the editor (so empty fields can still be filled in).
export const useShow = (f) => {
  const edit = useEdit();
  const { section } = useSection();
  return !!edit || hasText(getAt(section, f));
};

// Overlay button on photos in the editor.
export function ImageButton({ f, className = '' }) {
  const edit = useEdit();
  const { section, base } = useSection();
  if (!edit) return null;
  const hasImage = !!getAt(section, f);
  const pill = 'flex items-center gap-1.5 bg-white/90 text-ink text-xs font-sans font-semibold px-3 py-2 rounded-full shadow-lg hover:bg-white';
  return (
    <div className={`absolute z-40 flex gap-2 ${className}`}>
      <button type="button" className={pill} onClick={(e) => { e.stopPropagation(); edit.onPickImage(`${base}.${f}`); }}>
        <ImagePlus className="w-4 h-4" /> {hasImage ? 'Change photo' : 'Add photo'}
      </button>
      {hasImage && (
        <button type="button" className={pill} onClick={(e) => { e.stopPropagation(); edit.onAdjustImage(`${base}.${f}`); }}>
          <Move className="w-4 h-4" /> Reposition
        </button>
      )}
    </div>
  );
}

// What a marquee (drag over empty space) selects: the items fully inside the box,
// as whole blocks where a whole block fits (a title inside a heading block that's
// only partly covered is picked on its own). If nothing fits completely, the
// outermost items it touches.
const marqueeHits = (frame, r) => {
  const all = [...frame.querySelectorAll('[data-el]')].filter((el) => el.offsetWidth || el.offsetHeight);
  const box = (el) => el.getBoundingClientRect();
  const inside = all.filter((el) => { const b = box(el); return b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom; });
  let hits = inside.filter((el) => !inside.some((o) => o !== el && o.contains(el)));
  if (!hits.length) {
    const touched = all.filter((el) => { const b = box(el); return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top; });
    hits = touched.filter((el) => !touched.some((o) => o !== el && o.contains(el)));
  }
  return hits.map((el) => ({ path: el.getAttribute('data-el'), kind: el.getAttribute('data-el-kind') }));
};

// Section wrapper: highlights the selected section in the editor and selects on click.
// On empty space: a click selects the section's background; dragging draws a box and
// selects everything inside it as a temporary group (Shift adds to the selection).
export function SectionFrame({ children, label }) {
  const edit = useEdit();
  const { base } = useSection();
  const frameRef = useRef(null);
  const [marquee, setMarquee] = useState(null); // { left, top, width, height } (viewport px)
  if (!edit) return children;
  const selected = edit.selected === base;

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest('button, a, input, textarea, select, label, form, [data-editable], [data-el], .section-resize, .edit-section-badge')) return;
    e.preventDefault(); // no text selection while drawing the box
    const x0 = e.clientX, y0 = e.clientY;
    const additive = e.shiftKey;
    let rect = null;
    const move = (ev) => {
      const w = Math.abs(ev.clientX - x0), h = Math.abs(ev.clientY - y0);
      if (!rect && w < 5 && h < 5) return;
      rect = { left: Math.min(x0, ev.clientX), top: Math.min(y0, ev.clientY), width: w, height: h };
      rect.right = rect.left + w; rect.bottom = rect.top + h;
      setMarquee(rect);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setMarquee(null);
      edit.onSelect(base);
      if (!rect) { edit.onSelectEl(`${base}._bg`, 'section', false); return; }
      const hits = frameRef.current ? marqueeHits(frameRef.current, rect) : [];
      if (!hits.length) return;
      const keep = additive ? (edit.selection || []).filter((s) => s.kind !== 'section' && !hits.some((h) => h.path === s.path)) : [];
      edit.onSelectEls([...keep, ...hits]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div
      ref={frameRef}
      data-base={base}
      className={`relative edit-section ${selected ? 'edit-section-selected' : ''}`}
      onClickCapture={() => { if (!selected) edit.onSelect(base); }}
      onPointerDown={onPointerDown}
    >
      <div className="edit-section-badge">{label}</div>
      {children}
      <SectionResizeHandle />
      {marquee && (
        <div aria-hidden="true" className="fixed z-[99] pointer-events-none border border-[#6c5d84] bg-[#6c5d84]/10 rounded-sm"
          style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }} />
      )}
    </div>
  );
}

// Editor: drag a section's bottom edge to make the section taller or shorter.
// Desktop and phone heights are separate (the preview width decides which).
// Shortening only removes the section's bottom padding, so content never clips.
// Double-click the bar to go back to the design's own height.
function SectionResizeHandle() {
  const edit = useEdit();
  const { section, base } = useSection();
  const ref = useRef(null);
  const drag = useRef(null);
  const [readout, setReadout] = useState(null);
  if (!edit) return null;
  const step = layoutGrid(edit.site);

  const elements = () => {
    const wrapper = ref.current?.parentElement?.querySelector(':scope > [data-section-base]');
    return { wrapper, sec: wrapper?.querySelector(':scope > section') };
  };

  const onDown = (e) => {
    const { wrapper, sec } = elements();
    if (!sec) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const phone = window.matchMedia(PHONE_QUERY).matches;
    // The design's own height and bottom padding (without any saved override).
    const attrs = ['data-sh', 'data-msh', 'data-msh-auto'];
    const saved = attrs.map((a) => [a, wrapper.getAttribute(a)]);
    attrs.forEach((a) => wrapper.removeAttribute(a));
    const H0 = sec.offsetHeight;
    const pb0 = parseFloat(getComputedStyle(sec).paddingBottom) || 0;
    saved.forEach(([a, v]) => { if (v !== null) wrapper.setAttribute(a, v); });
    drag.current = { y: e.clientY, H0, pb0, Hcur: sec.offsetHeight, wrapper, phone, target: sec.offsetHeight };
    setReadout(sec.offsetHeight);
  };

  const apply = (d, target) => {
    const pb = target < d.H0 ? Math.max(0, d.pb0 - (d.H0 - target)) : d.pb0;
    const [attr, vh, vpb] = d.phone ? ['data-msh', '--msh', '--mspb'] : ['data-sh', '--sh', '--spb'];
    if (d.phone) d.wrapper.removeAttribute('data-msh-auto');
    d.wrapper.setAttribute(attr, '');
    d.wrapper.style.setProperty(vh, `${target}px`);
    d.wrapper.style.setProperty(vpb, `${pb}px`);
    return pb;
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    let target = Math.round((d.Hcur + (e.clientY - d.y)) / step) * step;
    target = Math.max(Math.ceil(d.H0 - d.pb0), Math.min(8000, target)); // never smaller than the content
    d.target = target;
    apply(d, target);
    setReadout(target);
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setReadout(null);
    if (!d || d.target === d.Hcur) return;
    const pb = apply(d, d.target);
    const cur = cleanSectionLayout(section.layout);
    const same = Math.abs(d.target - d.H0) < 1;
    const next = d.phone
      ? { ...cur, mh: same ? undefined : d.target, mpb: same ? undefined : Math.round(pb) }
      : { ...cur, h: same ? undefined : d.target, pb: same ? undefined : Math.round(pb), d: same ? undefined : Math.round(d.target - d.H0) };
    edit.onPatch(`${base}.layout`, next);
  };

  const reset = () => {
    const phone = window.matchMedia(PHONE_QUERY).matches;
    const cur = cleanSectionLayout(section.layout);
    edit.onPatch(`${base}.layout`, phone ? { ...cur, mh: undefined, mpb: undefined } : { ...cur, h: undefined, pb: undefined, d: undefined });
  };

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Drag to resize section"
      title="Drag to make this section taller or shorter · double-click to reset"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={reset}
      className="section-resize absolute left-0 right-0 -bottom-2 h-4 z-[60] cursor-ns-resize touch-none group"
    >
      <div className={`absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-[#6c5d84] transition-opacity ${readout !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
      <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6c5d84] text-white text-[11px] font-sans font-semibold px-2.5 py-1 shadow whitespace-nowrap transition-opacity ${readout !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {readout !== null ? `${readout} px` : 'Drag to resize section'}
      </span>
    </div>
  );
}
