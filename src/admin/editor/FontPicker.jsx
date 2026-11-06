import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { FONT_ROLES } from '../../content/fieldStyle.js';
import { BUILTIN_FONTS, DEFAULT_THEME } from '../../content/theme.js';

// Font menu for the format bar. Every font is shown by name, written in that font:
// - the site's three theme fonts (they follow Site settings → Colors & fonts),
// - the fonts bundled with the site,
// - every Google Font (about 1,600; list in googleFonts.json, loaded on first open).
// Picking a theme font stores `font: <role>`; any other font stores `ff: <family>`
// (the site then loads it from Google Fonts — see usedFontFamilies / ThemeStyle).

const CATEGORIES = [['', 'All'], ['s', 'Serif'], ['a', 'Sans'], ['h', 'Script'], ['d', 'Display'], ['m', 'Mono']];
const PAGE = 60;

// Load just enough of a Google font to draw its own name (Google's `text=` subset).
const previewed = new Set();
const previewGoogleFont = (family) => {
  if (previewed.has(family)) return;
  previewed.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&text=${encodeURIComponent(family)}&display=swap`;
  document.head.appendChild(link);
};

let listPromise = null;
const loadGoogleList = () => {
  listPromise ||= import('./googleFonts.json').then((m) => (m.default || m).map((x) => { const [name, cat] = x.split('|'); return { name, cat }; }));
  return listPromise;
};

const themeFamily = (theme, key) => {
  const f = { ...DEFAULT_THEME.fonts[key], ...(theme?.fonts?.[key] || {}) };
  return f.source === 'custom' ? 'Uploaded font' : f.family || DEFAULT_THEME.fonts[key].family;
};
const isBuiltin = (name) => BUILTIN_FONTS.some((b) => b.family === name);

// One row: the font's name in the font itself. Google fonts load when scrolled into view.
function FontRow({ name, family, google, note, active, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!google) return;
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { previewGoogleFont(family); io.disconnect(); } });
    io.observe(el);
    return () => io.disconnect();
  }, [google, family]);
  return (
    <button ref={ref} type="button" onClick={onPick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left hover:bg-[#6c5d84]/8 ${active ? 'bg-[#6c5d84]/10' : ''}`}>
      <span className="flex-1 min-w-0 truncate text-[17px] leading-snug text-[#333036]" style={{ fontFamily: `'${family}', serif` }}>{name}</span>
      {note && <span className="shrink-0 text-[10px] text-[#333036]/50 font-sans">{note}</span>}
      {active && <Check className="w-3.5 h-3.5 shrink-0 text-[#6c5d84]" />}
    </button>
  );
}

export default function FontPicker({ font, ff, theme, onPick }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [google, setGoogle] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    loadGoogleList().then(setGoogle).catch(() => setGoogle([]));
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  // What the button shows: the chosen font's name, in that font.
  const current = ff || (font ? themeFamily(theme, font) : null);
  useEffect(() => { if (ff && !isBuiltin(ff)) previewGoogleFont(ff); }, [ff]);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (google || []).filter((g) => (!cat || g.cat === cat) && (!q || g.name.toLowerCase().includes(q))), [google, cat, q]);
  const pick = (role, family) => { onPick(role, family); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} title="Font" aria-label="Font" aria-expanded={open}
        className="h-8 w-[9.5rem] inline-flex items-center gap-1 rounded-md border border-[#333036]/15 bg-white px-2 text-left hover:border-[#333036]/30">
        <span className="flex-1 min-w-0 truncate text-[14px] text-[#333036]" style={current ? { fontFamily: `'${current}', serif` } : undefined}>
          {current || 'Default font'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#333036]/50" />
      </button>
      {open && (
        <div className="absolute z-50 top-10 left-0 w-80 rounded-xl border border-[#333036]/12 bg-white shadow-xl font-sans">
          <div className="p-2 border-b border-[#333036]/10 space-y-2">
            <label className="flex items-center gap-1.5 h-8 rounded-md border border-[#333036]/20 px-2 focus-within:border-[#6c5d84]">
              <Search className="w-3.5 h-3.5 text-[#333036]/50" />
              <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search all fonts…" className="flex-1 min-w-0 text-sm outline-none" />
            </label>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map(([k, label]) => (
                <button key={k} type="button" onClick={() => { setCat(k); setLimit(PAGE); }}
                  className={`px-2 py-0.5 rounded-full text-[11px] ${cat === k ? 'bg-[#6c5d84] text-white' : 'bg-[#333036]/6 text-[#333036]/75 hover:bg-[#333036]/10'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {!q && !cat && (
              <>
                <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#333036]/50">Your site's fonts</p>
                <FontRow name="Design default" family="inherit" active={!font && !ff} onPick={() => pick(undefined, undefined)} />
                {FONT_ROLES.map((r) => {
                  const fam = themeFamily(theme, r.key);
                  return <FontRow key={r.key} name={fam} family={fam === 'Uploaded font' ? `Wedding ${r.key}` : fam} google={theme?.fonts?.[r.key]?.source === 'google'}
                    note={r.label} active={!ff && font === r.key} onPick={() => pick(r.key, undefined)} />;
                })}
                <p className="px-2.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#333036]/50">Built in</p>
                {BUILTIN_FONTS.map((b) => (
                  <FontRow key={b.family} name={b.family} family={b.family} active={ff === b.family} onPick={() => pick(undefined, b.family)} />
                ))}
              </>
            )}
            <p className="px-2.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#333036]/50">
              Google Fonts{google ? ` · ${matches.length.toLocaleString()}` : ''}
            </p>
            {!google && <p className="px-2.5 py-2 text-xs text-[#333036]/50">Loading fonts…</p>}
            {google && matches.length === 0 && <p className="px-2.5 py-2 text-xs text-[#333036]/50">No fonts match “{query}”.</p>}
            {matches.slice(0, limit).map((g) => (
              <FontRow key={g.name} name={g.name} family={g.name} google active={ff === g.name} onPick={() => pick(undefined, g.name)} />
            ))}
            {matches.length > limit && (
              <button type="button" onClick={() => setLimit(limit + PAGE * 2)} className="w-full py-2 text-xs text-[#6c5d84] hover:underline">
                Show more ({(matches.length - limit).toLocaleString()} left)
              </button>
            )}
          </div>
          <p className="px-3 py-2 border-t border-[#333036]/10 text-[10px] text-[#333036]/50">Theme fonts follow Site settings → Colors & fonts. Others are free fonts from Google Fonts.</p>
        </div>
      )}
    </div>
  );
}
