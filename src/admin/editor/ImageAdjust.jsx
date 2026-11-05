import { useRef, useState } from 'react';
import { Monitor, RotateCcw, Smartphone, X } from 'lucide-react';
import CoverImage, { normalizePos } from '../../site/CoverImage.jsx';

// Reposition a photo: click/drag on it to choose the point that stays in view,
// and zoom in. Phones can have their own position (they crop the sides of a photo
// instead of the top/bottom). Changes apply live; Done just closes the window.
export default function ImageAdjust({ src, pos, onChange, onClose }) {
  const [device, setDevice] = useState('desktop');
  const boxRef = useRef(null);
  const main = normalizePos(pos);
  const hasMobile = !!pos?.mobile;
  const editingPhone = device === 'phone' && hasMobile;
  const p = editingPhone ? normalizePos(pos.mobile) : main;

  // Writes either the main position or the phone override, keeping the other.
  const update = (next) => {
    const n = normalizePos(next);
    if (editingPhone) onChange({ ...main, mobile: n });
    else onChange(hasMobile ? { ...n, mobile: normalizePos(pos.mobile) } : n);
  };

  const setFromPointer = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    update({
      ...p,
      x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))),
      y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))),
    });
  };
  const nudge = (dx, dy) => update({ ...p, x: p.x + dx, y: p.y + dy });

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#f4efe7] rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#333036]/10">
          <div>
            <h3 className="font-semibold text-[#333036]">Reposition photo</h3>
            <p className="text-xs text-[#333036]/60">Click or drag on the photo to choose what stays in view. Putting the point higher shows more of the top of the photo, which moves people lower on the page.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[#333036]/60 hover:text-[#333036]"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 pt-4 flex gap-1">
          {[['desktop', Monitor, 'Wide screens'], ['phone', Smartphone, 'Phones']].map(([k, Icon, label]) => (
            <button key={k} onClick={() => setDevice(k)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${device === k ? 'bg-white text-[#6c5d84] font-semibold shadow-sm' : 'text-[#333036]/70 hover:bg-white/60'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        {device === 'phone' && (
          <label className="mx-5 mt-3 flex items-center gap-2 text-sm text-[#333036]">
            <input type="checkbox" className="accent-[#6c5d84] w-4 h-4" checked={hasMobile}
              onChange={(e) => onChange(e.target.checked ? { ...main, mobile: { ...main } } : main)} />
            Use a different position on phones
          </label>
        )}

        <div className="p-5 grid md:grid-cols-[1fr_200px] gap-5">
          <div className={device === 'phone' && !hasMobile ? 'opacity-50 pointer-events-none' : ''}>
            <div
              ref={boxRef}
              className="relative w-full rounded-md overflow-hidden cursor-crosshair touch-none select-none bg-[#333036]/10"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFromPointer(e); }}
              onPointerMove={(e) => { if (e.buttons) setFromPointer(e); }}
            >
              <img src={src} alt="" draggable={false} className="block w-full max-h-[50vh] object-contain" />
              <div className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)] pointer-events-none"
                style={{ left: `${p.x}%`, top: `${p.y}%` }} />
            </div>
            <div className="flex items-center gap-3 mt-4">
              <label className="text-xs font-semibold text-[#333036]/80 w-12">Zoom</label>
              <input type="range" min="1" max="3" step="0.05" value={p.zoom}
                onChange={(e) => update({ ...p, zoom: +e.target.value })} className="flex-1 accent-[#6c5d84]" />
              <span className="text-xs text-[#333036]/70 w-10 text-right">{p.zoom.toFixed(2)}×</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span className="text-[#333036]/60">Fine-tune:</span>
              {[['↑', 0, -2], ['↓', 0, 2], ['←', -2, 0], ['→', 2, 0]].map(([l, dx, dy]) => (
                <button key={l} onClick={() => nudge(dx, dy)} className="w-7 h-7 rounded border border-[#333036]/20 bg-white hover:border-[#6c5d84]">{l}</button>
              ))}
              <button onClick={() => update({ x: 50, y: 50, zoom: 1 })} className="ml-auto flex items-center gap-1 text-[#6c5d84] hover:underline">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
            {device === 'phone' && !hasMobile && (
              <p className="text-xs text-[#333036]/70 mt-3">Phones currently use the same position as wide screens.</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#333036]/80">How it looks</p>
            <div>
              <p className="flex items-center gap-1 text-[11px] text-[#333036]/60 mb-1"><Monitor className="w-3 h-3" /> Wide screen</p>
              <div className="relative aspect-video rounded-md overflow-hidden bg-[#333036]/10"><CoverImage src={src} pos={pos} device="desktop" /></div>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[11px] text-[#333036]/60 mb-1"><Smartphone className="w-3 h-3" /> Phone</p>
              <div className="relative w-24 aspect-[9/19] rounded-md overflow-hidden bg-[#333036]/10"><CoverImage src={src} pos={pos} device="phone" /></div>
            </div>
            <p className="text-[11px] text-[#333036]/55">The live preview behind this window updates too. Switch it to Phone at the top to check.</p>
          </div>
        </div>

        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose} className="rounded-md bg-[#6c5d84] text-white px-5 py-2 text-sm font-semibold hover:bg-[#524569]">Done</button>
        </div>
      </div>
    </div>
  );
}
