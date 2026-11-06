import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Grid3x3, Italic, Minus, Pipette, Plus, RotateCcw, X,
} from 'lucide-react';
import { getAt } from '../../content/paths.js';
import { COLOR_TOKENS, FONT_ROLES, cleanStyle, styleKey } from '../../content/fieldStyle.js';
import { isHex } from '../../content/theme.js';

// Format bar above the preview: formats or positions the element clicked in the preview.
// Text: font, size, bold/italic, color (theme swatches, any color, eyedropper), alignment.
// Photos and text: position (reset) and the snapping grid.

const SIZES = [0.5, 0.6, 0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3];
const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify };

const Btn = ({ active, title, onClick, children, disabled }) => (
  <button type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled} onClick={onClick}
    className={`h-8 min-w-8 px-1.5 inline-flex items-center justify-center rounded-md text-sm disabled:opacity-30 ${active ? 'bg-[#6c5d84] text-white' : 'text-[#333036] hover:bg-[#333036]/8'}`}>
    {children}
  </button>
);
const Sep = () => <span className="w-px h-6 bg-[#333036]/12 mx-1 shrink-0" />;

function ColorMenu({ value, themeColors, onChange }) {
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
      <button type="button" title="Text color" aria-label="Text color" onClick={() => setOpen(!open)}
        className="h-8 px-1.5 inline-flex items-center gap-1 rounded-md hover:bg-[#333036]/8">
        <span className="text-sm font-semibold text-[#333036] leading-none">A</span>
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
          <button type="button" onClick={() => { onChange(undefined); setOpen(false); }} className="text-xs text-[#6c5d84] hover:underline">Use the design's default color</button>
        </div>
      )}
    </div>
  );
}

export default function FormatBar({ el, content, setField, grid, setGrid, onClose }) {
  const m = /^(sections\.\d+)\.(.+)$/.exec(el?.path || '');
  if (!m) return null;
  const [, base, f] = m;
  const stylePath = `${base}.styles.${styleKey(f)}`;
  const st = cleanStyle(getAt(content, stylePath));
  const set = (key, value) => setField(`${stylePath}.${key}`, value);
  const isText = el.kind === 'text';
  const sizeIdx = SIZES.indexOf(SIZES.reduce((a, b) => (Math.abs(b - (st.size || 1)) < Math.abs(a - (st.size || 1)) ? b : a)));
  const moved = !!(st.x || st.y || st.mx || st.my);
  const label = f.replace(/\.(\d+)\./, ' $1 · ').replace(/([A-Z])/g, ' $1').toLowerCase();

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl bg-white shadow-sm border border-[#333036]/10 px-2 py-1 mx-2 mb-2">
      <span className="text-[11px] font-semibold text-[#333036]/60 px-1 capitalize max-w-[9rem] truncate" title={label}>{isText ? 'Text' : 'Photo'} · {label}</span>
      <Sep />
      {isText && (
        <>
          <select aria-label="Font" value={st.font || ''} onChange={(e) => set('font', e.target.value || undefined)}
            className="h-8 rounded-md border border-[#333036]/15 bg-white px-1.5 text-xs max-w-[9.5rem]">
            <option value="">Font: default</option>
            {FONT_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
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
      <Btn title="Put back in its original spot" disabled={!moved} onClick={() => setField(stylePath, { ...st, x: undefined, y: undefined, mx: undefined, my: undefined })}>
        <RotateCcw className="w-3.5 h-3.5" />
      </Btn>
      <Btn title={grid.show ? 'Hide grid' : 'Show grid'} active={grid.show} onClick={() => setGrid({ ...grid, show: !grid.show })}><Grid3x3 className="w-4 h-4" /></Btn>
      <select aria-label="Grid size" value={grid.step} onChange={(e) => setGrid({ ...grid, step: +e.target.value })}
        className="h-8 rounded-md border border-[#333036]/15 bg-white px-1 text-xs">
        {[8, 16, 24, 32].map((n) => <option key={n} value={n}>{n}px grid</option>)}
      </select>
      <span className="flex-1" />
      <Btn title="Done (Esc)" onClick={onClose}><X className="w-4 h-4" /></Btn>
    </div>
  );
}
