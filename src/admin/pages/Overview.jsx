import { useMemo, useRef } from 'react';
import { CalendarDays, Download, Home, Mail, Phone, Upload, UserPlus, Users } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, StatusPill, useToast } from '../ui.jsx';
import { StackedBar, StatusLegend } from '../charts.jsx';
import { statusOf } from '../useGuestData.js';

const fmtAgo = (date) => {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function Stat({ label, value, sub, icon: Icon }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#6f6a75]">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-[#b5aec2]" />}
      </div>
      <p className="text-2xl font-semibold text-[#2b2830] mt-2 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-[#8b8590] mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function Overview({ data, onAddHousehold, go }) {
  const { guests, households, events, actions, membersOf } = data;
  const toast = useToast();
  const fileRef = useRef(null);

  const stats = useMemo(() => {
    const invited = guests.filter((g) => g.events?.length);
    const attending = invited.filter((g) => g.events.some((e) => g.rsvps?.[e] === 'yes'));
    const waiting = invited.filter((g) => g.events.some((e) => statusOf(g, e) === 'pending'));
    const responded = invited.length - waiting.length;
    const perEvent = events.map((e) => {
      const c = { yes: 0, no: 0, pending: 0 };
      const ages = {};
      guests.forEach((g) => {
        const s = statusOf(g, e);
        if (s === 'not_invited') return;
        c[s]++;
        if (s === 'yes') ages[g.ageRange || 'Adult'] = (ages[g.ageRange || 'Adult'] || 0) + 1;
      });
      return { event: e, counts: c, invited: c.yes + c.no + c.pending, ages };
    });
    const recent = guests
      .filter((g) => g.rsvpUpdatedAt?.toDate)
      .sort((a, b) => b.rsvpUpdatedAt.toDate() - a.rsvpUpdatedAt.toDate())
      .slice(0, 6);
    const notReplied = households.filter((h) => {
      const m = membersOf(h.householdId).filter((g) => g.events?.length);
      return m.length && m.every((g) => g.events.every((e) => statusOf(g, e) === 'pending'));
    });
    return { invited, attending, waiting, responded, perEvent, recent, notReplied };
  }, [guests, households, events, membersOf]);

  const pct = stats.invited.length ? Math.round((stats.responded / stats.invited.length) * 100) : 0;

  const onImport = async (file) => {
    if (!file) return;
    try {
      const { count, skipped } = await actions.importCsv(file);
      toast(`Imported ${count} guest${count === 1 ? '' : 's'}.${skipped.length ? `\nSkipped:\n${skipped.join('\n')}` : ''}`);
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Overview"
        description="How replies are coming in, at a glance."
        actions={<>
          <Button onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" /> Import CSV</Button>
          <Button onClick={() => actions.exportCsv()}><Download className="w-4 h-4" /> Export</Button>
          <Button variant="primary" onClick={onAddHousehold}><UserPlus className="w-4 h-4" /> Add household</Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
        </>}
      />

      {guests.length === 0 ? (
        <Card><EmptyState icon={Users} title="No guests yet">Add a household or import your guest list from a CSV file (columns: Name, Household, Events; optional Household #, Age Range, Email, Phone, Address).</EmptyState></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Guests invited" value={stats.invited.length} sub={`${households.length} households`} icon={Users} />
            <Stat label="Replied" value={`${pct}%`} sub={`${stats.responded} of ${stats.invited.length} guests`} icon={CalendarDays} />
            <Stat label="Attending something" value={stats.attending.length} sub="said yes to at least one event" icon={Home} />
            <Stat label="Still waiting" value={stats.waiting.length} sub="guests with an open invite" icon={Mail} />
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <h2 className="text-sm font-semibold text-[#2b2830]">Replies by event</h2>
              <StatusLegend />
            </div>
            <div className="space-y-5">
              {stats.perEvent.map(({ event, counts, invited, ages }) => (
                <div key={event}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <button onClick={() => go('guests', { event })} className="text-sm font-medium text-[#2b2830] hover:text-[#6c5d84]">{event}</button>
                    <p className="text-xs text-[#6f6a75] tabular-nums">
                      <span className="font-semibold text-[#2b2830]">{counts.yes}</span> attending · {counts.no} declined · {counts.pending} waiting · {invited} invited
                    </p>
                  </div>
                  <StackedBar counts={counts} />
                  {Object.keys(ages).length > 1 && (
                    <p className="text-[11px] text-[#8b8590] mt-1.5">Attending: {Object.entries(ages).map(([a, n]) => `${n} ${a.toLowerCase()}${n === 1 ? '' : a === 'Child' ? 'ren' : 's'}`).join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-[#2b2830] mb-3">Latest replies</h2>
              {stats.recent.length === 0 ? (
                <p className="text-sm text-[#8b8590]">Replies from the website will show up here.</p>
              ) : (
                <ul className="divide-y divide-[#f1ede6]">
                  {stats.recent.map((g) => (
                    <li key={g.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-[#2b2830] truncate">{g.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {g.events.map((e) => <span key={e} className="inline-flex items-center gap-1 text-[11px] text-[#6f6a75]">{e}: <StatusPill status={statusOf(g, e)} compact /></span>)}
                        </div>
                      </div>
                      <span className="text-xs text-[#8b8590] shrink-0">{fmtAgo(g.rsvpUpdatedAt.toDate())}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#2b2830]">Households that haven't replied</h2>
                <span className="text-xs text-[#8b8590] tabular-nums">{stats.notReplied.length}</span>
              </div>
              {stats.notReplied.length === 0 ? (
                <p className="text-sm text-[#8b8590]">Everyone has replied to at least one event.</p>
              ) : (
                <>
                  <ul className="divide-y divide-[#f1ede6]">
                    {stats.notReplied.slice(0, 6).map((h) => (
                      <li key={h.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-[#2b2830] truncate">{h.name}</p>
                          <p className="text-xs text-[#8b8590]">#{h.householdId} · {membersOf(h.householdId).length} guests</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {h.email && <a href={`mailto:${h.email}`} title={h.email} className="p-2 rounded-lg text-[#6f6a75] hover:bg-[#efeae2]"><Mail className="w-4 h-4" /></a>}
                          {h.phone && <a href={`tel:${h.phone}`} title={h.phone} className="p-2 rounded-lg text-[#6f6a75] hover:bg-[#efeae2]"><Phone className="w-4 h-4" /></a>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {stats.notReplied.length > 6 && (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => go('households', { filter: 'not_replied' })}>See all {stats.notReplied.length}</Button>
                  )}
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

