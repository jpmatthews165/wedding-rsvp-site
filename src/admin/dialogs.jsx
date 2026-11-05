import { useState } from 'react';
import { Mail, MapPin, Phone, Plus, Trash2, UserPlus } from 'lucide-react';
import { Button, Field, IconButton, Modal, StatusSelect, inputCls, useToast } from './ui.jsx';
import { AGE_RANGES, statusOf } from './useGuestData.js';

const blankMember = (events) => ({ name: '', ageRange: 'Adult', events: events.length ? [events[0]] : [] });

function EventChecks({ events, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {events.map((e) => {
        const on = value.includes(e);
        return (
          <button key={e} type="button" onClick={() => onChange(on ? value.filter((x) => x !== e) : [...value, e])}
            className={`h-7 px-2.5 rounded-full text-xs border transition-colors ${on ? 'bg-[#6c5d84] text-white border-[#6c5d84]' : 'bg-white text-[#4b4652] border-[#e0d9cd] hover:border-[#bdb5a8]'}`}>
            {e}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------- Add household
export function AddHouseholdDialog({ data, onClose }) {
  const { actions, events } = data;
  const toast = useToast();
  const [form, setForm] = useState(() => ({ householdId: actions.generateHouseholdId(), name: '', email: '', phone: '', address: '' }));
  const [extraEvents, setExtraEvents] = useState([]);
  const [newEvent, setNewEvent] = useState('');
  const allEvents = [...events, ...extraEvents];
  const [members, setMembers] = useState([blankMember(events)]);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setMember = (i, patch) => setMembers(members.map((m, k) => (k === i ? { ...m, ...patch } : m)));

  const save = async () => {
    if (!form.name.trim()) return toast('Give the household a name.', 'error');
    if (members.some((m) => !m.name.trim())) return toast('Every guest needs a name.', 'error');
    setSaving(true);
    try {
      await actions.addHousehold({ ...form, members });
      toast(`Added ${form.name.trim()}.`);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal wide title="Add household" description="A household is everyone who RSVPs together, like a couple or a family." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add household'}</Button></>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_120px] gap-3">
          <Field label="Household name"><input autoFocus className={inputCls} placeholder="e.g. The Smith Family" value={form.name} onChange={set('name')} /></Field>
          <Field label="Household #"><input className={inputCls} value={form.householdId} onChange={set('householdId')} /></Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>
          <Field label="Phone"><input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <Field label="Mailing address"><input className={inputCls} value={form.address} onChange={set('address')} /></Field>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-[#4b4652]">Guests</p>
            <div className="flex items-center gap-1.5">
              <input className={`${inputCls} h-8 w-36 text-xs`} placeholder="New event name" value={newEvent} onChange={(e) => setNewEvent(e.target.value)} />
              <Button size="sm" onClick={() => { const n = newEvent.trim(); if (n && !allEvents.includes(n)) { setExtraEvents([...extraEvents, n]); setNewEvent(''); } }}>Add event</Button>
            </div>
          </div>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="rounded-lg border border-[#e8e2d8] p-3 space-y-2.5">
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="Full name" value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} />
                  <select className={`${inputCls} w-28`} value={m.ageRange} onChange={(e) => setMember(i, { ageRange: e.target.value })}>
                    {AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                  <IconButton label="Remove guest" disabled={members.length === 1} onClick={() => setMembers(members.filter((_, k) => k !== i))}><Trash2 className="w-4 h-4" /></IconButton>
                </div>
                {allEvents.length > 0
                  ? <EventChecks events={allEvents} value={m.events} onChange={(ev) => setMember(i, { events: ev })} />
                  : <p className="text-xs text-[#8b8590]">Add an event above to invite this guest to it.</p>}
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setMembers([...members, blankMember(allEvents)])}><Plus className="w-3.5 h-3.5" /> Add another guest</Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- Edit guest
export function GuestDialog({ guest, data, onClose }) {
  const { actions, events, households } = data;
  const toast = useToast();
  const [form, setForm] = useState({ name: guest.name || '', householdId: guest.householdId, ageRange: guest.ageRange || 'Adult' });
  const [saving, setSaving] = useState(false);
  // Status changes save immediately; read live values from the latest guest data.
  const live = data.guests.find((g) => g.id === guest.id) || guest;

  const save = async () => {
    if (!form.name.trim()) return toast('Name can’t be empty.', 'error');
    setSaving(true);
    try {
      await actions.saveGuest(guest.id, form);
      toast('Guest saved.');
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!confirm(`Delete ${guest.name}? This removes them and their RSVP answers.`)) return;
    try { await actions.deleteGuest(guest.id); toast(`Deleted ${guest.name}.`); onClose(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <Modal title="Edit guest" onClose={onClose}
      footer={<>
        <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 className="w-4 h-4" /> Delete</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </>}>
      <div className="space-y-4">
        <Field label="Full name"><input autoFocus className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Household">
            <select className={inputCls} value={form.householdId} onChange={(e) => setForm({ ...form, householdId: e.target.value })}>
              {[...households].sort((a, b) => a.name.localeCompare(b.name)).map((h) => <option key={h.id} value={h.householdId}>{h.name} (#{h.householdId})</option>)}
            </select>
          </Field>
          <Field label="Age">
            <select className={inputCls} value={form.ageRange} onChange={(e) => setForm({ ...form, ageRange: e.target.value })}>
              {AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>
        </div>
        <div>
          <p className="text-xs font-medium text-[#4b4652] mb-2">Events & replies <span className="font-normal text-[#8b8590]">· saved as you change them</span></p>
          <div className="rounded-lg border border-[#e8e2d8] divide-y divide-[#f1ede6]">
            {events.map((e) => (
              <div key={e} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-[#2b2830]">{e}</span>
                <StatusSelect status={statusOf(live, e)} onChange={(s) => actions.setStatus(live, e, s).catch((err) => toast(err.message, 'error'))} />
              </div>
            ))}
            {events.length === 0 && <p className="px-3 py-2 text-sm text-[#8b8590]">No events yet.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- Edit household
export function HouseholdDialog({ household, data, onClose, onEditGuest }) {
  const { actions, events, membersOf } = data;
  const toast = useToast();
  const [form, setForm] = useState({ name: household.name || '', email: household.email || '', phone: household.phone || '', address: household.address || '' });
  const [newGuest, setNewGuest] = useState(null);
  const [saving, setSaving] = useState(false);
  const members = membersOf(household.householdId);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.name.trim()) return toast('Household name can’t be empty.', 'error');
    setSaving(true);
    try { await actions.saveHousehold(household, form); toast('Household saved.'); onClose(); }
    catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };
  const addGuest = async () => {
    if (!newGuest.name.trim()) return;
    try { await actions.addGuest(household.householdId, newGuest); setNewGuest(null); toast(`Added ${newGuest.name.trim()}.`); }
    catch (err) { toast(err.message, 'error'); }
  };
  const remove = async () => {
    if (!confirm(`Delete the household "${household.name}"?`)) return;
    try { await actions.deleteHousehold(household); toast('Household deleted.'); onClose(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <Modal wide title={household.name} description={`Household #${household.householdId}`} onClose={onClose}
      footer={<>
        {members.length === 0 && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 className="w-4 h-4" /> Delete household</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </>}>
      <div className="space-y-4">
        <Field label="Household name"><input className={inputCls} value={form.name} onChange={set('name')} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={<span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>}><input type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>
          <Field label={<span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</span>}><input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <Field label={<span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Mailing address</span>}><input className={inputCls} value={form.address} onChange={set('address')} /></Field>

        <div className="pt-1">
          <p className="text-xs font-medium text-[#4b4652] mb-2">Guests in this household</p>
          <div className="rounded-lg border border-[#e8e2d8] divide-y divide-[#f1ede6]">
            {members.map((g) => (
              <button key={g.id} type="button" onClick={() => onEditGuest(g)} className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#fbfaf7]">
                <span className="text-sm text-[#2b2830]">{g.name} <span className="text-xs text-[#8b8590]">· {g.ageRange || 'Adult'}</span></span>
                <span className="text-xs text-[#8b8590]">{(g.events || []).length} event{(g.events || []).length === 1 ? '' : 's'} · Edit</span>
              </button>
            ))}
            {members.length === 0 && <p className="px-3 py-2 text-sm text-[#8b8590]">No guests yet.</p>}
          </div>
          {newGuest ? (
            <div className="mt-2 rounded-lg border border-[#e8e2d8] p-3 space-y-2.5">
              <div className="flex gap-2">
                <input autoFocus className={inputCls} placeholder="Full name" value={newGuest.name} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} />
                <select className={`${inputCls} w-28`} value={newGuest.ageRange} onChange={(e) => setNewGuest({ ...newGuest, ageRange: e.target.value })}>
                  {AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <EventChecks events={events} value={newGuest.events} onChange={(ev) => setNewGuest({ ...newGuest, events: ev })} />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => setNewGuest(null)}>Cancel</Button>
                <Button size="sm" variant="primary" onClick={addGuest}>Add guest</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewGuest(blankMember(events))}><UserPlus className="w-3.5 h-3.5" /> Add a guest</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
