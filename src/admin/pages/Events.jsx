import { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Check, Pencil, X } from 'lucide-react';
import { Card, EmptyState, IconButton, PageHeader, inputCls, useToast } from '../ui.jsx';
import { StackedBar, StatusLegend } from '../charts.jsx';
import { statusOf } from '../useGuestData.js';

export default function Events({ data }) {
  const { events, guests, actions } = data;
  const toast = useToast();
  const [renaming, setRenaming] = useState(null); // { from, to }

  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= events.length) return;
    const order = [...events];
    [order[i], order[j]] = [order[j], order[i]];
    actions.saveEventOrder(order).catch((err) => toast(err.message, 'error'));
  };

  const rename = async () => {
    const { from, to } = renaming;
    if (!to.trim() || to.trim() === from) return setRenaming(null);
    if (!confirm(`Rename "${from}" to "${to.trim()}" for every guest? Their replies are kept.`)) return;
    try { await actions.renameEvent(from, to); toast('Event renamed.'); setRenaming(null); }
    catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
      <PageHeader
        title="Events"
        description="The order here is the order guests see on their RSVP form and the order of columns in Guests. Events are created by inviting a guest to them (Add household, or a guest's edit screen)."
      />
      {events.length === 0 ? (
        <Card><EmptyState icon={CalendarDays} title="No events yet">Add a household and type an event name (e.g. Sangeet, Ceremony, Reception) to create one.</EmptyState></Card>
      ) : (
        <Card className="max-w-3xl">
          <div className="px-4 py-3 border-b border-[#efeae2] flex justify-end"><StatusLegend /></div>
          <ol className="divide-y divide-[#f3efe8]">
            {events.map((e, i) => {
              const c = { yes: 0, no: 0, pending: 0 };
              guests.forEach((g) => { const s = statusOf(g, e); if (s !== 'not_invited') c[s]++; });
              const invited = c.yes + c.no + c.pending;
              const isRenaming = renaming?.from === e;
              return (
                <li key={e} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 h-6 rounded-full bg-[#f1ede6] text-[11px] font-semibold text-[#6f6a75] flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus className={`${inputCls} h-8`} value={renaming.to}
                          onChange={(ev) => setRenaming({ ...renaming, to: ev.target.value })}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') rename(); if (ev.key === 'Escape') setRenaming(null); }} />
                        <IconButton label="Save name" onClick={rename}><Check className="w-4 h-4" /></IconButton>
                        <IconButton label="Cancel" onClick={() => setRenaming(null)}><X className="w-4 h-4" /></IconButton>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-sm text-[#2b2830] truncate">{e}</p>
                        <IconButton label={`Rename ${e}`} className="w-7 h-7" onClick={() => setRenaming({ from: e, to: e })}><Pencil className="w-3 h-3" /></IconButton>
                      </div>
                    )}
                    <p className="text-xs text-[#8b8590] tabular-nums mb-1.5">{invited} invited · {c.yes} attending · {c.no} declined · {c.pending} waiting</p>
                    <StackedBar counts={c} height={6} />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-0.5 shrink-0">
                    <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></IconButton>
                    <IconButton label="Move down" disabled={i === events.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></IconButton>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </>
  );
}
