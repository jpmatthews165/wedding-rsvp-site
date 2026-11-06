import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignJustify, AlignLeft,
  AlignRight, AlignStartHorizontal, AlignStartVertical, Bold, Grid3x3, ImagePlus, Italic, Link2, Maximize2, Minus, Move, PaintBucket, Pipette, Plus,
  RotateCcw, Smartphone, SquareDashedMousePointer, Trash2, X,
} from 'lucide-react';
import FontPicker from './FontPicker.jsx';
import { getAt } from '../../content/paths.js';
import { BUFFER_SIZES, COLOR_TOKENS, GRID_SIZES, approximatePhone, bgImageField, cleanSectionBg, cleanStyle, layoutBuffer, layoutGrid, styleKey } from '../../content/fieldStyle.js';
import { SECTION_TYPES, sectionLabel } from '../../content/schema.js';
import { safeUrl } from '../../lib/safeUrl.js';
import { isHex } from '../../content/theme.js';

// Format bar above the preview: formats or positions the element clicked in the preview.
// Text: font, size, bold/italic, color (theme swatches, any color, eyedropper), alignment.
// Photos and text: position (reset), the snapping grid, and — with 2+ selected —
// aligning the items to each other. Formatting applies to every selected text item.

const SIZES = [0.5, 0.6, 0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3];
const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify };
// Lining items up with each other (moves them; separate from text alignment).
// One item: aligned to its section, inside the buffer. Several: to each other.
const ARRANGE = [
  ['left', AlignStartVertical, 'Align left edges', 'Move to the left of the section'],
  ['center', AlignCenterVertical, 'Align centers', 'Center in the section'],
  ['right', AlignEndVertical, 'Align right edges', 'Move to the right of the section'],
  ['top', AlignStartHorizontal, 'Align top edges', 'Move to the top of the section'],
  ['middle', AlignCenterHorizontal, 'Align middles', 'Center vertically in the section'],
  ['bottom', AlignEndHorizontal, 'Align bottom edges', 'Move to the bottom of the section'],
];
const parse = (path) => {
  const m = /^(sections\.\d+)\.(.+)$/.exec(path || '');
  return m ? { base: m[1], f: m[2], stylePath: `${m[1]}.styles.${styleKey(m[2])}` } : null;
};

const Btn = ({ active, title, onClick, children, disabled }) => (
  <button type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled} onClick={onClick}
    className={`h-8 min-w-8 px-1.5 inline-flex items-center justify-center rounded-md text-sm disabled:opacity-30 ${active ? 'bg-[#6c5d84] text-white' : 'text-[#333036] hover:bg-[#333036]/8'}`}>
    {children}
  </button>
);
const Sep = () => <span className="w-px h-6 bg-[#333036]/12 mx-1 shrink-0" />;

function ColorMenu({ value, themeColors, onChange, label = 'Text color', fill = false, defaultLabel }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState('');
  const ref = useRef(null);
  const canDrop = typeof window !== 'undefined' && 'EyeDropper' in window;
  const token = COLOR_TOKENS.find((t) => t.key === value);
  const shown = token ? themeColors[token.key] : isHex(value || '') ? value : null;

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const pickWithEyedropper = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      onChange(sRGBHex);
    } catch { /* cancelled */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" title={label} aria-label={label} onClick={() => setOpen(!open)}
        className="h-8 px-1.5 inline-flex items-center gap-1 rounded-md hover:bg-[#333036]/8">
        {fill
          ? <PaintBucket className="w-4 h-4 text-[#333036]" />
          : <span className="text-sm font-semibold text-[#333036] leading-none">A</span>}
        <span className="w-4 h-1.5 rounded-sm border border-[#333036]/20" style={{ background: shown || 'transparent' }} />
      </button>
      {open && (
        <div className="absolute z-50 top-10 left-0 w-64 rounded-xl border border-[#333036]/12 bg-white shadow-xl p-3 space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-[#333036]/70 mb-1.5">Your color scheme</p>
            <div className="grid grid-cols-7 gap-1.5">
              {COLOR_TOKENS.map((t) => (
                <button key={t.key} type="button" title={t.label} aria-label={t.label} onClick={() => { onChange(t.key); setOpen(false); }}
                  className={`aspect-square rounded-md border ${value === t.key ? 'ring-2 ring-[#6c5d84] ring-offset-1' : 'border-[#333036]/15'}`}
                  style={{ background: themeColors[t.key] }} />
              ))}
            </div>
            <p className="text-[10px] text-[#333036]/50 mt-1">These follow the palette if you change it later.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#333036]/70 mb-1.5">Any color</p>
            <div className="flex items-center gap-1.5">
              <input type="color" aria-label="Pick any color" value={shown && shown.length === 7 ? shown : '#6c5d84'}
                onChange={(e) => onChange(e.target.value)} className="w-9 h-8 rounded border border-[#333036]/20 p-0.5 cursor-pointer" />
              <input value={hex} onChange={(e) => { setHex(e.target.value); if (isHex(e.target.value)) onChange(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`); }}
                placeholder={shown || '#rrggbb'} aria-label="Hex color" className="flex-1 min-w-0 h-8 rounded border border-[#333036]/20 px-2 text-xs font-mono" />
              {canDrop && (
                <button type="button" title="Pick a color from the screen" aria-label="Eyedropper" onClick={pickWithEyedropper}
                  className="h-8 w-8 inline-flex items-center justify-center rounded border border-[#333036]/20 hover:bg-[#333036]/5"><Pipette className="w-4 h-4" /></button>
              )}
            </div>
          </div>
          <button type="button" onClick={() => { onChange(undefined); setOpen(false); }} className="text-xs text-[#6c5d84] hover:underline">{defaultLabel || (fill ? 'Use the design\'s default fill' : 'Use the design\'s default color')}</button>
        </div>
      )}
    </div>
  );
}

// Opacity slider (0–100 %).
const Opacity = ({ label, short, value, onChange, disabled }) => (
  <label className={`h-8 inline-flex items-center gap-1.5 px-1.5 text-xs text-[#333036] ${disabled ? 'opacity-30' : ''}`} title={label}>
    <span className="w-3.5 h-3.5 rounded-sm border border-[#333036]/40" style={{ background: 'linear-gradient(135deg, #333036 50%, transparent 50%)' }} />
    {short && <span className="text-[11px] text-[#333036]/70">{short}</span>}
    <input type="range" min="0" max="100" step="5" value={value} disabled={disabled} aria-label={label}
      onChange={(e) => onChange(+e.target.value)} className="w-20 accent-[#6c5d84]" />
    <span className="w-8 tabular-nums text-[11px] text-[#333036]/70">{value}%</span>
  </label>
);

// Fill for text boxes and shapes: a color, frosted glass (see-through tint + blur,
// like the cover's RSVP button) or clear; plus transparency and corner rounding.
const FILL_MODES = [[undefined, 'Color', 'Solid color fill'], ['glass', 'Glass', 'Frosted glass: a see-through tint that blurs what is behind'], ['clear', 'Clear', 'No background']];
function FillControls({ targets, roundable, st, themeColors, setOn }) {
  const label = targets.length > 1 ? ' (all selected)' : '';
  return (
    <>
      <span className="inline-flex rounded-md border border-[#333036]/15 overflow-hidden h-8" role="group" aria-label="Fill style">
        {FILL_MODES.map(([mode, name, title]) => (
          <button key={name} type="button" title={title} aria-pressed={st.fx === mode} onClick={() => setOn(targets, 'fx', mode)}
            className={`px-2 text-xs ${st.fx === mode ? 'bg-[#6c5d84] text-white' : 'text-[#333036] hover:bg-[#333036]/8'}`}>{name}</button>
        ))}
      </span>
      {st.fx !== 'clear' && (
        <ColorMenu fill label={(st.fx === 'glass' ? 'Glass tint' : 'Fill color') + label} value={st.fill} themeColors={themeColors}
          defaultLabel={st.fx === 'glass' ? 'Use the background color as the tint' : undefined} onChange={(v) => setOn(targets, 'fill', v)} />
      )}
      <Opacity label={`Transparency${label}`} value={st.op ?? 100} onChange={(v) => setOn(targets, 'op', v === 100 ? undefined : v)} />
      {roundable.length > 0 && (
        <label className="h-8 inline-flex items-center gap-1.5 px-1.5 text-xs text-[#333036]" title="Corner rounding">
          <span className="w-3.5 h-3.5 border-2 border-[#333036]/70 rounded-tl-md border-r-0 border-b-0" />
          <input type="range" min="0" max="48" step="2" value={st.radius ?? 0} aria-label="Corner rounding"
            onChange={(e) => setOn(roundable, 'radius', +e.target.value)} className="w-16 accent-[#6c5d84]" />
        </label>
      )}
    </>
  );
}

// Where a button goes: a section on this page (stored as "#<section id>") or a web
// address. link = { path, fallback } from the preview (data-link on the button).
function LinkMenu({ link, content, setMany }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const saved = getAt(content, link.path);
  const value = safeUrl(saved || link.fallback);
  const sections = content.sections.map((s) => ({ id: s.id, label: sectionLabel(s), hidden: s.visible === false }));
  const target = value.startsWith('#') ? sections.find((s) => s.id === value.slice(1)) : null;
  const [mode, setMode] = useState(value && !value.startsWith('#') ? 'url' : 'section');
  const [url, setUrl] = useState(value.startsWith('#') ? '' : value);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const save = (v) => setMany([{ path: link.path, value: v }]);
  const saveUrl = () => { const u = safeUrl(url); if (u && !u.startsWith('#')) save(u); };
  const shown = target ? `→ ${target.label}` : value.startsWith('#') ? '→ (missing section)' : value ? value.replace(/^https?:\/\/(www\.)?/, '').slice(0, 22) : 'No link';
  return (
    <div className="relative" ref={ref}>
      <button type="button" title="Where this button goes" onClick={() => setOpen(!open)}
        className="h-8 px-2 inline-flex items-center gap-1.5 rounded-md text-xs text-[#333036] hover:bg-[#333036]/8 max-w-[12rem]">
        <Link2 className="w-4 h-4 shrink-0" /><span className="truncate">{shown}</span>
      </button>
      {open && (
        <div className="absolute z-50 top-10 left-0 w-72 rounded-xl border border-[#333036]/12 bg-white shadow-xl p-3 space-y-3 text-xs text-[#333036]">
          <p className="font-semibold text-[#333036]/70">Link this button to…</p>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'section'} onChange={() => setMode('section')} className="accent-[#6c5d84]" /> A section on this page</label>
          {mode === 'section' && (
            <select value={target?.id || ''} onChange={(e) => e.target.value && save(`#${e.target.value}`)}
              className="ml-5 w-[calc(100%-1.25rem)] h-8 rounded-md border border-[#333036]/20 px-1.5">
              <option value="">Choose a section…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.label}{s.hidden ? ' (hidden)' : ''}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'url'} onChange={() => setMode('url')} className="accent-[#6c5d84]" /> A web address (opens in a new tab)</label>
          {mode === 'url' && (
            <div className="ml-5 flex gap-1.5">
              <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveUrl(); }} onBlur={saveUrl}
                placeholder="https://…" aria-label="Web address" className="flex-1 min-w-0 h-8 rounded-md border border-[#333036]/20 px-2" />
              <button type="button" onClick={saveUrl} className="h-8 px-2.5 rounded-md bg-[#6c5d84] text-white font-semibold">Save</button>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-[#333036]/10">
            {link.fallback
              ? <button type="button" onClick={() => save(undefined)} className="text-[#6c5d84] hover:underline">Back to the default ({sections.find((s) => `#${s.id}` === link.fallback)?.label || link.fallback})</button>
              : <button type="button" onClick={() => save('')} className="text-[#6c5d84] hover:underline">Remove link</button>}
          </div>
          <p className="text-[10px] text-[#333036]/50">Buttons don't respond to clicks while editing; on the site they go here.</p>
        </div>
      )}
    </div>
  );
}

// Clicking empty space in a section: its background color and photo.
function SectionBgBar({ item, content, setMany, onPickImage, onAdjustImage, onClose }) {
  const base = item.path.replace(/\._bg$/, '');
  const section = getAt(content, base) || {};
  const bg = cleanSectionBg(section.bg);
  const imgPath = `${base}.${bgImageField(section.type)}`;
  const image = getAt(content, imgPath);
  const set = (key, value) => setMany([{ path: `${base}.bg.${key}`, value }]);
  const changed = bg.color || bg.imageOpacity !== undefined || (bgImageField(section.type) === 'bg.image' && image);
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl bg-white shadow-sm border border-[#333036]/10 px-2 py-1 mx-2 mb-2">
      <span className="text-[11px] font-semibold text-[#333036]/60 px-1 max-w-[11rem] truncate" title="Section background">
        Background · {SECTION_TYPES[section.type]?.label || 'Section'}
      </span>
      <Sep />
      <ColorMenu fill label="Background color" value={bg.color} themeColors={content.theme?.colors || {}}
        defaultLabel="Use the design's own background" onChange={(v) => set('color', v)} />
      <Sep />
      <button type="button" onClick={() => onPickImage(imgPath)}
        className="h-8 px-2 inline-flex items-center gap-1.5 rounded-md text-xs text-[#333036] hover:bg-[#333036]/8">
        <ImagePlus className="w-4 h-4" /> {image ? 'Change photo' : 'Add photo'}
      </button>
      {image && (
        <>
          <button type="button" onClick={() => onAdjustImage(imgPath)}
            className="h-8 px-2 inline-flex items-center gap-1.5 rounded-md text-xs text-[#333036] hover:bg-[#333036]/8">
            <Move className="w-4 h-4" /> Reposition & zoom
          </button>
          <Opacity label="Photo opacity (the background color shows through)" short="Photo" value={bg.imageOpacity ?? 100} onChange={(v) => set('imageOpacity', v === 100 ? undefined : v)} />
          <Btn title="Remove photo" onClick={() => setMany([{ path: imgPath, value: undefined }, { path: `${imgPath}Pos`, value: undefined }])}>
            <Trash2 className="w-4 h-4" />
          </Btn>
        </>
      )}
      <Sep />
      <Btn title="Back to the design's background" disabled={!changed}
        onClick={() => setMany([{ path: `${base}.bg`, value: undefined }])}>
        <RotateCcw className="w-3.5 h-3.5" />
      </Btn>
      <span className="flex-1" />
      <Btn title="Done (Esc)" onClick={onClose}><X className="w-4 h-4" /></Btn>
    </div>
  );
}

export default function FormatBar({ selection, content, setMany, grid, setGrid, onAlign, onClose, onSelectItems, device, onPickImage, onAdjustImage }) {
  if (selection.length === 1 && selection[0].kind === 'section') {
    return <SectionBgBar item={selection[0]} content={content} setMany={setMany} onPickImage={onPickImage} onAdjustImage={onAdjustImage} onClose={onClose} />;
  }
  const items = selection.filter((s) => s.kind !== 'section').map((s) => ({ ...s, ...parse(s.path) })).filter((s) => s.stylePath);
  if (!items.length) return null;
  // Text formatting applies to selected texts and to the (locked) text of selected buttons.
  const labels = items.filter((i) => i.kind === 'button' && i.label).map((i) => ({ kind: 'text', path: i.label, ...parse(i.label) })).filter((i) => i.stylePath);
  const texts = [...items.filter((i) => i.kind === 'text'), ...labels];
  const primary = texts[texts.length - 1] || items[items.length - 1];
  const named = items[items.length - 1];
  const st = cleanStyle(getAt(content, primary.stylePath));
  // Set one formatting property on every selected text item (one Undo step).
  const set = (key, value) => setMany(texts.map((t) => ({ path: `${t.stylePath}.${key}`, value })));
  const isText = texts.length > 0;
  const sizeIdx = SIZES.indexOf(SIZES.reduce((a, b) => (Math.abs(b - (st.size || 1)) < Math.abs(a - (st.size || 1)) ? b : a)));
  const moved = items.some((i) => { const x = cleanStyle(getAt(content, i.stylePath)); return x.x || x.y || x.mx || x.my; });
  const boxes = items.filter((i) => i.kind !== 'text');
  // Text boxes and shapes can have a fill (color / glass / clear) and transparency.
  const fillable = items.filter((i) => ['text', 'button', 'line', 'box', 'group'].includes(i.kind));
  const roundable = items.filter((i) => ['image', 'button', 'box', 'map', 'text', 'group'].includes(i.kind));
  const primaryBox = fillable[fillable.length - 1] || boxes[boxes.length - 1];
  const boxStyle = primaryBox ? cleanStyle(getAt(content, primaryBox.stylePath)) : {};
  const setOn = (list, key, value) => setMany(list.map((i) => ({ path: `${i.stylePath}.${key}`, value })));
  const sized = items.some((i) => { const x = cleanStyle(getAt(content, i.stylePath)); return x.w || x.h || x.mw || x.mh; });
  const resetSizes = () => setMany(items.map((i) => {
    const x = cleanStyle(getAt(content, i.stylePath));
    return { path: i.stylePath, value: { ...x, w: undefined, h: undefined, mw: undefined, mh: undefined } };
  }));
  const parent = items.length === 1 && items[0].kind === 'text' ? selection[0].parent : null;
  const phone = device === 'phone';
  const handTuned = items.filter((i) => cleanStyle(getAt(content, i.stylePath)).mAuto === false);
  // Phone back to automatic: redo the close approximation from the desktop values.
  const resetPhone = () => setMany(handTuned.map((i) => {
    const x = cleanStyle(getAt(content, i.stylePath));
    const auto = x.si && x.pw ? approximatePhone(x, i.kind, { sectionInner: x.si, parentWidth: x.pw, width: x.ew, placement: (x.pl ?? 500) / 1000 }, content.site) : {};
    return { path: i.stylePath, value: { ...x, mx: undefined, my: undefined, mw: undefined, mh: undefined, mAuto: undefined, ...auto } };
  }));
  const single = items.length === 1;
  const resetPositions = () => setMany(items.map((i) => {
    const x = cleanStyle(getAt(content, i.stylePath));
    return { path: i.stylePath, value: { ...x, x: undefined, y: undefined, mx: undefined, my: undefined } };
  }));
  const pretty = (f) => f.replace(/\.(\d+)\./, ' $1 · ').replace(/([A-Z])/g, ' $1').toLowerCase();
  const label = items.length > 1
    ? `${items.length} selected`
    : `${{ text: 'Text', image: 'Photo', button: 'Button', line: 'Line', box: 'Box', map: 'Map', group: 'Group' }[named.kind] || 'Item'} · ${pretty(named.f.replace(/^_|\._/g, (m) => (m === '_' ? '' : '.')))}`;

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl bg-white shadow-sm border border-[#333036]/10 px-2 py-1 mx-2 mb-2">
      <span className="text-[11px] font-semibold text-[#333036]/60 px-1 max-w-[9rem] truncate first-letter:uppercase" title={label}>{label}</span>
      <Sep />
      {isText && (
        <>
          <FontPicker font={st.font} ff={st.ff} theme={content.theme}
            onPick={(font, ff) => setMany(texts.flatMap((t) => [{ path: `${t.stylePath}.font`, value: font }, { path: `${t.stylePath}.ff`, value: ff }]))} />
          <Btn title="Smaller" disabled={sizeIdx <= 0} onClick={() => set('size', SIZES[sizeIdx - 1] === 1 ? undefined : SIZES[sizeIdx - 1])}><Minus className="w-3.5 h-3.5" /></Btn>
          <button type="button" title="Reset size" onClick={() => set('size', undefined)} className="h-8 w-11 text-xs tabular-nums text-[#333036] hover:bg-[#333036]/8 rounded-md">{Math.round((st.size || 1) * 100)}%</button>
          <Btn title="Bigger" disabled={sizeIdx >= SIZES.length - 1} onClick={() => set('size', SIZES[sizeIdx + 1] === 1 ? undefined : SIZES[sizeIdx + 1])}><Plus className="w-3.5 h-3.5" /></Btn>
          <Sep />
          <Btn title="Bold" active={st.bold === true} onClick={() => set('bold', st.bold === true ? undefined : true)}><Bold className="w-4 h-4" /></Btn>
          <Btn title="Italic" active={st.italic === true} onClick={() => set('italic', st.italic === true ? undefined : true)}><Italic className="w-4 h-4" /></Btn>
          <ColorMenu value={st.color} themeColors={content.theme?.colors || {}} onChange={(v) => set('color', v)} />
          <Sep />
          {Object.entries(ALIGN_ICONS).map(([a, Icon]) => (
            <Btn key={a} title={`Align ${a}`} active={st.align === a} onClick={() => set('align', st.align === a ? undefined : a)}><Icon className="w-4 h-4" /></Btn>
          ))}
          <Sep />
        </>
      )}
      {ARRANGE.map(([mode, Icon, title, singleTitle]) => (
        <Btn key={mode} title={single ? singleTitle : title} onClick={() => onAlign(mode)}><Icon className="w-4 h-4" /></Btn>
      ))}
      <Sep />
      {single && items[0].kind === 'button' && selection[selection.length - 1]?.link && (
        <>
          <LinkMenu key={items[0].path} link={selection[selection.length - 1].link} content={content} setMany={setMany} />
          <Sep />
        </>
      )}
      {parent && (
        <>
          <Btn title={`Select the ${parent.kind === 'button' ? 'button' : parent.kind === 'box' ? 'box' : 'item'} around this text`} onClick={() => onSelectItems([parent])}>
            <SquareDashedMousePointer className="w-4 h-4" />
          </Btn>
          <Sep />
        </>
      )}
      {fillable.length > 0 ? (
        <FillControls targets={fillable} roundable={roundable} st={boxStyle} themeColors={content.theme?.colors || {}} setOn={setOn} />
      ) : roundable.length > 0 && (
        <label className="h-8 inline-flex items-center gap-1.5 px-1.5 text-xs text-[#333036]" title="Corner rounding">
          <span className="w-3.5 h-3.5 border-2 border-[#333036]/70 rounded-tl-md border-r-0 border-b-0" />
          <input type="range" min="0" max="48" step="2" value={boxStyle.radius ?? 0} aria-label="Corner rounding"
            onChange={(e) => setOn(roundable, 'radius', +e.target.value)} className="w-20 accent-[#6c5d84]" />
        </label>
      )}
      {(fillable.length > 0 || roundable.length > 0) && <Sep />}
      <Btn title={items.length > 1 ? 'Reset sizes' : 'Reset size'} disabled={!sized} onClick={resetSizes}><Maximize2 className="w-3.5 h-3.5" /></Btn>
      <Btn title={items.length > 1 ? 'Put all back in their original spots' : 'Put back in its original spot'} disabled={!moved} onClick={resetPositions}>
        <RotateCcw className="w-3.5 h-3.5" />
      </Btn>
      <Btn title={grid.show ? 'Hide grid' : 'Show grid'} active={grid.show} onClick={() => setGrid({ ...grid, show: !grid.show })}><Grid3x3 className="w-4 h-4" /></Btn>
      <select aria-label="Grid size" title="Snapping grid (saved for everyone)" value={layoutGrid(content.site)}
        onChange={(e) => setMany([{ path: 'site.layoutGrid', value: +e.target.value }])}
        className="h-8 rounded-md border border-[#333036]/15 bg-white px-1 text-xs">
        {GRID_SIZES.map((n) => <option key={n} value={n}>{n}px grid</option>)}
      </select>
      <select aria-label="Edge buffer" title="How close to a section's edge anything may go (phones use 2/3 of this)" value={layoutBuffer(content.site)}
        onChange={(e) => setMany([{ path: 'site.layoutBuffer', value: +e.target.value }])}
        className="h-8 rounded-md border border-[#333036]/15 bg-white px-1 text-xs">
        {BUFFER_SIZES.map((n) => <option key={n} value={n}>{n}px buffer</option>)}
      </select>
      {phone && (
        <>
          <Sep />
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6c5d84] px-1" title="Changes here only affect phones and stop the automatic phone layout for these items.">
            <Smartphone className="w-3.5 h-3.5" /> Phone layout
          </span>
          <Btn title="Reset phone layout to automatic (follows desktop)" disabled={!handTuned.length} onClick={resetPhone}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Btn>
        </>
      )}
      <span className="flex-1" />
      <Btn title="Done (Esc)" onClick={onClose}><X className="w-4 h-4" /></Btn>
    </div>
  );
}
