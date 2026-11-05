import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Pencil, UserPlus, Users } from 'lucide-react';
import { Button, Card, EmptyState, IconButton, PageHeader, SearchInput, StatusSelect, inputCls, cx, useToast } from '../ui.jsx';
import { statusOf } from '../useGuestData.js';

const SORTS = { name: 'Name', household: 'Household', age: 'Age' };

export default function Guests({ data, initial = {}, onAddHousehold, onEditGuest }) {
  const { guests, events, actions } = data;
  const toast = useToast();
  const [q, setQ] = useState('');
  const [eventFilter, setEventFilter] = useState(initial.event || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState({ key: 'household', dir: 1 });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = guests.filter((g) => !term
      || g.name?.toLowerCase().includes(term)
      || g.household?.toLowerCase().includes(term)
      || String(g.householdId || '').toLowerCase().includes(term));
    if (eventFilter) {
      list = list.filter((g) => (statusFilter ? statusOf(g, eventFilter) === statusFilter : g.events?.includes(eventFilter)));
    } else if (statusFilter) {
      list = list.filter((g) => (g.events || []).some((e) => statusOf(g, e) === statusFilter));
    }
    const key = (g) => {
      if (sort.key === 'name') return (g.name || '').toLowerCase();
      if (sort.key === 'age') return g.ageRange || 'Adult';
      return `${(g.household || '').toLowerCase()}|${String(g.householdId).padStart(8, '0')}|${(g.name || '').toLowerCase()}`;
    };
    return [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * sort.dir);
  }, [guests, q, eventFilter, statusFilter, sort]);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const sortIcon = (k) => (sort.key !== k ? <ArrowUpDown className="w-3 h-3 opacity-40" /> : sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />);
  const change = (g, e, s) => actions.setStatus(g, e, s).catch((err) => toast(`Couldn't save: ${err.message}`, 'error'));
  const filtered = q || eventFilter || statusFilter;

  return (
    <>
      <PageHeader
        title="Guests"
        description="Everyone on the list, and their reply to each event. Change a reply by clicking it."
        actions={<>
          <Button onClick={() => actions.exportCsv(rows)}><Download className="w-4 h-4" /> Export{filtered ? ' filtered' : ''}</Button>
          <Button variant="primary" onClick={onAddHousehold}><UserPlus className="w-4 h-4" /> Add household</Button>
        </>}
      />

      <Card>
        <div className="p-3 border-b border-[#efeae2] flex flex-col md:flex-row gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name or household" className="md:w-72" />
          <select className={cx(inputCls, 'md:w-48')} value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label="Filter by event">
            <option value="">All events</option>
            {events.map((e) => <option key={e} value={e}>Invited to {e}</option>)}
          </select>
          <select className={cx(inputCls, 'md:w-44')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by reply">
            <option value="">Any reply</option>
            <option value="yes">Attending</option>
            <option value="no">Declined</option>
            <option value="pending">Awaiting reply</option>
          </select>
          <p className="md:ml-auto self-center text-xs text-[#8b8590] tabular-nums px-1">{rows.length} of {guests.length} guests</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title={guests.length ? 'No guests match' : 'No guests yet'}>
            {guests.length ? 'Try a different search or filter.' : 'Add a household or import a CSV from the Overview page.'}
          </EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-auto max-h-[calc(100vh-260px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#fbfaf7] text-left text-xs text-[#6f6a75]">
                  <tr className="border-b border-[#efeae2]">
                    {Object.entries(SORTS).map(([k, label]) => (
                      <th key={k} className="font-medium px-4 py-2.5">
                        <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-[#2b2830]">{label} {sortIcon(k)}</button>
                      </th>
                    ))}
                    {events.map((e) => <th key={e} className="font-medium px-3 py-2.5 whitespace-nowrap">{e}</th>)}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3efe8]">
                  {rows.map((g) => (
                    <tr key={g.id} className="hover:bg-[#fbfaf7] group">
                      <td className="px-4 py-2.5">
                        <button onClick={() => onEditGuest(g)} className="font-medium text-[#2b2830] hover:text-[#6c5d84] text-left">{g.name}</button>
                      </td>
                      <td className="px-4 py-2.5 text-[#4b4652]">
                        {g.household}<span className="text-xs text-[#a39d94] ml-1.5">#{g.householdId}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[#6f6a75]">{g.ageRange || 'Adult'}</td>
                      {events.map((e) => (
                        <td key={e} className="px-3 py-2"><StatusSelect status={statusOf(g, e)} onChange={(s) => change(g, e, s)} /></td>
                      ))}
                      <td className="px-2"><IconButton label={`Edit ${g.name}`} className="opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => onEditGuest(g)}><Pencil className="w-3.5 h-3.5" /></IconButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone list */}
            <ul className="md:hidden divide-y divide-[#f3efe8]">
              {rows.map((g) => (
                <li key={g.id} className="p-3">
                  <button onClick={() => onEditGuest(g)} className="w-full text-left">
                    <p className="font-medium text-sm text-[#2b2830]">{g.name}</p>
                    <p className="text-xs text-[#8b8590]">{g.household} · #{g.householdId} · {g.ageRange || 'Adult'}</p>
                  </button>
                  <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
                    {events.map((e) => (
                      <div key={e} className="contents">
                        <span className="text-xs text-[#6f6a75]">{e}</span>
                        <span><StatusSelect status={statusOf(g, e)} onChange={(s) => change(g, e, s)} /></span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
