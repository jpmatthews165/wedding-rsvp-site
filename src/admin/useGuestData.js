import { useCallback, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { collection, deleteDoc, deleteField, doc, FieldPath, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { sortEventsByConfig, useEventOrder } from '../lib/eventOrder.js';

// ---------------------------------------------------------------- helpers

// 'yes' | 'no' | 'pending' | 'not_invited'
export const statusOf = (guest, event) => {
  if (!guest.events?.includes(event)) return 'not_invited';
  return guest.rsvps?.[event] || 'pending';
};

export const AGE_RANGES = ['Adult', 'Child', 'Infant'];

// Firestore allows at most 500 writes per batch; commit large imports in chunks.
const commitInChunks = async (ops) => {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach((op) => op(batch));
    await batch.commit();
  }
};

const downloadCsv = (rows, filename) => {
  const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---------------------------------------------------------------- hook

// Live guests/households/events plus every admin action. Only subscribes when
// `enabled` (a signed-in admin) — Firestore rules block everyone else anyway.
export default function useGuestData(enabled) {
  const [guests, setGuests] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [loaded, setLoaded] = useState({ guests: false, households: false });
  const [error, setError] = useState('');
  const [eventOrder, setEventOrder] = useEventOrder();

  useEffect(() => {
    if (!enabled) return;
    const onErr = (err) => setError(`Could not load guest data: ${err.message}`);
    const u1 = onSnapshot(collection(db, 'guests'), (s) => {
      setGuests(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoaded((l) => ({ ...l, guests: true }));
    }, onErr);
    const u2 = onSnapshot(collection(db, 'households'), (s) => {
      setHouseholds(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoaded((l) => ({ ...l, households: true }));
    }, onErr);
    return () => { u1(); u2(); };
  }, [enabled]);

  const events = useMemo(
    () => sortEventsByConfig([...new Set(guests.flatMap((g) => g.events || []))], eventOrder),
    [guests, eventOrder]
  );

  const householdById = useMemo(() => Object.fromEntries(households.map((h) => [h.householdId, h])), [households]);
  const membersOf = useCallback((householdId) => guests.filter((g) => g.householdId === householdId), [guests]);

  // ---- guests
  const setStatus = useCallback(async (guest, event, status) => {
    const events = status === 'not_invited'
      ? (guest.events || []).filter((e) => e !== event)
      : [...new Set([...(guest.events || []), event])];
    const value = status === 'not_invited' || status === 'pending' ? deleteField() : status;
    // FieldPath (not a dotted string) so event names containing "." still work.
    await updateDoc(doc(db, 'guests', guest.id), 'events', events, new FieldPath('rsvps', event), value);
  }, []);

  const saveGuest = useCallback(async (guestId, { name, householdId, ageRange }) => {
    await updateDoc(doc(db, 'guests', guestId), {
      name: name.trim(),
      householdId,
      household: householdById[householdId]?.name || 'Unassigned',
      ageRange,
    });
  }, [householdById]);

  const deleteGuest = useCallback((guestId) => deleteDoc(doc(db, 'guests', guestId)), []);

  const addGuest = useCallback(async (householdId, { name, ageRange = 'Adult', events = [] }) => {
    await setDoc(doc(collection(db, 'guests')), {
      name: name.trim(), household: householdById[householdId]?.name || '', householdId, ageRange, events, rsvps: {},
    });
  }, [householdById]);

  // ---- households
  const generateHouseholdId = useCallback(() => {
    const taken = new Set(households.map((h) => h.householdId));
    let id;
    do { id = Math.floor(1000 + Math.random() * 9000).toString(); } while (taken.has(id));
    return id;
  }, [households]);

  const saveHousehold = useCallback(async (hh, data) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'households', hh.id), {
      name: data.name.trim(), email: data.email.trim(), phone: data.phone.trim(), address: data.address.trim(),
    });
    if (data.name.trim() !== hh.name) {
      guests.filter((g) => g.householdId === hh.householdId)
        .forEach((g) => batch.update(doc(db, 'guests', g.id), { household: data.name.trim() }));
    }
    await batch.commit();
  }, [guests]);

  const addHousehold = useCallback(async ({ householdId, name, email = '', phone = '', address = '', members }) => {
    const id = householdId.trim();
    if (!id || id.includes('/')) throw new Error('Household # is required and cannot contain "/".');
    if (households.some((h) => h.householdId === id)) throw new Error(`Household #${id} already exists.`);
    const batch = writeBatch(db);
    batch.set(doc(db, 'households', id), { householdId: id, name: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim() });
    members.forEach((m) => batch.set(doc(collection(db, 'guests')), {
      name: m.name.trim(), household: name.trim(), householdId: id, ageRange: m.ageRange, events: m.events, rsvps: {},
    }));
    await batch.commit();
  }, [households]);

  const deleteHousehold = useCallback(async (hh) => {
    if (guests.some((g) => g.householdId === hh.householdId)) throw new Error('Remove or move its guests first.');
    await deleteDoc(doc(db, 'households', hh.id));
  }, [guests]);

  // ---- events
  const saveEventOrder = useCallback(async (order) => {
    setEventOrder(order);
    await setDoc(doc(db, 'settings', 'events'), { order }, { merge: true });
  }, [setEventOrder]);

  // Renames an event on every guest (invites and RSVP answers) and in the saved order.
  const renameEvent = useCallback(async (oldName, newName) => {
    const name = newName.trim();
    if (!name || name === oldName) return;
    if (events.includes(name)) throw new Error(`"${name}" already exists.`);
    const ops = guests.filter((g) => g.events?.includes(oldName)).map((g) => (batch) => {
      const args = ['events', g.events.map((e) => (e === oldName ? name : e))];
      if (g.rsvps?.[oldName]) args.push(new FieldPath('rsvps', name), g.rsvps[oldName]);
      args.push(new FieldPath('rsvps', oldName), deleteField());
      batch.update(doc(db, 'guests', g.id), ...args);
    });
    await commitInChunks(ops);
    await saveEventOrder(events.map((e) => (e === oldName ? name : e)));
  }, [events, guests, saveEventOrder]);

  // ---- CSV
  const importCsv = useCallback((file) => new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      error: reject,
      complete: async (results) => {
        const ops = [];
        const skipped = [];
        let count = 0;
        results.data.forEach((row, i) => {
          const rowName = (row.Name || '').trim();
          const rowHousehold = (row.Household || '').trim();
          if (!rowName || !rowHousehold) return;
          const eventsArray = row.Events ? row.Events.split(',').map((e) => e.trim()).filter(Boolean) : [];
          const hhId = (row['Household #'] || '').trim() || rowHousehold;
          if (hhId.includes('/')) { skipped.push(`Row ${i + 2} (${rowName}): "/" not allowed in household`); return; }

          ops.push((b) => b.set(doc(db, 'households', hhId), {
            householdId: hhId, name: rowHousehold, email: row.Email || '', phone: row.Phone || '', address: row.Address || '',
          }, { merge: true }));

          const rsvps = {};
          Object.keys(row).forEach((key) => {
            if (!key.startsWith('RSVP: ')) return;
            const val = (row[key] || '').trim().toLowerCase();
            if (val === 'yes' || val === 'no') rsvps[key.replace('RSVP: ', '').trim()] = val;
          });

          const existing = guests.find((g) => (g.name || '').toLowerCase() === rowName.toLowerCase() && g.householdId === hhId);
          if (existing) {
            ops.push((b) => b.update(doc(db, 'guests', existing.id), {
              household: rowHousehold, ageRange: row['Age Range'] || existing.ageRange || 'Adult',
              events: eventsArray, rsvps: { ...(existing.rsvps || {}), ...rsvps },
            }));
          } else {
            ops.push((b) => b.set(doc(collection(db, 'guests')), {
              name: rowName, household: rowHousehold, householdId: hhId,
              ageRange: row['Age Range'] || 'Adult', events: eventsArray, rsvps,
            }));
          }
          count++;
        });
        try {
          await commitInChunks(ops);
          resolve({ count, skipped });
        } catch (err) { reject(err); }
      },
    });
  }), [guests]);

  const exportCsv = useCallback((list = guests) => {
    const rows = list.map((g) => {
      const hh = householdById[g.householdId];
      const row = {
        Name: g.name, Household: g.household, 'Household #': g.householdId,
        Email: hh?.email || '', Phone: hh?.phone || '', Address: hh?.address || '',
        'Age Range': g.ageRange || '', Events: (g.events || []).join(', '),
      };
      events.forEach((e) => {
        const s = statusOf(g, e);
        row[`RSVP: ${e}`] = s === 'not_invited' ? 'Not Invited' : s === 'pending' ? 'Pending' : s;
      });
      return row;
    });
    downloadCsv(rows, 'wedding_guests.csv');
  }, [guests, householdById, events]);

  const exportContacts = useCallback((list = households) => {
    downloadCsv(list.map((h) => ({
      Household: h.name, 'Household #': h.householdId, Email: h.email || '', Phone: h.phone || '', Address: h.address || '',
      Guests: guests.filter((g) => g.householdId === h.householdId).map((g) => g.name).join(', '),
    })), 'wedding_contacts.csv');
  }, [households, guests]);

  return {
    guests, households, events, eventOrder, householdById, membersOf,
    loading: enabled && !(loaded.guests && loaded.households), error,
    actions: {
      setStatus, saveGuest, deleteGuest, addGuest, generateHouseholdId, saveHousehold, addHousehold,
      deleteHousehold, saveEventOrder, renameEvent, importCsv, exportCsv, exportContacts,
    },
  };
}
