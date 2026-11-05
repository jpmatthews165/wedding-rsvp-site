import { useMemo, useState } from 'react';
import { Copy, Download, Home, Mail, MapPin, Pencil, Phone, UserPlus } from 'lucide-react';
import { Button, Card, EmptyState, IconButton, PageHeader, SearchInput, StatusPill, cx, useToast } from '../ui.jsx';
import { statusOf } from '../useGuestData.js';

const FILTERS = [
  ['', 'All'],
  ['not_replied', 'Haven’t replied'],
  ['no_email', 'Missing email'],
  ['no_phone', 'Missing phone'],
  ['no_address', 'Missing address'],
];

// Overall reply for a household: attending if anyone said yes, declined if all
// invites were declined, otherwise awaiting.
const householdStatus = (members) => {
  const all = members.flatMap((g) => (g.events || []).map((e) => statusOf(g, e)));
  if (!all.length) return null;
  if (all.includes('yes')) return 'yes';
  if (all.every((s) => s === 'no')) return 'no';
  return 'pending';
};

function ContactLine({ icon: Icon, value, href, missing }) {
  const toast = useToast();
  if (!value) return <p className="flex items-center gap-2 text-xs text-[#b9b2a7]"><Icon className="w-3.5 h-3.5" /> {missing}</p>;
  return (
    <div className="group/line flex items-center gap-2 text-sm text-[#4b4652] min-w-0">
      <Icon className="w-3.5 h-3.5 text-[#a39d94] shrink-0" />
      {href ? <a href={href} className="truncate hover:text-[#6c5d84] hover:underline">{value}</a> : <span className="truncate">{value}</span>}
      <button type="button" title="Copy" onClick={() => navigator.clipboard?.writeText(value).then(() => toast('Copied.'))}
        className="opacity-0 group-hover/line:opacity-100 focus:opacity-100 p-0.5 text-[#a39d94] hover:text-[#2b2830]"><Copy className="w-3 h-3" /></button>
    </div>
  );
}

export default function Households({ data, initial = {}, onAddHousehold, onEditHousehold }) {
  const { households, membersOf, actions } = data;
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(initial.filter || '');

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return households
      .map((h) => ({ h, members: membersOf(h.householdId) }))
      .map((r) => ({ ...r, status: householdStatus(r.members) }))
      .filter(({ h, members }) => !term
        || h.name?.toLowerCase().includes(term)
        || String(h.householdId).includes(term)
        || h.email?.toLowerCase().includes(term)
        || members.some((g) => g.name?.toLowerCase().includes(term)))
      .filter(({ h, members, status }) => {
        if (filter === 'not_replied') return status === 'pending' && members.every((g) => (g.events || []).every((e) => statusOf(g, e) === 'pending'));
        if (filter === 'no_email') return !h.email;
        if (filter === 'no_phone') return !h.phone;
        if (filter === 'no_address') return !h.address;
        return true;
      })
      .sort((a, b) => (a.h.name || '').localeCompare(b.h.name || ''));
  }, [households, membersOf, q, filter]);

  const emails = rows.map((r) => r.h.email).filter(Boolean);

  return (
    <>
      <PageHeader
        title="Households"
        description="Your contact list: who's in each household and how to reach them."
        actions={<>
          <Button disabled={!emails.length} onClick={() => navigator.clipboard?.writeText(emails.join(', ')).then(() => toast(`Copied ${emails.length} email address${emails.length === 1 ? '' : 'es'}.`))}>
            <Copy className="w-4 h-4" /> Copy emails
          </Button>
          <Button onClick={() => actions.exportContacts(rows.map((r) => r.h))}><Download className="w-4 h-4" /> Export contacts</Button>
          <Button variant="primary" onClick={onAddHousehold}><UserPlus className="w-4 h-4" /> Add household</Button>
        </>}
      />

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search households, guests or emails" className="md:w-80" />
        <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={cx('h-9 px-3 rounded-lg text-sm whitespace-nowrap border', filter === k ? 'bg-[#2b2830] text-white border-[#2b2830]' : 'bg-white text-[#4b4652] border-[#e0d9cd] hover:bg-[#f6f3ee]')}>
              {label}
            </button>
          ))}
        </div>
        <p className="md:ml-auto self-center text-xs text-[#8b8590] tabular-nums">{rows.length} of {households.length}</p>
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={Home} title={households.length ? 'No households match' : 'No households yet'}>{households.length ? 'Try another search or filter.' : 'Add your first household to get started.'}</EmptyState></Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map(({ h, members, status }) => (
            <Card key={h.id} className="p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-[#2b2830] truncate">{h.name}</p>
                  <p className="text-xs text-[#a39d94]">#{h.householdId} · {members.length} guest{members.length === 1 ? '' : 's'}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {status && <StatusPill status={status} />}
                  <IconButton label={`Edit ${h.name}`} onClick={() => onEditHousehold(h)}><Pencil className="w-3.5 h-3.5" /></IconButton>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {members.map((g) => (
                  <span key={g.id} className="inline-flex items-center rounded-md bg-[#f4f0e9] px-2 py-0.5 text-xs text-[#4b4652]">{g.name}</span>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#f1ede6] space-y-1.5">
                <ContactLine icon={Mail} value={h.email} href={h.email && `mailto:${h.email}`} missing="No email" />
                <ContactLine icon={Phone} value={h.phone} href={h.phone && `tel:${h.phone}`} missing="No phone" />
                <ContactLine icon={MapPin} value={h.address} missing="No mailing address" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
