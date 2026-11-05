import { useRef, useState } from 'react';
import { Check, Loader2, RotateCcw, Upload } from 'lucide-react';
import {
  BUILTIN_FONTS, COLOR_FIELDS, DEFAULT_THEME, FONT_SLOTS, GOOGLE_FONT_SUGGESTIONS, THEME_PRESETS, isHex,
} from '../../content/theme.js';
import ThemeStyle from '../../site/ThemeStyle.jsx';
import { inputCls } from './FieldForm.jsx';
import { isFontFile, uploadFile } from './upload.js';

const same = (a, b) => Object.keys(a).every((k) => (a[k] || '').toLowerCase() === (b[k] || '').toLowerCase());

function ColorRow({ field, value, onChange }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? value;
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={isHex(value) && value.length === 7 ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-md border border-[#333036]/20 bg-white p-0.5 cursor-pointer shrink-0"
        aria-label={field.label}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#333036]">{field.label}</p>
        <p className="text-[11px] text-[#333036]/55 truncate">{field.help}</p>
      </div>
      <input
        value={shown}
        onChange={(e) => { setDraft(e.target.value); if (isHex(e.target.value)) onChange(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`); }}
        onBlur={() => setDraft(null)}
        className="w-20 rounded-md border border-[#333036]/20 bg-white px-2 py-1 text-xs font-mono"
        aria-label={`${field.label} hex code`}
      />
    </div>
  );
}

function FontPicker({ slot, font, onChange, getToken }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const previewFamily = font.source === 'custom' && font.url ? `Wedding ${slot.key}` : font.family;

  const handleFile = async (file) => {
    if (!file) return;
    if (!isFontFile(file)) { setError('Please choose a .woff2, .woff, .ttf or .otf font file.'); return; }
    setError('');
    setBusy(true);
    try {
      const url = await uploadFile(file, getToken, 'fonts');
      onChange({ source: 'custom', family: file.name.replace(/\.\w+$/, ''), url });
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-[#333036]/15 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#333036]/80">{slot.label}</p>
        <select
          value={font.source}
          onChange={(e) => {
            const source = e.target.value;
            if (source === 'builtin') onChange({ source, family: BUILTIN_FONTS[0].family, url: '' });
            if (source === 'google') onChange({ source, family: GOOGLE_FONT_SUGGESTIONS[0], url: '' });
            if (source === 'custom') fileRef.current?.click();
          }}
          className="text-xs rounded border border-[#333036]/20 px-1.5 py-1 bg-white"
        >
          <option value="builtin">Site fonts</option>
          <option value="google">Google Fonts</option>
          <option value="custom">Upload a font…</option>
        </select>
      </div>

      {font.source === 'builtin' && (
        <select className={inputCls} value={font.family} onChange={(e) => onChange({ ...font, family: e.target.value })}>
          {BUILTIN_FONTS.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
        </select>
      )}
      {font.source === 'google' && (
        <>
          <input
            className={inputCls}
            list={`google-fonts-${slot.key}`}
            value={font.family}
            onChange={(e) => onChange({ ...font, family: e.target.value })}
            placeholder="Font name from fonts.google.com"
          />
          <datalist id={`google-fonts-${slot.key}`}>
            {GOOGLE_FONT_SUGGESTIONS.map((f) => <option key={f} value={f} />)}
          </datalist>
          <p className="text-[11px] text-[#333036]/55">
            Type any name exactly as it appears on <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer" className="underline">fonts.google.com</a>.
          </p>
        </>
      )}
      {font.source === 'custom' && (
        <p className="text-xs text-[#333036]/70 flex items-center gap-1.5">
          {font.url ? <><Check className="w-3.5 h-3.5 text-[#4f7a5a]" /> Using uploaded font: {font.family}</> : 'No font uploaded yet.'}
          <button type="button" onClick={() => fileRef.current?.click()} className="ml-auto text-[#6c5d84] font-semibold hover:underline">Replace</button>
        </p>
      )}
      <input ref={fileRef} type="file" accept=".woff2,.woff,.ttf,.otf" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
      {busy && <p className="flex items-center gap-1.5 text-xs text-[#6c5d84]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading font…</p>}
      {error && <p className="text-xs text-[#7a4d55]">{error}</p>}

      <p className="text-2xl text-[#333036] truncate pt-1" style={{ fontFamily: `'${previewFamily}', serif` }}>{slot.sample}</p>
    </div>
  );
}

export default function ThemePanel({ theme, onChange, getToken }) {
  const colors = theme.colors;
  return (
    <div className="space-y-6">
      {/* Loads the chosen fonts so the samples below render in them. */}
      <ThemeStyle theme={theme} />

      <div>
        <p className="text-xs font-semibold text-[#333036]/80 mb-2">Color palettes</p>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((p) => {
            const active = same(p.colors, colors);
            return (
              <button key={p.name} type="button" onClick={() => onChange('theme.colors', { ...p.colors })}
                className={`rounded-md border bg-white p-2 text-left ${active ? 'border-[#6c5d84] ring-2 ring-[#6c5d84]/20' : 'border-[#333036]/15 hover:border-[#6c5d84]/40'}`}>
                <div className="flex h-5 rounded overflow-hidden mb-1.5">
                  {['paper', 'paper2', 'brand', 'accent', 'ink'].map((k) => <span key={k} className="flex-1" style={{ background: p.colors[k] }} />)}
                </div>
                <span className="text-[11px] text-[#333036]">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#333036]/80">Colors</p>
          <button type="button" onClick={() => onChange('theme.colors', { ...DEFAULT_THEME.colors })} className="flex items-center gap-1 text-[11px] text-[#6c5d84] hover:underline">
            <RotateCcw className="w-3 h-3" /> Original
          </button>
        </div>
        <div className="space-y-3">
          {COLOR_FIELDS.map((f) => (
            <ColorRow key={f.key} field={f} value={colors[f.key]} onChange={(v) => onChange(`theme.colors.${f.key}`, v)} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#333036]/80">Fonts</p>
          <button type="button" onClick={() => onChange('theme.fonts', structuredClone(DEFAULT_THEME.fonts))} className="flex items-center gap-1 text-[11px] text-[#6c5d84] hover:underline">
            <RotateCcw className="w-3 h-3" /> Original
          </button>
        </div>
        <div className="space-y-3">
          {FONT_SLOTS.map((slot) => (
            <FontPicker key={slot.key} slot={slot} font={theme.fonts[slot.key]} getToken={getToken}
              onChange={(f) => onChange(`theme.fonts.${slot.key}`, f)} />
          ))}
        </div>
        <p className="text-[11px] text-[#333036]/55 mt-2 flex items-center gap-1"><Upload className="w-3 h-3" /> Uploaded fonts must be licensed for web use.</p>
      </div>
    </div>
  );
}
