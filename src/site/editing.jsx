import { createContext, useContext, useEffect, useRef } from 'react';
import { ImagePlus, Move } from 'lucide-react';
import { getAt } from '../content/paths.js';

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

// <T f="title" as="h2" className="..." />  — renders section[f] and makes it
// click-to-edit in the editor. Use `multiline` to allow line breaks.
export function T({ f, as: Tag = 'span', className = '', multiline = false, placeholder, style }) {
  const edit = useEdit();
  const { section, base } = useSection();
  const value = getAt(section, f) ?? '';
  const ref = useRef(null);

  // Keep the editable DOM in sync with outside changes (undo, AI edits, side panel)
  // without fighting the cursor while the person is typing.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && readText(el) !== value) el.innerText = value;
  }, [value, edit]);

  if (!edit) {
    if (!hasText(value)) return null;
    return <Tag className={`${className} whitespace-pre-line`} style={style}>{value}</Tag>;
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
      ref={ref}
      className={`${className} whitespace-pre-line`}
      style={style}
      data-editable=""
      data-placeholder={placeholder || 'Click to add text'}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      onFocus={() => edit.onSelect(base)}
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
    </div>
  );
}
