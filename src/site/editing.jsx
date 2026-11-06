import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ImagePlus, Move } from 'lucide-react';
import { getAt } from '../content/paths.js';
import { boxAttrs, boxCss, cleanSectionLayout, layoutGrid, styleKey, textCss } from '../content/fieldStyle.js';
import { PHONE_QUERY } from './CoverImage.jsx';

// When the site renders inside the editor, EditContext carries callbacks back to it.
// On the public site it's null and everything renders as plain text.
export const EditContext = createContext(null);
export const SectionContext = createContext({ section: {}, base: '' });

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
export function T({ f, as: Tag = 'span', className = '', multiline = false, placeholder, style }) {
  const edit = useEdit();
  const { section, base } = useSection();
  const value = getAt(section, f) ?? '';
  const st = useFieldStyle(f);
  const box = useBoxProps(f, 'text', style);
  const ref = useRef(null);

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
      // Shift+click adds/removes this text from the selection instead of editing it.
      onPointerDown={(e) => { e.stopPropagation(); if (e.shiftKey) { e.preventDefault(); edit.onSelectEl(`${base}.${f}`, 'text', true); } }}
    >
      <span
        ref={ref}
        style={textCss(st)}
        data-editable=""
        data-placeholder={placeholder || 'Click to add text'}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck
        onFocus={() => { edit.onSelect(base); edit.onSelectEl(`${base}.${f}`, 'text', false); }}
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
export function Movable({ f, kind = 'image', as: Tag = 'div', className = '', style, children, ...rest }) {
  const edit = useEdit();
  const { base } = useSection();
  const box = useBoxProps(f, kind, style);
  return (
    <Tag
      className={className}
      {...rest}
      {...box}
      onPointerDown={edit ? (e) => {
        // Clicks on editable text or on the editor's own photo buttons aren't for this box.
        const btn = e.target.closest('button');
        if ((btn && btn !== e.currentTarget) || e.target.closest('[data-editable]')) return;
        e.stopPropagation(); // innermost box wins (e.g. a photo inside a card)
        edit.onSelect(base);
        edit.onSelectEl(`${base}.${f}`, kind, e.shiftKey);
      } : rest.onPointerDown}
    >
      {children}
      {/* The map is an embedded page that swallows clicks; cover it while editing. */}
      {edit && kind === 'map' && <span aria-hidden="true" className="absolute inset-0 z-[5]" />}
    </Tag>
  );
}

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

// Section wrapper: highlights the selected section in the editor and selects on click.
export function SectionFrame({ children, label }) {
  const edit = useEdit();
  const { base } = useSection();
  if (!edit) return children;
  const selected = edit.selected === base;
  return (
    <div
      data-base={base}
      className={`relative edit-section ${selected ? 'edit-section-selected' : ''}`}
      onClickCapture={() => { if (!selected) edit.onSelect(base); }}
    >
      <div className="edit-section-badge">{label}</div>
      {children}
      <SectionResizeHandle />
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
