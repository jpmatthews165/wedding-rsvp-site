import { useState, useEffect, useMemo } from 'react';
import { Search, X, Lock, Upload, Download, Plus, Trash2, UserPlus, ArrowUpDown, ChevronUp, ChevronDown, Edit2, Check, ArrowUp, ArrowDown, PenLine } from 'lucide-react';
import Papa from 'papaparse';
import { collection, onSnapshot, doc, writeBatch, updateDoc, deleteField, setDoc, FieldPath } from 'firebase/firestore';
import { db } from '../firebase.js';
import { sortEventsByConfig, useEventOrder } from '../lib/eventOrder.js';
import useAdminAuth from './useAdminAuth.js';

// Firestore allows at most 500 writes per batch; commit large imports in chunks.
const commitInChunks = async (ops) => {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach((op) => op(batch));
    await batch.commit();
  }
};

// --------------------------------------------------------
// ADMIN DASHBOARD (/admin) — guests, households, events.
// The website editor lives at /admin/editor (see editor/EditorPage.jsx).
// --------------------------------------------------------
export default function AdminApp() {
  const [guests, setGuests] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [customEventOrder, setCustomEventOrder] = useEventOrder();

  const { user: authUser, ready: authReady, error: authError, setError: setAuthError, isAdmin, signIn: handleGoogleSignIn, signOut: handleSignOut } = useAdminAuth();

  const [dashboardTab, setDashboardTab] = useState('stats');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'householdId', direction: 'asc' });

  const [editingGuestId, setEditingGuestId] = useState(null);
  const [tempGuestData, setTempGuestData] = useState({});

  const [editingHouseholdId, setEditingHouseholdId] = useState(null);
  const [tempHouseholdData, setTempHouseholdData] = useState({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdId, setNewHouseholdId] = useState('');
  const [newHouseholdEmail, setNewHouseholdEmail] = useState('');
  const [newHouseholdPhone, setNewHouseholdPhone] = useState('');
  const [newHouseholdAddress, setNewHouseholdAddress] = useState('');
  const [newCustomEvent, setNewCustomEvent] = useState('');
  const [extraFormEvents, setExtraFormEvents] = useState([]);
  const [newMembers, setNewMembers] = useState([{ name: '', ageRange: 'Adult', events: [] }]);


  // Derived from data instead of stored separately, so they're always in sync.
  const allUniqueEvents = useMemo(
    () => sortEventsByConfig(Array.from(new Set(guests.flatMap(g => g.events || []))), customEventOrder),
    [guests, customEventOrder]
  );
  const formAvailableEvents = useMemo(
    () => sortEventsByConfig(Array.from(new Set([...allUniqueEvents, ...extraFormEvents])), customEventOrder),
    [allUniqueEvents, extraFormEvents, customEventOrder]
  );

  // Full guest list is only loaded for signed-in admins.
  useEffect(() => {
    if (!isAdmin) return;
    const onErr = (err) => setAuthError(`Could not load guest data: ${err.message}`);
    const unsubGuests = onSnapshot(collection(db, 'guests'),
      (snapshot) => setGuests(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), onErr);
    const unsubHouseholds = onSnapshot(collection(db, 'households'),
      (snapshot) => setHouseholds(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), onErr);
    return () => { unsubGuests(); unsubHouseholds(); };
  }, [isAdmin]);

  const handleSaveEventOrder = async (newOrder) => {
    setCustomEventOrder(newOrder);
    await setDoc(doc(db, 'settings', 'events'), { order: newOrder }, { merge: true });
  };

  const moveEvent = (index, direction) => {
    const newOrder = [...allUniqueEvents];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    handleSaveEventOrder(newOrder);
  };


  const generateHouseholdId = () => {
    const taken = new Set(households.map(h => h.householdId));
    let id;
    do { id = Math.floor(1000 + Math.random() * 9000).toString(); } while (taken.has(id));
    return id;
  };

  const handleOpenAddForm = () => {
    setNewHouseholdId(generateHouseholdId());
    setNewHouseholdEmail('');
    setNewHouseholdPhone('');
    setNewHouseholdAddress('');
    setNewMembers([{ name: '', ageRange: 'Adult', events: allUniqueEvents.length > 0 ? [allUniqueEvents[0]] : [] }]);
    setShowAddForm(!showAddForm);
  };

  const handleAddCustomEventToForm = () => {
    const name = newCustomEvent.trim();
    if (name && !formAvailableEvents.includes(name)) {
      setExtraFormEvents(prev => [...prev, name]);
      setNewCustomEvent('');
    }
  };

  const handleAdminEventAndRsvpUpdate = async (guest, eventName, newStatus) => {
    const guestRef = doc(db, 'guests', guest.id);
    // FieldPath (not a dotted string) so event names containing "." still work.
    const rsvpField = new FieldPath('rsvps', eventName);

    const updatedEvents = newStatus === 'not_invited'
      ? (guest.events || []).filter(e => e !== eventName)
      : [...new Set([...(guest.events || []), eventName])];
    const rsvpValue = (newStatus === 'not_invited' || newStatus === 'pending') ? deleteField() : newStatus;

    try {
      await updateDoc(guestRef, 'events', updatedEvents, rsvpField, rsvpValue);
    } catch (err) {
      alert(`Could not save: ${err.message}`);
    }
  };

  const startEditingGuest = (guest) => {
    setEditingGuestId(guest.id);
    setTempGuestData({ name: guest.name, householdId: guest.householdId });
  };

  const saveGuestEdits = async (guestId) => {
    const guestRef = doc(db, 'guests', guestId);
    const targetHh = households.find(h => h.householdId === tempGuestData.householdId);
    
    await updateDoc(guestRef, {
      name: tempGuestData.name,
      householdId: tempGuestData.householdId,
      household: targetHh ? targetHh.name : 'Unassigned'
    });
    setEditingGuestId(null);
  };

  const startEditingHousehold = (hh) => {
    setEditingHouseholdId(hh.id);
    setTempHouseholdData({ name: hh.name, email: hh.email || '', phone: hh.phone || '', address: hh.address || '' });
  };

  const saveHouseholdEdits = async (hhId, oldHouseholdId) => {
    const batch = writeBatch(db);
    const hhRef = doc(db, 'households', hhId);
    
    batch.update(hhRef, {
      name: tempHouseholdData.name,
      email: tempHouseholdData.email,
      phone: tempHouseholdData.phone,
      address: tempHouseholdData.address
    });

    const linkedGuests = guests.filter(g => g.householdId === oldHouseholdId);
    linkedGuests.forEach(g => {
      const gRef = doc(db, 'guests', g.id);
      batch.update(gRef, { household: tempHouseholdData.name });
    });

    await batch.commit();
    setEditingHouseholdId(null);
  };

  const processCsvUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const ops = [];
        const skipped = [];

        results.data.forEach((row, i) => {
          const rowName = (row.Name || '').trim();
          const rowHousehold = (row.Household || '').trim();
          if (!rowName || !rowHousehold) return;
          const eventsArray = row.Events ? row.Events.split(',').map(e => e.trim()).filter(e => e) : [];
          const rowHouseholdId = ((row['Household #'] || '').trim() || rowHousehold);
          if (rowHouseholdId.includes('/')) { skipped.push(`row ${i + 2} (${rowName}): "/" not allowed in household`); return; }
          row = { ...row, Name: rowName, Household: rowHousehold };

          const hhRef = doc(db, 'households', rowHouseholdId);
          ops.push(batch => batch.set(hhRef, {
            householdId: rowHouseholdId,
            name: row.Household,
            email: row['Email'] || '',
            phone: row['Phone'] || '',
            address: row['Address'] || ''
          }, { merge: true }));

          const rsvpsToPreload = {};
          Object.keys(row).forEach(key => {
            if (key.startsWith('RSVP: ')) {
              const eventName = key.replace('RSVP: ', '').trim();
              const val = (row[key] || '').trim().toLowerCase();
              if (val === 'yes' || val === 'no') {
                rsvpsToPreload[eventName] = val;
              }
            }
          });

          const existingGuest = guests.find(g => (g.name || '').toLowerCase() === row.Name.toLowerCase() && g.householdId === rowHouseholdId);

          if (existingGuest) {
            const mergedRsvps = { ...(existingGuest.rsvps || {}), ...rsvpsToPreload };
            const guestRef = doc(db, 'guests', existingGuest.id);
            ops.push(batch => batch.update(guestRef, {
              household: row.Household,
              ageRange: row['Age Range'] || existingGuest.ageRange || 'Adult',
              events: eventsArray,
              rsvps: mergedRsvps
            }));
          } else {
            const newRef = doc(collection(db, 'guests'));
            ops.push(batch => batch.set(newRef, {
              name: row.Name,
              household: row.Household,
              householdId: rowHouseholdId,
              ageRange: row['Age Range'] || 'Adult',
              events: eventsArray,
              rsvps: rsvpsToPreload
            }));
          }
        });

        try {
          await commitInChunks(ops);
          alert(`Guest list and households synced successfully!${skipped.length ? `\n\nSkipped:\n${skipped.join('\n')}` : ''}`);
        } catch (err) {
          alert(`Upload failed: ${err.message}`);
        } finally {
          event.target.value = '';
        }
      }
    });
  };

  const handleAddMemberRow = () => setNewMembers([...newMembers, { name: '', ageRange: 'Adult', events: allUniqueEvents.length > 0 ? [allUniqueEvents[0]] : [] }]);
  const handleRemoveMemberRow = (index) => setNewMembers(newMembers.filter((_, i) => i !== index));

  // Copies the member object instead of mutating state in place.
  const handleUpdateMember = (index, field, value) => {
    setNewMembers(prev => prev.map((m, i) => {
      if (i !== index) return m;
      if (field === 'events') {
        return { ...m, events: m.events.includes(value) ? m.events.filter(e => e !== value) : [...m.events, value] };
      }
      return { ...m, [field]: value };
    }));
  };

  const submitNewHousehold = async () => {
    if (!newHouseholdName.trim() || newMembers.some(m => !m.name.trim()) || !newHouseholdId.trim()) {
      alert("Please ensure the household name, ID, and all guest names are filled out.");
      return;
    }
    if (newHouseholdId.includes('/')) {
      alert('Household # cannot contain "/".');
      return;
    }
    if (households.some(h => h.householdId === newHouseholdId.trim())) {
      alert(`Household #${newHouseholdId} already exists. Please choose a different number.`);
      return;
    }
    const batch = writeBatch(db);
    
    const hhRef = doc(db, 'households', newHouseholdId);
    batch.set(hhRef, {
      householdId: newHouseholdId,
      name: newHouseholdName,
      email: newHouseholdEmail,
      phone: newHouseholdPhone,
      address: newHouseholdAddress
    });

    newMembers.forEach(member => {
      const newRef = doc(collection(db, 'guests'));
      batch.set(newRef, {
        name: member.name,
        household: newHouseholdName,
        householdId: newHouseholdId,
        ageRange: member.ageRange,
        events: member.events,
        rsvps: {}
      });
    });
    
    try {
      await batch.commit();
    } catch (err) {
      alert(`Could not save household: ${err.message}`);
      return;
    }
    setNewHouseholdName('');
    setNewHouseholdId('');
    setNewHouseholdEmail('');
    setNewHouseholdPhone('');
    setNewHouseholdAddress('');
    setNewMembers([{ name: '', ageRange: 'Adult', events: [] }]);
    setShowAddForm(false);
  };

  const exportToCsv = () => {
    const dataForExport = processedGuests.map(g => {
      const hh = households.find(h => h.householdId === g.householdId);
      const row = {
        Name: g.name,
        Household: g.household,
        'Household #': g.householdId,
        'Email': hh?.email || '',
        'Phone': hh?.phone || '',
        'Address': hh?.address || '',
        'Age Range': g.ageRange || '',
        'Invited Events (Raw)': (g.events || []).join(', ')
      };
      allUniqueEvents.forEach(eventName => {
        row[`RSVP: ${eventName}`] = g.events?.includes(eventName) ? (g.rsvps?.[eventName] || 'Pending') : 'Not Invited';
      });
      return row;
    });

    const csvString = Papa.unparse(dataForExport);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'wedding_rsvps.csv';
    link.click();
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedGuests = useMemo(() => {
    let filtered = [...guests];
    if (dashboardSearch.trim()) {
      const term = dashboardSearch.toLowerCase();
      filtered = filtered.filter(g => 
        g.name?.toLowerCase().includes(term) || g.household?.toLowerCase().includes(term) || g.householdId?.toLowerCase().includes(term)
      );
    }
    
    filtered.sort((a, b) => {
      let aValue, bValue;
      const key = sortConfig.key;

      if (key === 'householdId') {
        aValue = parseInt(a.householdId, 10);
        bValue = parseInt(b.householdId, 10);
        if (isNaN(aValue)) aValue = 0;
        if (isNaN(bValue)) bValue = 0;
      } else if (key === 'name' || key === 'ageRange') {
        aValue = (a[key] || '').toLowerCase();
        bValue = (b[key] || '').toLowerCase();
      } else {
        aValue = a.events?.includes(key) ? (a.rsvps?.[key] || 'pending') : 'zzz_not_invited';
        bValue = b.events?.includes(key) ? (b.rsvps?.[key] || 'pending') : 'zzz_not_invited';
      }

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      if (comparison !== 0) {
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (key !== 'householdId') {
        const hA = parseInt(a.householdId, 10) || 0;
        const hB = parseInt(b.householdId, 10) || 0;
        if (hA !== hB) return hA - hB;
      }
      
      const nA = (a.name || '').toLowerCase();
      const nB = (b.name || '').toLowerCase();
      return nA < nB ? -1 : nA > nB ? 1 : 0;
    });

    return filtered;
  }, [guests, dashboardSearch, sortConfig]);

  const calcStats = (eventName) => {
    const invited = guests.filter(g => g.events?.includes(eventName));
    const acceptedGuests = invited.filter(g => g.rsvps?.[eventName] === 'yes');
    
    const ageBreakdown = acceptedGuests.reduce((acc, g) => {
      const range = g.ageRange || 'Adult';
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {});

    return {
      total: invited.length,
      yes: acceptedGuests.length,
      no: invited.filter(g => g.rsvps?.[eventName] === 'no').length,
      pending: invited.filter(g => !g.rsvps?.[eventName]).length,
      ageBreakdown
    };
  };

  const sortIndicator = (columnKey) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-2 inline text-[#333036] opacity-40"/>;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1 inline text-[#6c5d84]"/> : <ChevronDown className="w-4 h-4 ml-1 inline text-[#6c5d84]"/>;
  };

  return (
        <div className="min-h-screen p-6 md:p-12 flex flex-col items-center bg-[#e6dbcc] text-[#333036]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
          
          {!isAdmin && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
              <div className="bg-[#dccfb9] p-8 md:p-12 rounded-sm shadow-xl flex flex-col items-center border border-[#6c5d84]/25 max-w-md w-full animate-in zoom-in-95">
                <Lock className="w-6 h-6 text-[#6c5d84] mb-4 stroke-[1.5]"/>
                <h3 style={{ fontWeight: 700 }} className="text-xl text-[#333036] mb-2 tracking-wide">ADMIN ACCESS</h3>
                <p className="text-xs text-[#333036]/70 mb-8 text-center font-light">Sign in with an approved Google account.</p>
                {authError && (
                  <p role="alert" className="text-xs text-[#7a4d55] bg-[#d4a5a5]/25 border border-[#d4a5a5]/50 rounded-sm px-3 py-2 mb-6 w-full text-center">{authError}</p>
                )}
                <div className="flex gap-4 w-full">
                  <button type="button" onClick={() => { window.location.href = '/'; }} style={{ fontWeight: 500 }} className="flex-1 border border-[#333036]/20 text-[#333036] hover:bg-[#333036]/5 py-3 text-[11px] tracking-[0.2em] uppercase transition-colors rounded-sm">Exit</button>
                  <button type="button" onClick={handleGoogleSignIn} disabled={!authReady} style={{ fontWeight: 700 }} className="flex-1 bg-[#6c5d84] text-[#e6dbcc] py-3 text-[11px] tracking-[0.2em] uppercase hover:bg-[#524569] transition-colors rounded-sm shadow-sm disabled:opacity-50">Sign in with Google</button>
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="w-full max-w-6xl bg-[#dccfb9] rounded-sm shadow-2xl overflow-hidden min-h-[85vh] flex flex-col border border-[#6c5d84]/20">
              
              <div className="bg-[#6c5d84] text-[#e6dbcc] p-6 md:px-10 flex justify-between items-center">
                <h2 style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-lg md:text-xl tracking-[0.15em] uppercase">Guest & RSVP Management</h2>
                <div className="flex items-center gap-6" style={{ fontWeight: 500 }}>
                  <a href="/admin/editor" className="flex items-center gap-1.5 bg-[#e6dbcc] text-[#6c5d84] px-3 py-1.5 rounded-sm text-[11px] tracking-[0.15em] uppercase font-bold hover:bg-white transition-colors">
                    <PenLine className="w-3.5 h-3.5" /> Edit Website
                  </a>
                  <span className="hidden md:inline text-[11px] opacity-70">{authUser?.email}</span>
                  <button onClick={handleSignOut} className="text-[11px] tracking-[0.2em] uppercase opacity-80 hover:opacity-100 transition-opacity">Sign Out</button>
                  <a href="/" className="text-[11px] tracking-[0.2em] uppercase opacity-80 hover:opacity-100 transition-opacity">Exit to Site</a>
                </div>
              </div>

              <div className="flex border-b border-[#333036]/15 bg-[#d2c4ae] text-xs tracking-[0.15em] uppercase text-[#333036] overflow-x-auto" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }}>
                <button onClick={() => setDashboardTab('stats')} className={`px-8 py-4 whitespace-nowrap transition-colors ${dashboardTab === 'stats' ? 'text-[#6c5d84] border-b-2 border-[#6c5d84] bg-[#e6dbcc]' : 'hover:bg-[#d9cca8]'}`}>Overview & Stats</button>
                <button onClick={() => setDashboardTab('list')} className={`px-8 py-4 whitespace-nowrap transition-colors ${dashboardTab === 'list' ? 'text-[#6c5d84] border-b-2 border-[#6c5d84] bg-[#e6dbcc]' : 'hover:bg-[#d9cca8]'}`}>Guest List Editor</button>
                <button onClick={() => setDashboardTab('households')} className={`px-8 py-4 whitespace-nowrap transition-colors ${dashboardTab === 'households' ? 'text-[#6c5d84] border-b-2 border-[#6c5d84] bg-[#e6dbcc]' : 'hover:bg-[#d9cca8]'}`}>Household Directory</button>
                <button onClick={() => setDashboardTab('events')} className={`px-8 py-4 whitespace-nowrap transition-colors ${dashboardTab === 'events' ? 'text-[#6c5d84] border-b-2 border-[#6c5d84] bg-[#e6dbcc]' : 'hover:bg-[#d9cca8]'}`}>Event Order</button>
              </div>

              {/* OVERVIEW & STATS TAB */}
              {dashboardTab === 'stats' && (
                <div className="p-6 md:p-10 space-y-8 flex-1" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                  <div className="grid md:grid-cols-2 gap-8">
                    {allUniqueEvents.length === 0 ? (
                      <div className="col-span-2 text-center py-16 text-[#333036]/50 font-light text-sm tracking-wider">NO EVENTS OR GUESTS FOUND IN THE DATABASE.</div>
                    ) : (
                      allUniqueEvents.map(eventName => {
                        const stats = calcStats(eventName);
                        return (
                          <div key={eventName} className="bg-[#e6dbcc] p-6 rounded-sm border border-[#6c5d84]/15 shadow-sm space-y-6">
                            <h3 style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-sm uppercase tracking-[0.15em] text-[#6c5d84]">{eventName}</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-[#dccfb9] p-4 rounded-sm text-center border border-[#333036]/10">
                                <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 300 }} className="text-3xl text-[#333036]">{stats.total}</p>
                                <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-[0.2em] text-[#333036]/70 mt-1">Invited</p>
                              </div>

                              <div className="bg-[#6c5d84]/10 p-4 rounded-sm text-center border border-[#6c5d84]/30">
                                <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-3xl text-[#6c5d84]">{stats.yes}</p>
                                <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-[0.2em] text-[#6c5d84] mt-1">Accepted</p>
                              </div>

                              <div className="bg-[#d4a5a5]/15 p-4 rounded-sm text-center border border-[#d4a5a5]/40">
                                <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-3xl text-[#7a4d55]">{stats.no}</p>
                                <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-[0.2em] text-[#7a4d55] mt-1">Declined</p>
                              </div>

                              <div className="bg-[#b0c4de]/20 p-4 rounded-sm text-center border border-[#b0c4de]/40">
                                <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-3xl text-[#5c82a6]">{stats.pending}</p>
                                <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-[0.2em] text-[#5c82a6] mt-1">Pending</p>
                              </div>
                            </div>

                            <div className="pt-4 border-t border-[#333036]/10">
                              <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-[0.15em] text-[#6c5d84] mb-2">Accepted by Age Range:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.keys(stats.ageBreakdown).length > 0 ? (
                                  Object.entries(stats.ageBreakdown).map(([range, count]) => (
                                    <span key={range} className="bg-[#d2c4ae] text-[#333036] px-3 py-1 rounded-sm text-xs border border-[#333036]/10 font-light">
                                      <strong className="font-bold">{range}s:</strong> {count}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs italic text-[#333036]/50 font-light">No accepted guests yet.</span>
                                )}
                              </div>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-8 pt-8 border-t border-[#333036]/15">
                    <h3 style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-xs uppercase tracking-[0.15em] text-[#333036] mb-4">Bulk Upload Guests</h3>
                    <label style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="flex items-center gap-2 cursor-pointer bg-[#e6dbcc] border border-[#6c5d84] text-[#6c5d84] px-6 py-3 rounded-sm hover:bg-[#6c5d84] hover:text-[#e6dbcc] transition-colors w-max text-[11px] tracking-[0.15em] uppercase">
                      <Upload className="w-4 h-4 stroke-[1.5]"/>
                      <span>Select CSV File</span>
                      <input type="file" accept=".csv" onChange={processCsvUpload} className="hidden" />
                    </label>
                    <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 300 }} className="text-[11px] text-[#333036]/70 mt-2">Required columns: Name, Household, Events. Optional: Household #, Age Range, Email, Phone, Address.</p>
                  </div>
                </div>
              )}

              {/* EVENT ORDER CONFIGURATION TAB */}
              {dashboardTab === 'events' && (
                <div className="p-6 md:p-10 space-y-6 flex-1" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                  <div className="border-b border-[#333036]/15 pb-4">
                    <h3 style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-xs uppercase tracking-[0.2em] text-[#6c5d84]">Configure Event Display Order</h3>
                    <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 300 }} className="text-xs text-[#333036]/70 mt-1">Use the arrows to reorder how events appear across the public site and admin views.</p>
                  </div>

                  <div className="max-w-md space-y-3">
                    {allUniqueEvents.map((event, index) => (
                      <div key={event} className="bg-[#e6dbcc] p-4 rounded-sm border border-[#6c5d84]/20 flex items-center justify-between shadow-sm">
                        <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-xs tracking-wider uppercase text-[#333036]">{event}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => moveEvent(index, 'up')} 
                            disabled={index === 0}
                            className="p-1.5 border border-[#6c5d84]/30 rounded-sm text-[#6c5d84] hover:bg-[#6c5d84]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowUp className="w-4 h-4 stroke-[1.5]"/>
                          </button>
                          <button 
                            onClick={() => moveEvent(index, 'down')} 
                            disabled={index === allUniqueEvents.length - 1}
                            className="p-1.5 border border-[#6c5d84]/30 rounded-sm text-[#6c5d84] hover:bg-[#6c5d84]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowDown className="w-4 h-4 stroke-[1.5]"/>
                          </button>
                        </div>
                      </div>
                    ))}
                    {allUniqueEvents.length === 0 && (
                      <p className="text-xs italic text-[#333036]/50">No events found in the database yet.</p>
                    )}
                  </div>
                </div>
              )}

              {dashboardTab === 'list' && (
                <div className="flex-1 flex flex-col max-h-[75vh]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                  <div className="p-4 md:px-6 border-b border-[#333036]/15 flex flex-wrap gap-4 justify-between items-center bg-[#d2c4ae]">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333036]/40 w-4 h-4 stroke-[1.5]"/>
                      <input type="text" placeholder="Search guests..." value={dashboardSearch} onChange={(e) => setDashboardSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-[#333036]/20 bg-[#e6dbcc] rounded-sm outline-none focus:border-[#6c5d84] text-xs text-[#333036] font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} />
                      {dashboardSearch && <button onClick={() => setDashboardSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#333036]/50 hover:text-[#333036]"><X className="w-4 h-4"/></button>}
                    </div>
                    <div className="flex gap-3" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }}>
                      <button onClick={handleOpenAddForm} className="flex items-center gap-1.5 bg-[#6c5d84] text-[#e6dbcc] px-4 py-2 rounded-sm text-[11px] tracking-[0.15em] uppercase hover:bg-[#524569] transition-colors shadow-sm"><UserPlus className="w-3.5 h-3.5 stroke-[1.5]"/> Add Household</button>
                      <button onClick={exportToCsv} className="flex items-center gap-1.5 bg-[#e6dbcc] border border-[#6c5d84] text-[#6c5d84] px-4 py-2 rounded-sm text-[11px] tracking-[0.15em] uppercase hover:bg-[#d2c4ae] transition-colors"><Download className="w-3.5 h-3.5 stroke-[1.5]"/> Export</button>
                    </div>
                  </div>

                  {showAddForm && (
                    <div className="bg-[#d2c4ae] p-6 border-b border-[#333036]/15" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                      <div className="flex justify-between items-start mb-4">
                        <h3 style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-xs uppercase tracking-[0.15em] text-[#333036]">Add New Household & Guests</h3>
                        <div className="text-right">
                          <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] text-[#333036]/70 uppercase tracking-widest">Household #</p>
                          <input type="text" value={newHouseholdId} onChange={(e) => setNewHouseholdId(e.target.value)} className="w-20 text-xs p-1.5 border border-[#333036]/20 bg-[#e6dbcc] rounded-sm outline-none focus:border-[#6c5d84] text-center font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-3">
                          <input type="text" placeholder="Household Name (e.g. Smith Family)" value={newHouseholdName} onChange={(e) => setNewHouseholdName(e.target.value)} className="p-2 border border-[#333036]/20 bg-[#e6dbcc] rounded-sm outline-none focus:border-[#6c5d84] text-xs font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} />
                          <input type="text" placeholder="Email Address" value={newHouseholdEmail} onChange={(e) => setNewHouseholdEmail(e.target.value)} className="p-2 border border-[#333036]/20 bg-[#e6dbcc] rounded-sm outline-none focus:border-[#6c5d84] text-xs font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} />
                          <input type="text" placeholder="Phone Number" value={newHouseholdPhone} onChange={(e) => setNewHouseholdPhone(e.target.value)} className="p-2 border border-[#333036]/20 bg-[#e6dbcc] rounded-sm outline-none focus:border-[#6c5d84] text-xs font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} />
                        </div>
                        <input type="text" placeholder="Mailing Address" value={newHouseholdAddress} onChange={(e) => setNewHouseholdAddress(e.target.value)} className="w-full p-2 border border-[#333036]/20 bg-[#e6dbcc] rounded-sm outline-none focus:border-[#6c5d84] text-xs font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} />

                        <div className="flex items-center gap-2 bg-[#e6dbcc] p-3 rounded-sm border border-[#333036]/15 w-full md:w-1/2">
                          <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-wider text-[#333036]/70">Event:</span>
                          <input type="text" placeholder="e.g. Sangeet" value={newCustomEvent} onChange={(e) => setNewCustomEvent(e.target.value)} className="flex-1 text-xs p-1 border-b border-[#333036]/20 bg-transparent outline-none focus:border-[#6c5d84] font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} />
                          <button onClick={handleAddCustomEventToForm} style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-wider bg-[#d2c4ae] px-3 py-1 rounded-sm hover:bg-[#c4b59f] transition-colors">Add</button>
                        </div>

                        {newMembers.map((member, index) => (
                          <div key={index} className="flex flex-col gap-3 bg-[#e6dbcc] p-4 rounded-sm border border-[#333036]/15 shadow-sm" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                            <div className="flex flex-wrap items-center gap-3">
                              <input type="text" placeholder="Guest Full Name" value={member.name} onChange={(e) => handleUpdateMember(index, 'name', e.target.value)} className="flex-1 min-w-[180px] p-2 border border-[#333036]/20 rounded-sm outline-none focus:border-[#6c5d84] bg-[#e6dbcc] text-xs font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} />
                              
                              {/* FIXED: Removed the / at the end of this select tag */}
                              <select value={member.ageRange} onChange={(e) => handleUpdateMember(index, 'ageRange', e.target.value)} className="p-2 border border-[#333036]/20 rounded-sm outline-none focus:border-[#6c5d84] bg-[#e6dbcc] text-xs font-light" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                                <option value="Adult">Adult</option><option value="Child">Child</option><option value="Infant">Infant</option>
                              </select>
                              
                              {newMembers.length > 1 && <button onClick={() => handleRemoveMemberRow(index)} className="text-[#333036]/60 hover:text-[#333036] ml-auto"><Trash2 className="w-4 h-4"/></button>}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 border-t border-[#333036]/10 pt-2.5">
                              <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-wider text-[#333036]/60 w-full md:w-auto">Invited To:</span>
                              {formAvailableEvents.length === 0 && <span className="text-[11px] text-[#333036]/50 italic font-light">No events defined yet.</span>}
                              {formAvailableEvents.map(evt => (
                                <label key={evt} className="flex items-center gap-1.5 text-xs text-[#333036] cursor-pointer bg-[#d2c4ae] px-2.5 py-1 rounded-sm border border-[#333036]/15 font-light">
                                  <input type="checkbox" checked={member.events.includes(evt)} onChange={() => handleUpdateMember(index, 'events', evt)} className="accent-[#6c5d84]" /> {evt}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-4 pt-2" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }}>
                          <button onClick={handleAddMemberRow} className="text-[#6c5d84] text-[11px] uppercase tracking-[0.15em] flex items-center gap-1 hover:text-[#333036]"><Plus className="w-3.5 h-3.5"/> Add Person</button>
                          <button onClick={submitNewHousehold} className="bg-[#6c5d84] text-[#e6dbcc] px-6 py-2 rounded-sm text-[11px] tracking-[0.15em] uppercase ml-auto hover:bg-[#524569] shadow-sm">Save Household</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GUEST LIST EDITOR TABLE */}
                  <div className="flex-1 overflow-auto bg-[#e6dbcc]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="sticky top-0 bg-[#d2c4ae] border-b border-[#333036]/20 z-10 text-[10px] uppercase tracking-[0.2em] text-[#333036]">
                        <tr>
                          <th onClick={() => handleSort('name')} className="px-6 py-3.5 cursor-pointer hover:bg-[#c4b59f] transition-colors">Guest Name {sortIndicator('name')}</th>
                          <th onClick={() => handleSort('householdId')} className="px-6 py-3.5 cursor-pointer hover:bg-[#c4b59f] transition-colors">Household Assignment {sortIndicator('householdId')}</th>
                          <th onClick={() => handleSort('ageRange')} className="px-6 py-3.5 cursor-pointer hover:bg-[#c4b59f] transition-colors">Age Range {sortIndicator('ageRange')}</th>
                          {allUniqueEvents.map(evt => (
                            <th key={evt} onClick={() => handleSort(evt)} className="px-6 py-3.5 text-center cursor-pointer hover:bg-[#c4b59f] transition-colors">{evt} {sortIndicator(evt)}</th>
                          ))}
                          <th className="px-6 py-3.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-[#333036]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 300 }}>
                        {processedGuests.map((guest) => {
                          const isEditing = editingGuestId === guest.id;
                          const sortedGuestEvents = sortEventsByConfig(allUniqueEvents, customEventOrder);
                          return (
                            <tr key={guest.id} className="border-b border-[#333036]/10 hover:bg-[#dfd4c3] transition-colors">
                              
                              <td className="px-6 py-3">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={tempGuestData.name} 
                                    onChange={(e) => setTempGuestData({ ...tempGuestData, name: e.target.value })} 
                                    className="border border-[#6c5d84] bg-[#e6dbcc] px-2 py-1 text-xs rounded-sm outline-none w-full"
                                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }}
                                  />
                                ) : (
                                  <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[#333036]">{guest.name}</span>
                                )}
                              </td>

                              <td className="px-6 py-3">
                                {isEditing ? (
                                  <select 
                                    value={tempGuestData.householdId} 
                                    onChange={(e) => setTempGuestData({ ...tempGuestData, householdId: e.target.value })}
                                    className="border border-[#6c5d84] bg-[#e6dbcc] px-2 py-1 text-xs rounded-sm outline-none w-full font-light"
                                  >
                                    {households.map(h => (
                                      <option key={h.id} value={h.householdId}>#{h.householdId} - {h.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <div>
                                    <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 500 }}>{guest.household}</span>
                                    <span className="block text-[10px] text-[#333036]/60 font-light">ID: #{guest.householdId}</span>
                                  </div>
                                )}
                              </td>

                              <td className="px-6 py-3 text-[#333036]/80">{guest.ageRange || 'Adult'}</td>

                              {sortedGuestEvents.map(evt => {
                                const isInvited = guest.events?.includes(evt);
                                const status = isInvited ? (guest.rsvps?.[evt] || 'pending') : 'not_invited';
                                return (
                                  <td key={evt} className="px-6 py-3 text-center border-l border-[#333036]/10">
                                    <select value={status} onChange={(e) => handleAdminEventAndRsvpUpdate(guest, evt, e.target.value)} style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className={`text-[10px] uppercase tracking-wider outline-none cursor-pointer border px-2 py-1 rounded-sm transition-colors ${status === 'yes' ? 'bg-[#6c5d84]/15 text-[#6c5d84] border-[#6c5d84]/40' : status === 'no' ? 'bg-[#d4a5a5]/30 text-[#333036] border-[#d4a5a5]/60' : status === 'not_invited' ? 'bg-[#d2c4ae] text-[#333036]/40 border-transparent hover:border-[#333036]/20' : 'bg-[#b0c4de]/30 text-[#333036] border-[#b0c4de]/60'}`}>
                                      <option value="not_invited">Not Invited</option>
                                      <option value="pending">Pending</option>
                                      <option value="yes">Accepted</option>
                                      <option value="no">Declined</option>
                                    </select>
                                  </td>
                                );
                              })}

                              <td className="px-6 py-3 text-center">
                                {isEditing ? (
                                  <button onClick={() => saveGuestEdits(guest.id)} className="bg-[#6c5d84] text-[#e6dbcc] p-1.5 rounded-sm hover:bg-[#524569] transition-colors inline-flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 stroke-[2]"/>
                                  </button>
                                ) : (
                                  <button onClick={() => startEditingGuest(guest)} className="border border-[#6c5d84]/40 text-[#6c5d84] p-1.5 rounded-sm hover:bg-[#6c5d84]/10 transition-colors inline-flex items-center justify-center">
                                    <Edit2 className="w-3.5 h-3.5 stroke-[1.5]"/>
                                  </button>
                                )}
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {processedGuests.length === 0 && (
                      <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 500 }} className="text-center py-16 text-[#333036]/50 text-xs tracking-wider">
                        {dashboardSearch ? `NO GUESTS MATCHING "${dashboardSearch.toUpperCase()}"` : 'NO GUESTS FOUND.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* HOUSEHOLD DIRECTORY TAB */}
              {dashboardTab === 'households' && (
                <div className="flex-1 flex flex-col p-6 md:p-10 overflow-auto space-y-6" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                  <div className="flex justify-between items-center border-b border-[#333036]/15 pb-4">
                    <h3 style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-xs uppercase tracking-[0.2em] text-[#6c5d84]">Household Directory</h3>
                    <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 300 }} className="text-xs text-[#333036]/70">Total Households: {households.length}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {households.map(hh => {
                      const isEditingHh = editingHouseholdId === hh.id;
                      const hhGuests = guests.filter(g => g.householdId === hh.householdId);

                      return (
                        <div key={hh.id} className="bg-[#e6dbcc] p-6 rounded-sm border border-[#6c5d84]/20 shadow-sm space-y-4">
                          <div className="flex justify-between items-start">
                            {isEditingHh ? (
                              <input 
                                type="text" 
                                value={tempHouseholdData.name} 
                                onChange={(e) => setTempHouseholdData({ ...tempHouseholdData, name: e.target.value })}
                                className="border border-[#6c5d84] bg-[#dccfb9] px-2 py-1 text-sm rounded-sm font-bold w-3/4 outline-none"
                              />
                            ) : (
                              <div>
                                <h4 style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-base text-[#333036]">{hh.name}</h4>
                                <span className="text-[10px] tracking-wider uppercase text-[#6c5d84] font-bold">Household ID: #{hh.householdId}</span>
                              </div>
                            )}

                            {isEditingHh ? (
                              <button onClick={() => saveHouseholdEdits(hh.id, hh.householdId)} className="bg-[#6c5d84] text-[#e6dbcc] p-1.5 rounded-sm hover:bg-[#524569] transition-colors">
                                <Check className="w-4 h-4 stroke-[2]"/>
                              </button>
                            ) : (
                              <button onClick={() => startEditingHousehold(hh)} className="border border-[#6c5d84]/40 text-[#6c5d84] p-1.5 rounded-sm hover:bg-[#6c5d84]/10 transition-colors">
                                <Edit2 className="w-4 h-4 stroke-[1.5]"/>
                              </button>
                            )}
                          </div>

                          <div className="space-y-2 text-xs pt-2 border-t border-[#333036]/10">
                            {isEditingHh ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-16 uppercase text-[10px] font-bold text-[#6c5d84]">Email:</span>
                                  <input type="text" value={tempHouseholdData.email} onChange={(e) => setTempHouseholdData({ ...tempHouseholdData, email: e.target.value })} className="flex-1 p-1 bg-[#dccfb9] border border-[#6c5d84]/40 rounded-sm outline-none" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-16 uppercase text-[10px] font-bold text-[#6c5d84]">Phone:</span>
                                  <input type="text" value={tempHouseholdData.phone} onChange={(e) => setTempHouseholdData({ ...tempHouseholdData, phone: e.target.value })} className="flex-1 p-1 bg-[#dccfb9] border border-[#6c5d84]/40 rounded-sm outline-none" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-16 uppercase text-[10px] font-bold text-[#6c5d84]">Address:</span>
                                  <input type="text" value={tempHouseholdData.address} onChange={(e) => setTempHouseholdData({ ...tempHouseholdData, address: e.target.value })} className="flex-1 p-1 bg-[#dccfb9] border border-[#6c5d84]/40 rounded-sm outline-none" />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1 font-light text-[#333036]/90">
                                <p><strong className="font-bold text-[#6c5d84]">Email:</strong> {hh.email || 'None provided'}</p>
                                <p><strong className="font-bold text-[#6c5d84]">Phone:</strong> {hh.phone || 'None provided'}</p>
                                <p><strong className="font-bold text-[#6c5d84]">Address:</strong> {hh.address || 'None provided'}</p>
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-[#333036]/10">
                            <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 700 }} className="text-[10px] uppercase tracking-wider text-[#6c5d84] mb-2">Assigned Guests ({hhGuests.length}):</p>
                            <div className="flex flex-wrap gap-1.5">
                              {hhGuests.length > 0 ? (
                                hhGuests.map(g => (
                                  <span key={g.id} className="bg-[#d2c4ae] text-[#333036] px-2.5 py-1 rounded-sm text-xs font-light border border-[#333036]/10">
                                    {g.name} <span className="text-[10px] opacity-60">({g.ageRange})</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs italic text-[#333036]/50 font-light">No guests currently assigned.</span>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
  );
}
