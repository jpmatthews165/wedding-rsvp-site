import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Lock, Upload, Download, CheckCircle2, XCircle, Circle, Plus, Trash2, UserPlus, ArrowUpDown, ChevronUp, ChevronDown, Menu } from 'lucide-react';
import Papa from 'papaparse';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, writeBatch, updateDoc, deleteField } from 'firebase/firestore';

// --------------------------------------------------------
// 1. FIREBASE CONFIGURATION
// --------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCmYELIaWbAQa_a3FwSbGTQ6vwM5yMjAzw",
  authDomain: "wedding-rsvp-a2263.firebaseapp.com",
  projectId: "wedding-rsvp-a2263",
  storageBucket: "wedding-rsvp-a2263.firebasestorage.app",
  messagingSenderId: "417073252983",
  appId: "1:417073252983:web:bc60809d4adef451905472",
  measurementId: "G-JT22Q0515D"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --------------------------------------------------------
// FUZZY SEARCH HELPER (Levenshtein Distance)
// --------------------------------------------------------
const getEditDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// --------------------------------------------------------
// ANIMATION COMPONENT
// --------------------------------------------------------
const RevealOnScroll = ({ children, delay = 0, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => { if (ref.current) observer.unobserve(ref.current); };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// --------------------------------------------------------
// 2. MAIN APP COMPONENT
// --------------------------------------------------------
export default function App() {
  const [guests, setGuests] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.pathname.includes('/admin'));
  const [isAdmin, setIsAdmin] = useState(false);
  const [pin, setPin] = useState('');
  const [dashboardTab, setDashboardTab] = useState('stats'); 
  
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'householdId', direction: 'asc' });
  
  const [allUniqueEvents, setAllUniqueEvents] = useState([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdId, setNewHouseholdId] = useState('');
  const [newCustomEvent, setNewCustomEvent] = useState('');
  const [formAvailableEvents, setFormAvailableEvents] = useState([]);
  const [newMembers, setNewMembers] = useState([{ name: '', ageRange: 'Adult', events: [] }]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [timeLeft, setTimeLeft] = useState({});
  
  const heroBgRef = useRef(null);
  const registrySectionRef = useRef(null);
  const registryBgRef = useRef(null);
  const rsvpSectionRef = useRef(null);
  const rsvpBgRef = useRef(null);

  const weddingDate = new Date('May 29, 2027 10:00:00').getTime();

  useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(window.location.pathname.includes('/admin'));
    };
    window.addEventListener('popstate', handlePopState);

    signInAnonymously(auth).catch(error => console.error("Auth error:", error));
    const unsubscribe = onSnapshot(collection(db, 'guests'), (snapshot) => {
      const guestData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGuests(guestData);
      const uniqueEvents = Array.from(new Set(guestData.flatMap(g => g.events || []))).sort();
      setAllUniqueEvents(uniqueEvents);
      setFormAvailableEvents(prev => Array.from(new Set([...prev, ...uniqueEvents])).sort());
    });
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = weddingDate - now;
      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [weddingDate]);

  useEffect(() => {
    if (isAdminRoute) return; 
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollPos = window.scrollY;
          setShowStickyHeader(scrollPos > window.innerHeight * 0.5);

          if (heroBgRef.current) {
            heroBgRef.current.style.transform = `translate3d(0, ${scrollPos * 0.4}px, 0)`;
          }
          if (registrySectionRef.current && registryBgRef.current) {
            const rect = registrySectionRef.current.getBoundingClientRect();
            registryBgRef.current.style.transform = `translate3d(0, ${rect.top * -0.2}px, 0)`;
          }
          if (rsvpSectionRef.current && rsvpBgRef.current) {
            const rect = rsvpSectionRef.current.getBoundingClientRect();
            rsvpBgRef.current.style.transform = `translate3d(0, ${rect.top * -0.2}px, 0)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); 
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAdminRoute]);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  const handleAddToCalendar = () => {
    const isApple = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
    const title = "Josh & Sneha Wedding";
    const location = "Lucien's Manor, 81 W White Horse Pike, Berlin, NJ 08009";
    const startTime = "20270529T140000Z";
    const endTime = "20270529T200000Z";

    if (isApple) {
      const icsData = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${startTime}\nDTEND:${endTime}\nSUMMARY:${title}\nLOCATION:${location}\nEND:VEVENT\nEND:VCALENDAR`;
      const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', 'Josh_Sneha_Wedding.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startTime}/${endTime}&location=${encodeURIComponent(location)}`;
      window.open(googleUrl, '_blank');
    }
  };

  const handleGuestSearch = (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchResults([]);

    const cleanTerm = searchTerm.trim().toLowerCase();
    const parts = cleanTerm.split(/\s+/);

    if (parts.length < 2) {
      setSearchError("Please enter your full first and last name.");
      return;
    }

    const results = guests.filter(guest => {
      const guestName = guest.name?.toLowerCase().trim();
      if (!guestName) return false;
      if (guestName === cleanTerm) return true;
      const distance = getEditDistance(cleanTerm, guestName);
      return distance <= 3;
    });

    if (results.length === 0) {
      setSearchError("We couldn't find a match. Please check spelling and try again.");
    } else {
      setSearchResults(results);
    }
  };

  const handleRsvpChange = async (guestId, eventName, answer) => {
    const guestRef = doc(db, 'guests', guestId);
    setSelectedHousehold(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === guestId ? { ...m, rsvps: { ...(m.rsvps || {}), [eventName]: answer } } : m)
    }));
    await updateDoc(guestRef, { [`rsvps.${eventName}`]: answer });
  };

  const generateHouseholdId = () => Math.floor(100000 + Math.random() * 900000).toString();

  const handleOpenAddForm = () => {
    setNewHouseholdId(generateHouseholdId());
    setNewMembers([{ name: '', ageRange: 'Adult', events: allUniqueEvents.length > 0 ? [allUniqueEvents[0]] : [] }]);
    setShowAddForm(!showAddForm);
  };

  const handleAddCustomEventToForm = () => {
    if (newCustomEvent.trim() && !formAvailableEvents.includes(newCustomEvent.trim())) {
      setFormAvailableEvents([...formAvailableEvents, newCustomEvent.trim()]);
      setNewCustomEvent('');
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (pin === '1234') {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setPin('');
    } else {
      alert("Incorrect PIN");
    }
  };

  const handleAdminEventAndRsvpUpdate = async (guest, eventName, newStatus) => {
    const guestRef = doc(db, 'guests', guest.id);
    
    if (newStatus === 'not_invited') {
      const updatedEvents = (guest.events || []).filter(e => e !== eventName);
      await updateDoc(guestRef, {
        events: updatedEvents,
        [`rsvps.${eventName}`]: deleteField()
      });
    } else {
      const updatedEvents = [...new Set([...(guest.events || []), eventName])];
      await updateDoc(guestRef, {
        events: updatedEvents,
        [`rsvps.${eventName}`]: newStatus === 'pending' ? deleteField() : newStatus
      });
    }
  };

  const processCsvUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const batch = writeBatch(db);
        
        results.data.forEach((row) => {
          if (!row.Name || !row.Household) return;
          const eventsArray = row.Events ? row.Events.split(',').map(e => e.trim()).filter(e => e) : [];
          const rowHouseholdId = row['Household #'] || row.Household;

          const rsvpsToPreload = {};
          Object.keys(row).forEach(key => {
            if (key.startsWith('RSVP: ')) {
              const eventName = key.replace('RSVP: ', '').trim();
              const val = row[key].trim().toLowerCase();
              if (val === 'yes' || val === 'no') {
                rsvpsToPreload[eventName] = val;
              }
            }
          });
            
          const existingGuest = guests.find(g => g.name.toLowerCase() === row.Name.toLowerCase() && g.householdId === rowHouseholdId);

          if (existingGuest) {
            const mergedRsvps = { ...existingGuest.rsvps, ...rsvpsToPreload };
            const guestRef = doc(db, 'guests', existingGuest.id);
            batch.update(guestRef, {
              household: row.Household,
              ageRange: row['Age Range'] || existingGuest.ageRange,
              events: eventsArray,
              rsvps: mergedRsvps 
            });
          } else {
            const newRef = doc(collection(db, 'guests'));
            batch.set(newRef, {
              name: row.Name,
              household: row.Household,
              householdId: rowHouseholdId,
              ageRange: row['Age Range'] || 'Adult',
              events: eventsArray,
              rsvps: rsvpsToPreload 
            });
          }
        });
        
        await batch.commit();
        alert('Guest list synced successfully! RSVPs have been updated.');
        event.target.value = ''; 
      }
    });
  };

  const handleAddMemberRow = () => setNewMembers([...newMembers, { name: '', ageRange: 'Adult', events: allUniqueEvents.length > 0 ? [allUniqueEvents[0]] : [] }]);
  const handleRemoveMemberRow = (index) => setNewMembers(newMembers.filter((_, i) => i !== index));

  const handleUpdateMember = (index, field, value) => {
    const updated = [...newMembers];
    if (field === 'events') {
      const hasEvent = updated[index].events.includes(value);
      if (hasEvent) {
        updated[index].events = updated[index].events.filter(e => e !== value);
      } else {
        updated[index].events.push(value);
      }
    } else {
      updated[index][field] = value;
    }
    setNewMembers(updated);
  };

  const submitNewHousehold = async () => {
    if (!newHouseholdName.trim() || newMembers.some(m => !m.name.trim()) || !newHouseholdId.trim()) {
      alert("Please ensure the household name, ID, and all guest names are filled out.");
      return;
    }
    const batch = writeBatch(db);
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
    await batch.commit();
    setNewHouseholdName('');
    setNewHouseholdId('');
    setNewMembers([{ name: '', ageRange: 'Adult', events: [] }]);
    setShowAddForm(false);
  };

  const exportToCsv = () => {
    const dataForExport = processedGuests.map(g => {
      const row = {
        Name: g.name,
        Household: g.household,
        'Household #': g.householdId,
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
        aValue = (a.householdId || '').toLowerCase();
        bValue = (b.householdId || '').toLowerCase();
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
        const hA = (a.householdId || '').toLowerCase();
        const hB = (b.householdId || '').toLowerCase();
        if (hA < hB) return -1;
        if (hA > hB) return 1;
      }
      
      const nA = (a.name || '').toLowerCase();
      const nB = (b.name || '').toLowerCase();
      return nA < nB ? -1 : nA > nB ? 1 : 0;
    });

    return filtered;
  }, [guests, dashboardSearch, sortConfig]);

  const calcStats = (eventName) => {
    const invited = guests.filter(g => g.events?.includes(eventName));
    return {
      total: invited.length,
      yes: invited.filter(g => g.rsvps?.[eventName] === 'yes').length,
      no: invited.filter(g => g.rsvps?.[eventName] === 'no').length,
      pending: invited.filter(g => !g.rsvps?.[eventName]).length
    };
  };

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-2 inline text-[#333036] opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1 inline text-[#6c5d84]" /> : <ChevronDown className="w-4 h-4 ml-1 inline text-[#6c5d84]" />;
  };

  // --------------------------------------------------------
  // RENDER UI
  // --------------------------------------------------------
  return (
    <div className="bg-[#e6dbcc] text-[#333036] font-details selection:bg-[#d4a5a5] selection:text-[#e6dbcc] overflow-x-hidden">
      
      {/* =========================================
          WEDDING WEBSITE (GUEST FACING)
          ========================================= */}
      {!isAdminRoute && (
        <>
          <header className={`fixed top-0 left-0 w-full z-50 bg-[#e6dbcc]/90 backdrop-blur-md border-b border-[#6c5d84]/15 transition-all duration-500 ease-out ${
            showStickyHeader ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'
          }`}>
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
              <span className="font-title text-3xl tracking-wide text-[#6c5d84]">Josh & Sneha</span>
              <button onClick={() => setIsMenuOpen(true)} className="text-[#6c5d84] hover:text-[#333036] transition-colors">
                <Menu className="w-8 h-8 stroke-[1.5]" />
              </button>
            </div>
          </header>

          <div 
            className={`fixed inset-0 bg-[#e6dbcc] z-[100] flex flex-col items-center justify-center transition-all duration-500 ease-in-out ${
              isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 text-[#6c5d84] hover:text-[#333036] transition-colors">
              <X className="w-10 h-10 stroke-[1]" />
            </button>
            <nav className="flex flex-col items-center space-y-8 md:space-y-12">
              {[
                { name: 'Home', id: 'home' },
                { name: 'Details', id: 'details' },
                { name: 'Travel', id: 'travel' },
                { name: 'Registry', id: 'registry' },
                { name: 'FAQ', id: 'faq' },
                { name: 'RSVP', id: 'rsvp' }
              ].map((item, index) => (
                <button 
                  key={item.id} 
                  onClick={() => scrollToSection(item.id)} 
                  className={`font-title text-4xl md:text-6xl text-[#6c5d84] hover:text-[#333036] transition-all duration-500 tracking-wide ${
                    isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                  }`}
                  style={{ transitionDelay: isMenuOpen ? `${index * 50}ms` : '0ms' }}
                >
                  {item.name}
                </button>
              ))}
            </nav>
          </div>

          <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden bg-[#e6dbcc]">
            <div ref={heroBgRef} className="absolute -top-[25%] left-0 w-full h-[150%] bg-cover bg-center z-0 will-change-transform" style={{ backgroundImage: "url('/hero.jpg')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-b from-[#e6dbcc] via-[#e6dbcc]/40 to-transparent z-10 pointer-events-none"></div>
            
            <RevealOnScroll className="relative z-20 text-center space-y-8 p-4 -mt-32 md:-mt-48">
              <RevealOnScroll delay={0}>
                <p className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-base text-[#4a4552]">We invite you to celebrate with us</p>
              </RevealOnScroll>
              <RevealOnScroll delay={150}>
                <h1 className="font-title text-7xl md:text-[10rem] leading-none text-[#6c5d84] drop-shadow-sm">Josh &<br />Sneha</h1>
              </RevealOnScroll>
            </RevealOnScroll>

            <div className="absolute bottom-12 w-full text-center z-20 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
              <RevealOnScroll delay={300}>
                <button 
                  onClick={() => scrollToSection('rsvp')} 
                  className="font-subtitle border border-[#6c5d84] bg-[#e6dbcc]/60 backdrop-blur-sm text-[#6c5d84] px-8 py-3 text-xs tracking-[0.15em] uppercase hover:bg-[#6c5d84] hover:text-[#e6dbcc] transition-colors shadow-sm"
                >
                  RSVP Now
                </button>
              </RevealOnScroll>
            </div>
          </section>

          <section id="details" className="relative flex items-center justify-center py-32 px-6 md:px-12 bg-[#e6dbcc]">
            <div className="max-w-6xl w-full grid md:grid-cols-2 gap-16 md:gap-24 items-center">
              <div className="space-y-10 text-center md:text-left">
                <RevealOnScroll delay={0}>
                  <h2 className="font-title text-5xl md:text-7xl text-[#6c5d84] mb-6">The Wedding</h2>
                  <div className="h-px w-24 bg-[#6c5d84]/40 mx-auto md:mx-0"></div>
                </RevealOnScroll>
                
                <RevealOnScroll delay={100} className="space-y-2">
                  <p className="font-subtitle tracking-[0.1em] uppercase text-sm md:text-base text-[#4a4552]">When</p>
                  <p className="font-title text-4xl md:text-5xl text-[#6c5d84]">Saturday, May 29th</p>
                  <p className="font-details text-xl text-[#333036] tracking-wide mt-2">Ten O'Clock in the Morning</p>
                </RevealOnScroll>
                
                <RevealOnScroll delay={200} className="space-y-2">
                  <p className="font-subtitle tracking-[0.1em] uppercase text-sm md:text-base text-[#4a4552]">Where</p>
                  <p className="font-title text-4xl md:text-5xl text-[#6c5d84]">Lucien's Manor</p>
                  <p className="font-details text-xl text-[#333036] tracking-wide mt-2">81 W White Horse Pike<br/>Berlin, NJ 08009</p>
                </RevealOnScroll>

                <RevealOnScroll delay={300} className="pt-4 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <button 
                    onClick={handleAddToCalendar} 
                    className="font-subtitle border border-[#6c5d84]/40 text-[#6c5d84] px-8 py-3 text-xs tracking-[0.15em] uppercase hover:border-[#6c5d84] hover:bg-[#6c5d84]/10 transition-colors"
                  >
                    Add to Calendar
                  </button>
                  <button 
                    onClick={() => scrollToSection('rsvp')} 
                    className="font-subtitle border border-[#6c5d84] bg-[#6c5d84] text-[#e6dbcc] px-8 py-3 text-xs tracking-[0.15em] uppercase hover:bg-[#524569] hover:border-[#524569] transition-colors shadow-sm"
                  >
                    RSVP
                  </button>
                </RevealOnScroll>

                <RevealOnScroll delay={400}>
                  <div className="w-full h-64 mt-4 relative overflow-hidden rounded shadow-sm bg-[#d9cca8] z-10 border border-[#b0c4de]/40">
                    <iframe src="https://maps.google.com/maps?q=Lucien's+Manor,+81+W+White+Horse+Pike,+Berlin,+NJ&t=&z=14&ie=UTF8&iwloc=&output=embed" title="Lucien's Manor Map" className="absolute inset-0 w-full h-full opacity-80 mix-blend-multiply grayscale" style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
                  </div>
                </RevealOnScroll>
              </div>

              <RevealOnScroll delay={200}>
                <div className="relative h-[80vh] w-full bg-[#d9cca8] overflow-hidden rounded-sm z-10 shadow-lg border border-[#b0c4de]/40">
                  <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: "url('/details.jpg')" }}></div>
                </div>
              </RevealOnScroll>
            </div>
          </section>

          <section id="travel" className="py-32 px-6 md:px-12 bg-[#e6dbcc] border-t border-[#6c5d84]/15">
            <div className="max-w-5xl mx-auto text-center">
              <RevealOnScroll delay={0}>
                <h2 className="font-title text-5xl md:text-7xl text-[#6c5d84] mb-6">Travel & Stay</h2>
                <div className="h-px w-24 bg-[#6c5d84]/40 mx-auto mb-16"></div>
              </RevealOnScroll>
              
              <div className="grid md:grid-cols-2 gap-16 text-left">
                <RevealOnScroll delay={100} className="space-y-8">
                  <h3 className="font-subtitle text-3xl md:text-4xl tracking-normal text-[#6c5d84]">Getting Here</h3>
                  <p className="font-details text-lg text-[#333036] leading-relaxed">For our out-of-town guests, there are two primary airports we recommend flying into:</p>
                  <ul className="space-y-6">
                    <li className="border-l-2 border-[#b0c4de] pl-4">
                      <span className="font-subtitle text-lg tracking-normal block text-[#6c5d84]">Philadelphia International (PHL)</span>
                      <span className="font-details text-[#333036] leading-relaxed">Approx. 40 minutes from the venue. The most convenient option.</span>
                    </li>
                    <li className="border-l-2 border-[#b0c4de] pl-4">
                      <span className="font-subtitle text-lg tracking-normal block text-[#6c5d84]">Newark Liberty International (EWR)</span>
                      <span className="font-details text-[#333036] leading-relaxed">Approx. 90 minutes from the venue. May offer more direct flights.</span>
                    </li>
                  </ul>
                </RevealOnScroll>

                <RevealOnScroll delay={200} className="space-y-8">
                  <h3 className="font-subtitle text-3xl md:text-4xl tracking-normal text-[#6c5d84]">Accommodations</h3>
                  <p className="font-details text-lg text-[#333036] leading-relaxed">We have secured a block of rooms at a special rate for our guests. Please book before April 29th to ensure availability.</p>
                  <div className="bg-[#dccfb9] p-8 shadow-sm border border-[#333036]/15 space-y-4">
                    <p className="font-subtitle text-2xl md:text-3xl tracking-normal text-[#6c5d84]">The Grand Hotel Placeholder</p>
                    <p className="font-details text-lg text-[#333036]">123 Hotel Avenue, Mount Laurel, NJ</p>
                    <div className="pt-4 space-y-2">
                      <p className="font-subtitle text-xs uppercase tracking-[0.15em] text-[#333036]">Discount Code</p>
                      <p className="font-subtitle text-lg tracking-normal text-[#6c5d84]">MATTHEWS27</p>
                    </div>
                    <button className="mt-4 font-subtitle border border-[#6c5d84] text-[#6c5d84] px-6 py-3 text-xs tracking-[0.15em] uppercase hover:bg-[#6c5d84] hover:text-[#e6dbcc] transition-colors w-full">Book Room</button>
                  </div>
                </RevealOnScroll>
              </div>
            </div>
          </section>

          {/* COUNTDOWN SECTION - Lilac Majority */}
          <section className="py-24 bg-[#6c5d84] text-[#e6dbcc] relative z-20 shadow-inner">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <RevealOnScroll delay={0}>
                <p className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-lg mb-12 opacity-90 text-[#e6dbcc]">Counting down the days</p>
              </RevealOnScroll>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
                {[
                  { label: 'Days', value: timeLeft.days, delay: 0 },
                  { label: 'Hours', value: timeLeft.hours, delay: 100 },
                  { label: 'Minutes', value: timeLeft.minutes, delay: 200 },
                  { label: 'Seconds', value: timeLeft.seconds, delay: 300 }
                ].map((item) => (
                  <RevealOnScroll key={item.label} delay={item.delay}>
                    <div className="space-y-2">
                      <p className="font-title text-7xl md:text-8xl lg:text-9xl font-light text-[#e6dbcc] drop-shadow-sm">{item.value !== undefined ? item.value : '00'}</p>
                      <p className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-base opacity-90 text-[#e6dbcc]">{item.label}</p>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>

          <section id="activities" className="py-32 px-6 md:px-12 bg-[#dccfb9]">
            <div className="max-w-5xl mx-auto">
              <RevealOnScroll delay={0} className="text-center mb-16">
                <h2 className="font-title text-5xl md:text-7xl text-[#6c5d84] mb-6">Local Favorites</h2>
                <div className="h-px w-24 bg-[#6c5d84]/40 mx-auto"></div>
                <p className="mt-8 font-details text-[#333036] text-lg max-w-2xl mx-auto">If you have some extra time during the weekend, here are a few of our favorite spots to eat, drink, and explore.</p>
              </RevealOnScroll>
              
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
                {[
                  { name: "Reading Terminal Market", desc: "A historic public market in Philly with incredible food stalls. Grab a roast pork sandwich!", delay: 100 },
                  { name: "Sharrott Winery", desc: "Located nearby in South Jersey, this is a beautiful spot to relax with a glass of wine and live music.", delay: 200 },
                  { name: "Philadelphia Historic District", desc: "Take a stroll past the Liberty Bell and Independence Hall just across the bridge.", delay: 300 }
                ].map((item, i) => (
                  <RevealOnScroll key={i} delay={item.delay}>
                    <div className="p-8 border border-[#333036]/10 bg-[#e6dbcc]/80 h-full flex flex-col justify-center text-center space-y-4 hover:shadow-md transition-shadow">
                      <h4 className="font-subtitle text-xl md:text-2xl tracking-normal text-[#6c5d84]">{item.name}</h4>
                      <p className="font-details text-[#333036] leading-relaxed">{item.desc}</p>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>

          <section ref={registrySectionRef} id="registry" className="relative py-40 flex items-center justify-center overflow-hidden">
            <div ref={registryBgRef} className="absolute -top-[25%] left-0 w-full h-[150%] bg-cover bg-center z-0 will-change-transform" style={{ backgroundImage: "url('/registry.jpg')" }}></div>
            <RevealOnScroll delay={0} className="relative z-10 text-center max-w-2xl px-6 bg-[#e6dbcc]/90 backdrop-blur-sm p-16 md:p-24 border border-[#333036]/10 shadow-2xl">
              <h2 className="font-title text-5xl md:text-7xl text-[#6c5d84] mb-6">Registry</h2>
              <p className="font-details text-[#333036] text-xl leading-relaxed mb-12">Your presence at our wedding is the greatest gift we could ask for. Should you wish to honor us with a gift, we are registered at the links below.</p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <a href="#" className="font-subtitle border border-[#6c5d84] text-[#6c5d84] px-8 py-4 tracking-[0.15em] uppercase text-xs hover:bg-[#6c5d84] hover:text-[#e6dbcc] transition-colors text-center">Cash Fund</a>
                <a href="#" className="font-subtitle border border-[#6c5d84] text-[#6c5d84] px-8 py-4 tracking-[0.15em] uppercase text-xs hover:bg-[#6c5d84] hover:text-[#e6dbcc] transition-colors text-center">Amazon</a>
              </div>
            </RevealOnScroll>
          </section>

          <section id="faq" className="py-32 px-6 md:px-12 bg-[#dccfb9]">
            <div className="max-w-3xl mx-auto">
              <RevealOnScroll delay={0} className="text-center mb-16">
                <h2 className="font-title text-5xl md:text-7xl text-[#6c5d84] mb-6">FAQ</h2>
                <div className="h-px w-24 bg-[#6c5d84]/40 mx-auto"></div>
              </RevealOnScroll>
              
              <div className="space-y-12">
                {[
                  { q: "What is the dress code?", a: "We request formal / black-tie optional attire. Please avoid wearing white." },
                  { q: "Are children invited?", a: "While we love your little ones, our wedding is going to be an adults-only event so that everyone can relax and enjoy the evening. We appreciate you making arrangements ahead of time." },
                  { q: "Will there be parking at the venue?", a: "Yes, Lucien's Manor offers complimentary valet and self-parking for all guests." },
                  { q: "When is the RSVP deadline?", a: "Please kindly respond by April 29th using the form below so we can have a final headcount." }
                ].map((faq, i) => (
                  <RevealOnScroll key={i} delay={i * 100}>
                    <div className="text-center md:text-left border-b border-[#333036]/10 pb-8">
                      <h4 className="font-subtitle text-xl md:text-2xl tracking-normal text-[#6c5d84] mb-3">{faq.q}</h4>
                      <p className="font-details text-[#333036] text-lg leading-relaxed">{faq.a}</p>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>

          {/* RSVP SECTION WITH FLORAL BACKGROUND AND PARALLAX */}
          <section ref={rsvpSectionRef} id="rsvp" className="relative min-h-screen flex items-center justify-center py-24 px-6 overflow-hidden border-t border-[#6c5d84]/15">
            <div ref={rsvpBgRef} className="absolute -top-[25%] left-0 w-full h-[150%] bg-cover bg-center z-0 will-change-transform" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618108571494-7065bc619e68?q=80&w=1227&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')" }}></div>
            <div className="absolute inset-0 bg-[#e6dbcc]/85 backdrop-blur-sm z-10 pointer-events-none"></div>

            <div className="max-w-xl w-full text-center relative z-20">
              <RevealOnScroll delay={0} className="space-y-4 mb-16">
                <p className="font-subtitle tracking-[0.15em] uppercase text-xs md:text-sm uppercase text-[#333036]">We eagerly await your reply</p>
                <h2 className="font-title text-5xl md:text-7xl text-[#6c5d84]">RSVP</h2>
              </RevealOnScroll>

              <RevealOnScroll delay={150} className="relative w-full max-w-md mx-auto">
                <form onSubmit={handleGuestSearch} className="relative flex items-center border-b border-[#333036] group">
                  <Search className="absolute left-2 text-[#6c5d84] w-5 h-5 transition-colors group-focus-within:text-[#333036]" />
                  <input type="text" placeholder="Enter Full Name" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setSearchError(''); }} className="w-full pl-10 pr-28 py-4 bg-transparent outline-none text-lg md:text-xl text-[#333036] placeholder:text-[#333036]/50 font-subtitle tracking-wide" />
                  <button type="submit" className="absolute right-0 font-subtitle text-xs tracking-[0.15em] uppercase text-[#333036] hover:text-[#6c5d84] transition-colors pr-2">Find RSVP</button>
                </form>
                
                {searchError && (
                  <p className="font-subtitle text-[#333036] text-xs mt-4 tracking-normal bg-[#d4a5a5]/30 py-3 px-4 rounded border border-[#d4a5a5]/50 uppercase">{searchError}</p>
                )}

                {searchResults.length > 0 && !searchError && (
                  <div className="absolute w-full mt-2 bg-[#e6dbcc] border border-[#333036]/20 shadow-2xl max-h-64 overflow-y-auto text-left z-50">
                    {searchResults.map((guest) => (
                      <button key={guest.id} onClick={() => { setSelectedHousehold({ name: guest.household, members: guests.filter(g => g.householdId === guest.householdId) }); setSearchTerm(''); setSearchResults([]); }} className="w-full text-left px-6 py-5 border-b border-[#333036]/10 last:border-0 hover:bg-[#6c5d84]/5 transition-colors">
                        <p className="font-subtitle text-2xl tracking-normal text-[#6c5d84]">{guest.name}</p>
                        <p className="font-subtitle text-xs tracking-widest uppercase text-[#333036] mt-2 opacity-80">{guest.household}</p>
                      </button>
                    ))}
                  </div>
                )}
              </RevealOnScroll>
            </div>
          </section>

          {selectedHousehold && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
              <div className="bg-[#e6dbcc] p-8 md:p-16 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-300 border border-[#333036]/10">
                <button onClick={() => setSelectedHousehold(null)} className="absolute top-8 right-8 text-[#6c5d84] hover:text-[#333036] transition-colors">
                  <X className="w-8 h-8 stroke-[1]" />
                </button>
                <div className="text-center mb-12">
                  <h2 className="font-title text-5xl text-[#6c5d84]">{selectedHousehold.name}</h2>
                  <div className="h-px w-16 bg-[#6c5d84]/40 mx-auto mt-6"></div>
                </div>
                <div className="space-y-12">
                  {selectedHousehold.members.map((member) => (
                    <div key={member.id} className="border-b border-[#333036]/10 pb-8 last:border-0 last:pb-0">
                      <h3 className="font-subtitle text-2xl tracking-normal text-[#6c5d84] mb-8">{member.name}</h3>
                      <div className="space-y-6 md:pl-4">
                        {member.events?.map(event => (
                          <div key={event} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <span className="font-subtitle text-[#333036] tracking-[0.1em] uppercase text-sm">{event}</span>
                            <div className="flex gap-4">
                              <button onClick={() => handleRsvpChange(member.id, event, 'yes')} className={`font-subtitle px-8 py-3 border text-xs tracking-[0.15em] uppercase transition-all duration-300 ${member.rsvps?.[event] === 'yes' ? 'bg-[#6c5d84] text-[#e6dbcc] border-[#6c5d84]' : 'border-[#333036]/30 text-[#333036] hover:border-[#6c5d84]'}`}>Accept</button>
                              <button onClick={() => handleRsvpChange(member.id, event, 'no')} className={`font-subtitle px-8 py-3 border text-xs tracking-[0.15em] uppercase transition-all duration-300 ${member.rsvps?.[event] === 'no' ? 'bg-[#d4a5a5] text-[#333036] border-[#d4a5a5]' : 'border-[#333036]/30 text-[#333036] hover:border-[#d4a5a5]'}`}>Decline</button>
                            </div>
                          </div>
                        ))}
                        {(!member.events || member.events.length === 0) && <p className="font-details text-lg text-[#333036]/60 italic">No events assigned.</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-16 text-center">
                  <button onClick={() => setSelectedHousehold(null)} className="font-subtitle bg-[#6c5d84] text-[#e6dbcc] px-12 py-4 tracking-[0.15em] uppercase text-xs hover:bg-[#524569] transition-colors shadow-lg">Complete RSVP</button>
                </div>
              </div>
            </div>
          )}

          <footer className="py-12 bg-[#e6dbcc] border-t border-[#6c5d84]/15 text-center relative z-20">
            <p className="font-title text-[#6c5d84] text-2xl">J & S</p>
          </footer>
        </>
      )}

      {/* =========================================
          ADMIN DASHBOARD UI (Accessed ONLY via /admin)
          ========================================= */}
      {isAdminRoute && (
        <div className="min-h-screen p-4 flex flex-col items-center bg-[#e6dbcc] font-sans text-[#333036]">
          
          {!isAdmin && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
              <form onSubmit={handleAdminLogin} className="bg-[#dccfb9] p-8 md:p-12 rounded shadow-2xl flex flex-col items-center border-t-4 border-[#6c5d84] animate-in zoom-in-95">
                <Lock className="w-8 h-8 text-[#6c5d84] mb-4" />
                <h3 className="font-sans font-bold text-2xl text-[#333036] mb-8">Admin Access</h3>
                <input type="password" placeholder="Enter PIN" value={pin} onChange={(e) => setPin(e.target.value)} className="border border-[#333036]/30 bg-[#e6dbcc] px-4 py-3 text-center text-2xl tracking-widest focus:border-[#6c5d84] outline-none mb-8 w-56 font-sans font-bold text-[#333036]" autoFocus />
                <div className="flex gap-4 w-full">
                  <button type="button" onClick={() => { window.location.href = '/'; }} className="flex-1 border border-[#333036]/30 text-[#333036] hover:bg-[#333036]/5 py-3 text-xs tracking-widest uppercase transition-colors font-sans font-bold">Back to Site</button>
                  <button type="submit" className="flex-1 bg-[#6c5d84] text-[#e6dbcc] py-3 text-xs tracking-widest uppercase hover:bg-[#524569] transition-colors font-sans font-bold">Login</button>
                </div>
              </form>
            </div>
          )}

          {isAdmin && (
            <div className="w-full max-w-6xl bg-[#dccfb9] rounded-lg shadow-xl overflow-hidden min-h-[80vh] flex flex-col mt-4 border border-[#6c5d84]/20">
              
              <div className="bg-[#6c5d84] text-[#e6dbcc] p-6 flex justify-between items-center">
                <h2 className="font-sans font-bold text-2xl tracking-wide">Guest & RSVP Management</h2>
                <a href="/" className="text-sm font-sans font-bold tracking-[0.1em] uppercase opacity-90 hover:opacity-100">Exit to Site</a>
              </div>

              <div className="flex border-b border-[#333036]/15 bg-[#d2c4ae] text-sm font-sans font-bold tracking-wide text-[#333036] overflow-x-auto">
                <button onClick={() => setDashboardTab('stats')} className={`px-8 py-4 uppercase whitespace-nowrap ${dashboardTab === 'stats' ? 'text-[#6c5d84] border-b-2 border-[#6c5d84] bg-[#e6dbcc]' : 'hover:bg-[#d9cca8]'}`}>Overview & Stats</button>
                <button onClick={() => setDashboardTab('list')} className={`px-8 py-4 uppercase whitespace-nowrap ${dashboardTab === 'list' ? 'text-[#6c5d84] border-b-2 border-[#6c5d84] bg-[#e6dbcc]' : 'hover:bg-[#d9cca8]'}`}>Guest List Editor</button>
              </div>

              {dashboardTab === 'stats' && (
                <div className="p-8 space-y-8 flex-1 font-sans">
                  <div className="grid md:grid-cols-2 gap-8">
                    {allUniqueEvents.length === 0 ? (
                      <div className="col-span-2 text-center py-12 border-2 border-dashed border-[#333036]/20 rounded-lg text-[#333036]/60 font-sans">No events or guests found in the database.</div>
                    ) : (
                      allUniqueEvents.map(eventName => {
                        const stats = calcStats(eventName);
                        return (
                          <div key={eventName} className="bg-[#e6dbcc] p-6 rounded border border-[#6c5d84]/20">
                            <h3 className="font-sans font-bold text-xl text-[#6c5d84] mb-6">{eventName}</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-[#dccfb9] p-4 rounded shadow-sm text-center border border-[#333036]/10">
                                <p className="text-3xl text-[#333036] font-sans font-bold">{stats.total}</p>
                                <p className="text-xs uppercase tracking-widest text-[#6c5d84] mt-1 font-sans font-bold">Invited</p>
                              </div>
                              <div className="bg-[#dccfb9] p-4 rounded shadow-sm text-center border border-[#333036]/10">
                                <p className="text-3xl text-[#6c5d84] font-sans font-bold">{stats.yes}</p>
                                <p className="text-xs uppercase tracking-widest text-[#6c5d84] mt-1 font-sans font-bold">Accepted</p>
                              </div>
                              <div className="bg-[#dccfb9] p-4 rounded shadow-sm text-center border border-[#333036]/10">
                                <p className="text-3xl text-[#333036] font-sans font-bold">{stats.no}</p>
                                <p className="text-xs uppercase tracking-widest text-[#6c5d84] mt-1 font-sans font-bold">Declined</p>
                              </div>
                              <div className="bg-[#dccfb9] p-4 rounded shadow-sm text-center border border-[#333036]/10">
                                <p className="text-3xl text-[#333036] font-sans font-bold">{stats.pending}</p>
                                <p className="text-xs uppercase tracking-widest text-[#6c5d84] mt-1 font-sans font-bold">Pending</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-8 pt-8 border-t border-[#333036]/15">
                    <h3 className="font-sans font-bold text-xl text-[#333036] mb-4">Bulk Upload Guests</h3>
                    <label className="flex items-center gap-2 cursor-pointer bg-[#e6dbcc] border border-[#6c5d84] text-[#6c5d84] px-6 py-3 rounded-sm hover:bg-[#6c5d84] hover:text-[#e6dbcc] transition-colors w-max font-sans font-bold">
                      <Upload className="w-5 h-5" />
                      <span className="uppercase tracking-wider text-sm">Select CSV File</span>
                      <input type="file" accept=".csv" onChange={processCsvUpload} className="hidden" />
                    </label>
                    <p className="text-xs text-[#333036]/70 mt-2 font-sans">Required columns: Name, Household, Events. Optional: Household #, Age Range.</p>
                  </div>
                </div>
              )}

              {dashboardTab === 'list' && (
                <div className="flex-1 flex flex-col max-h-[80vh] font-sans">
                  <div className="p-4 border-b border-[#333036]/15 flex flex-wrap gap-4 justify-between items-center bg-[#d2c4ae]">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333036]/50 w-4 h-4" />
                      <input type="text" placeholder="Search by Name, Household, or ID..." value={dashboardSearch} onChange={(e) => setDashboardSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-[#333036]/30 bg-[#e6dbcc] rounded outline-none focus:border-[#6c5d84] text-sm text-[#333036] font-sans" />
                      {dashboardSearch && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#333036]/50 hover:text-[#333036]"><X className="w-4 h-4" /></button>}
                    </div>
                    <div className="flex gap-4 font-sans font-bold">
                      <button onClick={handleOpenAddForm} className="flex items-center gap-2 bg-[#6c5d84] text-[#e6dbcc] px-4 py-2 rounded-sm text-sm uppercase tracking-wider hover:bg-[#524569] transition-colors"><UserPlus className="w-4 h-4" /> Add Household</button>
                      <button onClick={exportToCsv} className="flex items-center gap-2 bg-[#e6dbcc] border border-[#6c5d84] text-[#6c5d84] px-4 py-2 rounded-sm text-sm uppercase tracking-wider hover:bg-[#d2c4ae] transition-colors"><Download className="w-4 h-4" /> Export CSV</button>
                    </div>
                  </div>

                  {showAddForm && (
                    <div className="bg-[#d2c4ae] p-6 border-b border-[#333036]/15 font-sans">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-sans font-bold text-lg text-[#333036]">Add New Guests</h3>
                        <div className="text-right">
                          <p className="text-xs text-[#333036]/70 uppercase tracking-widest font-sans font-bold">Household #</p>
                          <input type="text" value={newHouseholdId} onChange={(e) => setNewHouseholdId(e.target.value)} className="w-24 text-sm p-1 border border-[#333036]/30 bg-[#e6dbcc] rounded outline-none focus:border-[#6c5d84] text-center font-sans" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <input type="text" placeholder="Household Name (e.g. The Doe Family)" value={newHouseholdName} onChange={(e) => setNewHouseholdName(e.target.value)} className="w-full md:w-1/2 p-2 border border-[#333036]/30 bg-[#e6dbcc] rounded outline-none focus:border-[#6c5d84] font-sans" />
                        <div className="flex items-center gap-2 bg-[#e6dbcc] p-3 rounded border border-[#333036]/20 shadow-sm w-full md:w-1/2">
                          <span className="text-xs uppercase text-[#333036]/70 font-sans font-bold">Create New Event Type:</span>
                          <input type="text" placeholder="e.g. Sangeet" value={newCustomEvent} onChange={(e) => setNewCustomEvent(e.target.value)} className="flex-1 text-sm p-1 border-b border-[#333036]/30 bg-transparent outline-none focus:border-[#6c5d84] font-sans" />
                          <button onClick={handleAddCustomEventToForm} className="text-xs bg-[#d2c4ae] px-3 py-1 rounded hover:bg-[#c4b59f] transition-colors font-sans font-bold">Add</button>
                        </div>

                        {newMembers.map((member, index) => (
                          <div key={index} className="flex flex-col gap-4 bg-[#e6dbcc] p-4 rounded border border-[#333036]/20 shadow-sm font-sans">
                            <div className="flex flex-wrap items-center gap-4">
                              <input type="text" placeholder="Guest Full Name" value={member.name} onChange={(e) => handleUpdateMember(index, 'name', e.target.value)} className="flex-1 min-w-[200px] p-2 border border-[#333036]/30 rounded outline-none focus:border-[#6c5d84] bg-[#e6dbcc] font-sans" />
                              <select value={member.ageRange} onChange={(e) => handleUpdateMember(index, 'ageRange', e.target.value)} className="p-2 border border-[#333036]/30 rounded outline-none focus:border-[#6c5d84] bg-[#e6dbcc] font-sans">
                                <option value="Adult">Adult</option><option value="Child">Child</option><option value="Infant">Infant</option>
                              </select>
                              {newMembers.length > 1 && <button onClick={() => handleRemoveMemberRow(index)} className="text-[#333036]/70 hover:text-[#333036] ml-auto"><Trash2 className="w-5 h-5" /></button>}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 border-t border-[#333036]/10 pt-3">
                              <span className="text-xs uppercase text-[#333036]/60 w-full md:w-auto font-sans font-bold">Invited To:</span>
                              {formAvailableEvents.length === 0 && <span className="text-xs text-[#333036]/50 italic font-sans">No events defined yet. Add one above.</span>}
                              {formAvailableEvents.map(evt => (
                                <label key={evt} className="flex items-center gap-1.5 text-sm text-[#333036] cursor-pointer bg-[#d2c4ae] px-2 py-1 rounded border border-[#333036]/20 font-sans">
                                  <input type="checkbox" checked={member.events.includes(evt)} onChange={() => handleUpdateMember(index, 'events', evt)} className="accent-[#6c5d84]" /> {evt}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-4 pt-2 font-sans font-bold">
                          <button onClick={handleAddMemberRow} className="text-[#6c5d84] text-sm uppercase tracking-wider flex items-center gap-1 hover:text-[#333036]"><Plus className="w-4 h-4" /> Add Person to Household</button>
                          <button onClick={submitNewHousehold} className="bg-[#6c5d84] text-[#e6dbcc] px-6 py-2 rounded-sm text-sm uppercase tracking-wider ml-auto hover:bg-[#524569]">Save to Guest List</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-auto bg-[#e6dbcc] font-sans">
                    <table className="w-full text-left border-collapse min-w-max font-sans">
                      <thead className="sticky top-0 bg-[#d2c4ae] border-b border-[#333036]/20 z-10 shadow-sm text-xs uppercase tracking-wider text-[#333036] font-sans font-bold">
                        <tr>
                          <th onClick={() => handleSort('name')} className="px-6 py-4 cursor-pointer hover:bg-[#c4b59f] transition-colors">Guest Name <SortIndicator columnKey="name" /></th>
                          <th onClick={() => handleSort('householdId')} className="px-6 py-4 cursor-pointer hover:bg-[#c4b59f] transition-colors">Household <SortIndicator columnKey="householdId" /></th>
                          <th onClick={() => handleSort('ageRange')} className="px-6 py-4 cursor-pointer hover:bg-[#c4b59f] transition-colors">Age Range <SortIndicator columnKey="ageRange" /></th>
                          {allUniqueEvents.map(evt => (
                            <th key={evt} onClick={() => handleSort(evt)} className="px-6 py-4 text-center cursor-pointer hover:bg-[#c4b59f] transition-colors">{evt} <SortIndicator columnKey={evt} /></th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="text-[#333036] font-sans">
                        {processedGuests.map((guest) => (
                          <tr key={guest.id} className="border-b border-[#333036]/10 hover:bg-[#dfd4c3] transition-colors font-sans">
                            <td className="px-6 py-3 font-sans font-bold text-[#333036]">{guest.name}</td>
                            <td className="px-6 py-3 font-sans">{guest.household} <span className="block text-xs text-[#333036]/60 mt-0.5 font-sans">ID: {guest.householdId}</span></td>
                            <td className="px-6 py-3 text-sm text-[#333036]/80 font-sans">{guest.ageRange || 'Adult'}</td>
                            {allUniqueEvents.map(evt => {
                              const isInvited = guest.events?.includes(evt);
                              const status = isInvited ? (guest.rsvps?.[evt] || 'pending') : 'not_invited';
                              return (
                                <td key={evt} className="px-6 py-3 text-center border-l border-[#333036]/10 font-sans">
                                  <select value={status} onChange={(e) => handleAdminEventAndRsvpUpdate(guest, evt, e.target.value)} className={`text-xs uppercase tracking-wider font-sans font-bold outline-none cursor-pointer border px-2 py-1 rounded transition-colors ${status === 'yes' ? 'bg-[#6c5d84]/20 text-[#6c5d84] border-[#6c5d84]/50' : status === 'no' ? 'bg-[#d4a5a5]/30 text-[#333036] border-[#d4a5a5]/60' : status === 'not_invited' ? 'bg-[#d2c4ae] text-[#333036]/50 border-transparent hover:border-[#333036]/30' : 'bg-[#b0c4de]/30 text-[#333036] border-[#b0c4de]/60'}`}>
                                    <option value="not_invited">Not Invited</option>
                                    <option value="pending">Pending</option>
                                    <option value="yes">Accepted</option>
                                    <option value="no">Declined</option>
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {processedGuests.length === 0 && (
                      <div className="text-center py-12 text-[#333036]/60 font-sans font-bold text-lg">
                        {dashboardSearch ? `No guests found matching "${dashboardSearch}"` : 'No guests added yet. Upload a CSV or add a household manually.'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}