import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { COMMON_TIME_ZONES } from '../../content/time.js';

export const inputCls = 'w-full rounded-md border border-[#333036]/20 bg-white px-3 py-2 text-sm text-[#333036] outline-none focus:border-[#6c5d84] focus:ring-2 focus:ring-[#6c5d84]/20';
const labelCls = 'block text-xs font-semibold text-[#333036]/80 mb-1.5';

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span className="text-sm text-[#333036]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#6c5d84]' : 'bg-[#333036]/20'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}

function ImageField({ value, onPick, onClear }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 h-14 rounded-md bg-[#333036]/10 bg-cover bg-center border border-[#333036]/10 shrink-0" style={value ? { backgroundImage: `url('${value}')` } : undefined} />
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={onPick} className="flex items-center gap-1.5 text-xs font-semibold text-[#6c5d84] hover:underline">
          <ImagePlus className="w-3.5 h-3.5" /> {value ? 'Change photo' : 'Add photo'}
        </button>
        {value && (
          <button type="button" onClick={onClear} className="flex items-center gap-1.5 text-xs text-[#333036]/60 hover:text-[#7a4d55]">
            <X className="w-3.5 h-3.5" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function ListField({ field, items = [], path, onChange, onPickImage }) {
  const [open, setOpen] = useState(null);
  const setItems = (next) => onChange(path, next);
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    setOpen(j);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const title = item[field.itemLabel] || `${field.label} ${i + 1}`;
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-md border border-[#333036]/15 bg-white">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex-1 text-left text-sm text-[#333036] truncate py-1 px-1">
                {title}
              </button>
              <button type="button" title="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-[#333036]/50 hover:text-[#6c5d84] disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
              <button type="button" title="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1 text-[#333036]/50 hover:text-[#6c5d84] disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
              <button type="button" title="Duplicate" onClick={() => { const n = [...items]; n.splice(i + 1, 0, structuredClone(item)); setItems(n); }} className="p-1 text-[#333036]/50 hover:text-[#6c5d84]"><Copy className="w-3.5 h-3.5" /></button>
              <button type="button" title="Delete" onClick={() => { if (confirm(`Delete "${title}"?`)) { setItems(items.filter((_, k) => k !== i)); setOpen(null); } }} className="p-1 text-[#333036]/50 hover:text-[#7a4d55]"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            {isOpen && (
              <div className="border-t border-[#333036]/10 p-3 space-y-3">
                <Fields fields={field.itemFields} data={item} basePath={`${path}.${i}`} onChange={onChange} onPickImage={onPickImage} />
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => { setItems([...items, structuredClone(field.newItem)]); setOpen(items.length); }}
        className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-[#6c5d84]/50 py-2 text-xs font-semibold text-[#6c5d84] hover:bg-[#6c5d84]/5"
      >
        <Plus className="w-3.5 h-3.5" /> Add {field.label.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  );
}

// Renders a set of schema fields. onChange(path, value) with full dotted paths.
export function Fields({ fields, data, basePath, onChange, onPickImage }) {
  return fields.map((f) => {
    const path = `${basePath}.${f.key}`;
    const value = data?.[f.key];
    let control;
    switch (f.type) {
      case 'toggle':
        return <Toggle key={f.key} label={f.label} checked={value} onChange={(v) => onChange(path, v)} />;
      case 'textarea':
        control = <textarea className={`${inputCls} min-h-[88px] resize-y`} value={value ?? ''} onChange={(e) => onChange(path, e.target.value)} />;
        break;
      case 'image':
        control = <ImageField value={value} onPick={() => onPickImage(path)} onClear={() => onChange(path, '')} />;
        break;
      case 'url':
        control = <input type="url" className={inputCls} placeholder="https://…" value={value ?? ''} onChange={(e) => onChange(path, e.target.value.trim())} />;
        break;
      case 'datetime':
        control = <input type="datetime-local" className={inputCls} value={value ?? ''} onChange={(e) => onChange(path, e.target.value)} />;
        break;
      case 'timezone':
        control = (
          <select className={inputCls} value={value ?? ''} onChange={(e) => onChange(path, e.target.value)}>
            {[...new Set([value, ...COMMON_TIME_ZONES].filter(Boolean))].map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
          </select>
        );
        break;
      case 'list':
        control = <ListField field={f} items={value} path={path} onChange={onChange} onPickImage={onPickImage} />;
        break;
      default:
        control = <input type="text" className={inputCls} value={value ?? ''} onChange={(e) => onChange(path, e.target.value)} />;
    }
    return (
      <div key={f.key}>
        <label className={labelCls}>{f.label}</label>
        {control}
        {f.help && <p className="text-[11px] text-[#333036]/55 mt-1">{f.help}</p>}
      </div>
    );
  });
}
