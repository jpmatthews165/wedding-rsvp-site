import { useState } from 'react';
import { STATUS, cx } from './ui.jsx';

const ORDER = ['yes', 'no', 'pending'];

// Legend for the RSVP bars (color + icon + label, so color is never the only cue).
export function StatusLegend({ className }) {
  return (
    <div className={cx('flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6f6a75]', className)}>
      {ORDER.map((k) => {
        const Icon = STATUS[k].icon;
        return (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS[k].bar }} />
            <Icon className="w-3 h-3" strokeWidth={2.5} /> {STATUS[k].label}
          </span>
        );
      })}
    </div>
  );
}

// Horizontal stacked bar of attending / declined / awaiting, with a hover tooltip.
// counts: { yes, no, pending }
export function StackedBar({ counts, height = 10 }) {
  const [hover, setHover] = useState(null);
  const total = ORDER.reduce((n, k) => n + (counts[k] || 0), 0);
  if (!total) return <div className="rounded-full bg-[#f1ede6]" style={{ height }} />;
  const parts = ORDER.filter((k) => counts[k] > 0);
  return (
    <div className="relative">
      <div className="flex gap-[2px] rounded-full overflow-hidden" style={{ height }}>
        {parts.map((k) => (
          <div
            key={k}
            onMouseEnter={() => setHover(k)}
            onMouseLeave={() => setHover(null)}
            className="h-full transition-[filter] hover:brightness-95"
            style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS[k].bar, minWidth: 4 }}
          />
        ))}
      </div>
      {hover && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-[#2b2830] text-white text-xs px-2 py-1 whitespace-nowrap pointer-events-none shadow">
          {STATUS[hover].label}: {counts[hover]} ({Math.round((counts[hover] / total) * 100)}%)
        </div>
      )}
    </div>
  );
}
