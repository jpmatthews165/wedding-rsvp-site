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
  
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pin, setPin] = useState('');
  const [dashboardTab, setDashboardTab] = useState('stats'); 
  
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  const [allUniqueEvents, setAllUniqueEvents] = useState([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdId, setNewHouseholdId] = useState('');
  const [newCustomEvent, setNewCustomEvent] = useState('');
  const [formAvailableEvents, setFormAvailableEvents] = useState([]);
  const [newMembers, setNewMembers] = useState([{ name: '', ageRange: 'Adult', events: [] }]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState({});
  
  const heroBgRef = useRef(null);
  const registrySectionRef = useRef(null);
  const registryBgRef = useRef(null);

  const weddingDate = new Date('May 29, 2027 10:00:00').getTime();

  useEffect(() => {
    signInAnonymously(auth).catch(error => console.error("Auth error:", error));
    const unsubscribe = onSnapshot(collection(db, 'guests'), (snapshot) => {
      const guestData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGuests(guestData);
      const uniqueEvents = Array.from(new Set(guestData.flatMap(g => g.events || []))).sort();
      setAllUniqueEvents(uniqueEvents);
      setFormAvailableEvents(prev => Array.from(new Set([...prev, ...uniqueEvents])).sort());
    });
    return () => unsubscribe();
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
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (heroBgRef.current) {
            const scrollPosition = window.scrollY;
            heroBgRef.current.style.transform = `translate3d(0, ${scrollPosition * 0.4}px, 0)`;
          }
          if (registrySectionRef.current && registryBgRef.current) {
            const rect = registrySectionRef.current.getBoundingClientRect();
            registryBgRef.current.style.transform = `translate3d(0, ${rect.top * -0.2}px, 0)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); 
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
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
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue, bValue;
        if (['name', 'household', 'ageRange'].includes(sortConfig.key)) {
          aValue = (a[sortConfig.key] || '').toLowerCase();
          bValue = (b[sortConfig.key] || '').toLowerCase();
        } else {
          aValue = a.events?.includes(sortConfig.key) ? (a.rsvps?.[sortConfig.key] || 'pending') : 'zzz_not_invited';
          bValue = b.events?.includes(sortConfig.key) ? (b.rsvps?.[sortConfig.key] || 'pending') : 'zzz_not_invited';
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
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

  const StatusIcon = ({ isInvited, status }) => {
    if (!isInvited) return <span className="text-[#a2ae99] text-sm">-</span>;
    if (status === 'yes') return <CheckCircle2 className="w-5 h-5 text-green-700 mx-auto" />;
    if (status === 'no') return <XCircle className="w-5 h-5 text-red-700 mx-auto" />;
    return <Circle className="w-5 h-5 text-gray-300 mx-auto" />;
  };

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-2 inline text-gray-400 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1 inline text-[#723332]" /> : <ChevronDown className="w-4 h-4 ml-1 inline text-[#723332]" />;
  };

  // --------------------------------------------------------
  // RENDER UI
  // --------------------------------------------------------
  return (
    <div className="bg-[#f1ece0] text-[#723332] font-details selection:bg-[#723332] selection:text-[#f1ece0] overflow-x-hidden">
      
      {/* =========================================
          WEDDING WEBSITE (GUEST FACING)
          ========================================= */}
      {!isAdmin && (
        <>
          <header className="fixed top-0 left-0 w-full z-50 bg-[#f1ece0]/80 backdrop-blur-md border-b border-[#723332]/10 transition-all duration-300">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
              <span className="font-title text-3xl tracking-wide text-[#723332]">Josh & Sneha</span>
              <button onClick={() => setIsMenuOpen(true)} className="text-[#4b483c] hover:text-[#723332] transition-colors">
                <Menu className="w-8 h-8 stroke-[1.5]" />
              </button>
            </div>
          </header>

          {/* FULL SCREEN MENU OVERLAY WITH SMOOTH CSS TRANSITIONS */}
          <div 
            className={`fixed inset-0 bg-[#f1ece0] z-[100] flex flex-col items-center justify-center transition-all duration-500 ease-in-out ${
              isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 text-[#4b483c] hover:text-[#723332] transition-colors">
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
                  className={`font-title text-4xl md:text-6xl text-[#723332] hover:text-[#4b483c] transition-all duration-500 tracking-wide ${
                    isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                  }`}
                  style={{ transitionDelay: isMenuOpen ? `${index * 50}ms` : '0ms' }}
                >
                  {item.name}
                </button>
              ))}
            </nav>
          </div>

          <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden bg-[#f1ece0]">
            <div ref={heroBgRef} className="absolute -top-[25%] left-0 w-full h-[150%] bg-cover bg-center z-0 will-change-transform" style={{ backgroundImage: "url('/hero.jpg')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-b from-[#f1ece0] via-[#f1ece0]/40 to-transparent z-10 pointer-events-none"></div>
            <RevealOnScroll className="relative z-20 text-center space-y-8 p-4 -mt-32 md:-mt-48">
              <p className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-base text-[#4b483c]">We invite you to celebrate with us</p>
              <h1 className="font-title text-7xl md:text-[10rem] leading-none text-[#723332] drop-shadow-sm">Josh &<br />Sneha</h1>
            </RevealOnScroll>
          </section>

          <section id="details" className="relative flex items-center justify-center py-32 px-6 md:px-12 bg-[#f1ece0]">
            <div className="max-w-6xl w-full grid md:grid-cols-2 gap-16 md:gap-24 items-center">
              <div className="space-y-10 text-center md:text-left">
                <RevealOnScroll>
                  <h2 className="font-title text-5xl md:text-7xl text-[#723332] mb-6">The Wedding</h2>
                  <div className="h-px w-24 bg-[#4b483c] mx-auto md:mx-0"></div>
                </RevealOnScroll>
                <RevealOnScroll delay={100} className="space-y-2">
                  <p className="font-subtitle tracking-[0.1em] uppercase text-sm md:text-base text-[#4b483c]">When</p>
                  <p className="font-title text-4xl md:text-5xl text-[#723332]">Saturday, May 29th</p>
                  <p className="font-details text-xl text-[#4b483c] tracking-wide mt-2">Ten O'Clock in the Morning</p>
                </RevealOnScroll>
                <RevealOnScroll delay={200} className="space-y-2">
                  <p className="font-subtitle tracking-[0.1em] uppercase text-sm md:text-base text-[#4b483c]">Where</p>
                  <p className="font-title text-4xl md:text-5xl text-[#723332]">Lucien's Manor</p>
                  <p className="font-details text-xl text-[#4b483c] tracking-wide mt-2">81 W White Horse Pike<br/>Berlin, NJ 08009</p>
                </RevealOnScroll>
                <RevealOnScroll delay={300}>
                  <div className="w-full h-64 mt-8 relative overflow-hidden rounded shadow-sm bg-[#e8e2d4] z-10">
                    <iframe src="https://maps.google.com/maps?q=Lucien's+Manor,+81+W+White+Horse+Pike,+Berlin,+NJ&t=&z=14&ie=UTF8&iwloc=&output=embed" title="Lucien's Manor Map" className="absolute inset-0 w-full h-full opacity-80 mix-blend-multiply grayscale" style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
                  </div>
                </RevealOnScroll>
              </div>
              <RevealOnScroll delay={200}>
                <div className="relative h-[80vh] w-full bg-[#e8e2d4] overflow-hidden rounded-sm z-10 shadow-lg">
                  <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: "url('/details.jpg')" }}></div>
                </div>
              </RevealOnScroll>
            </div>
          </section>

          <section id="travel" className="py-32 px-6 md:px-12 bg-[#f1ece0] border-t border-[#723332]/10">
            <div className="max-w-5xl mx-auto text-center">
              <RevealOnScroll>
                <h2 className="font-title text-5xl md:text-7xl text-[#723332] mb-6">Travel & Stay</h2>
                <div className="h-px w-24 bg-[#4b483c] mx-auto mb-16"></div>
              </RevealOnScroll>
              <div className="grid md:grid-cols-2 gap-16 text-left">
                <RevealOnScroll delay={100} className="space-y-8">
                  <h3 className="font-subtitle text-3xl md:text-4xl tracking-normal text-[#723332]">Getting Here</h3>
                  <p className="font-details text-lg text-[#4b483c] leading-relaxed">For our out-of-town guests, there are two primary airports we recommend flying into:</p>
                  <ul className="space-y-6">
                    <li className="border-l-2 border-[#723332]/30 pl-4">
                      <span className="font-subtitle text-lg tracking-normal block text-[#723332]">Philadelphia International (PHL)</span>
                      <span className="font-details text-[#4b483c] leading-relaxed">Approx. 40 minutes from the venue. The most convenient option.</span>
                    </li>
                    <li className="border-l-2 border-[#723332]/30 pl-4">
                      <span className="font-subtitle text-lg tracking-normal block text-[#723332]">Newark Liberty International (EWR)</span>
                      <span className="font-details text-[#4b483c] leading-relaxed">Approx. 90 minutes from the venue. May offer more direct flights.</span>
                    </li>
                  </ul>
                </RevealOnScroll>
                <RevealOnScroll delay={200} className="space-y-8">
                  <h3 className="font-subtitle text-3xl md:text-4xl tracking-normal text-[#723332]">Accommodations</h3>
                  <p className="font-details text-lg text-[#4b483c] leading-relaxed">We have secured a block of rooms at a special rate for our guests. Please book before April 29th to ensure availability.</p>
                  <div className="bg-white p-8 shadow-sm border border-[#723332]/10 space-y-4">
                    <p className="font-subtitle text-2xl md:text-3xl tracking-normal text-[#723332]">The Grand Hotel Placeholder</p>
                    <p className="font-details text-lg text-[#4b483c]">123 Hotel Avenue, Mount Laurel, NJ</p>
                    <div className="pt-4 space-y-2">
                      <p className="font-subtitle text-xs uppercase tracking-[0.15em] text-[#4b483c]">Discount Code</p>
                      <p className="font-subtitle text-lg tracking-normal text-[#723332]">MATTHEWS27</p>
                    </div>
                    <button className="mt-4 font-subtitle border border-[#723332] text-[#723332] px-6 py-3 text-xs tracking-[0.15em] uppercase hover:bg-[#723332] hover:text-white transition-colors w-full">Book Room</button>
                  </div>
                </RevealOnScroll>
              </div>
            </div>
          </section>

          {/* COUNTDOWN SECTION - Inserted After Travel */}
          <section className="py-24 bg-[#723332] text-[#f1ece0] relative z-20">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <RevealOnScroll>
                <p className="font-subtitle tracking-[0.15em] uppercase text-xs md:text-sm mb-12 opacity-80">Counting down the days</p>
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
                      <p className="font-title text-6xl md:text-7xl font-light">{item.value !== undefined ? item.value : '00'}</p>
                      <p className="font-subtitle tracking-[0.15em] uppercase text-xs opacity-70">{item.label}</p>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>

          <section id="activities" className="py-32 px-6 md:px-12 bg-white">
            <div className="max-w-5xl mx-auto">
              <RevealOnScroll className="text-center mb-16">
                <h2 className="font-title text-5xl md:text-7xl text-[#723332] mb-6">Local Favorites</h2>
                <div className="h-px w-24 bg-[#4b483c] mx-auto"></div>
                <p className="mt-8 font-details text-[#4b483c] text-lg max-w-2xl mx-auto">If you have some extra time during the weekend, here are a few of our favorite spots to eat, drink, and explore.</p>
              </RevealOnScroll>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
                {[
                  { name: "Reading Terminal Market", desc: "A historic public market in Philly with incredible food stalls. Grab a roast pork sandwich!", delay: 100 },
                  { name: "Sharrott Winery", desc: "Located nearby in South Jersey, this is a beautiful spot to relax with a glass of wine and live music.", delay: 200 },
                  { name: "Philadelphia Historic District", desc: "Take a stroll past the Liberty Bell and Independence Hall just across the bridge.", delay: 300 }
                ].map((item, i) => (
                  <RevealOnScroll key={i} delay={item.delay}>
                    <div className="p-8 border border-[#723332]/10 bg-[#f1ece0]/30 h-full flex flex-col justify-center text-center space-y-4 hover:shadow-md transition-shadow">
                      <h4 className="font-subtitle text-xl md:text-2xl tracking-normal text-[#723332]">{item.name}</h4>
                      <p className="font-details text-[#4b483c] leading-relaxed">{item.desc}</p>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>

          <section ref={registrySectionRef} id="registry" className="relative py-40 flex items-center justify-center overflow-hidden">
            <div ref={registryBgRef} className="absolute -top-[25%] left-0 w-full h-[150%] bg-cover bg-center z-0 will-change-transform" style={{ backgroundImage: "url('/registry.jpg')" }}></div>
            <RevealOnScroll className="relative z-10 text-center max-w-2xl px-6 bg-[#f1ece0]/90 backdrop-blur-sm p-16 md:p-24 border border-[#723332]/10 shadow-2xl">
              <h2 className="font-title text-5xl md:text-7xl text-[#723332] mb-6">Registry</h2>
              <p className="font-details text-[#4b483c] text-xl leading-relaxed mb-12">Your presence at our wedding is the greatest gift we could ask for. Should you wish to honor us with a gift, we are registered at the links below.</p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <a href="#" className="font-subtitle border border-[#723332] text-[#723332] px-8 py-4 tracking-[0.15em] uppercase text-xs hover:bg-[#723332] hover:text-[#f1ece0] transition-colors text-center">Cash Fund</a>
                <a href="#" className="font-subtitle border border-[#723332] text-[#723332] px-8 py-4 tracking-[0.15em] uppercase text-xs hover:bg-[#723332] hover:text-[#f1ece0] transition-colors text-center">Amazon</a>
              </div>
            </RevealOnScroll>
          </section>

          <section id="faq" className="py-32 px-6 md:px-12 bg-white">
            <div className="max-w-3xl mx-auto">
              <RevealOnScroll className="text-center mb-16">
                <h2 className="font-title text-5xl md:text-7xl text-[#723332] mb-6">FAQ</h2>
                <div className="h-px w-24 bg-[#4b483c] mx-auto"></div>
              </RevealOnScroll>
              <div className="space-y-12">
                {[
                  { q: "What is the dress code?", a: "We request formal / black-tie optional attire. Please avoid wearing white." },
                  { q: "Are children invited?", a: "While we love your little ones, our wedding is going to be an adults-only event so that everyone can relax and enjoy the evening. We appreciate you making arrangements ahead of time." },
                  { q: "Will there be parking at the venue?", a: "Yes, Lucien's Manor offers complimentary valet and self-parking for all guests." },
                  { q: "When is the RSVP deadline?", a: "Please kindly respond by April 29th using the form below so we can have a final headcount." }
                ].map((faq, i) => (
                  <RevealOnScroll key={i} delay={i * 100}>
                    <div className="text-center md:text-left border-b border-[#723332]/10 pb-8">
                      <h4 className="font-subtitle text-xl md:text-2xl tracking-normal text-[#723332] mb-3">{faq.q}</h4>
                      <p className="font-details text-[#4b483c] text-lg leading-relaxed">{faq.a}</p>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>

          <section id="rsvp" className="min-h-screen flex items-center justify-center py-24 px-6 bg-[#f1ece0] relative z-20 border-t border-[#723332]/10">
            <div className="max-w-xl w-full text-center">
              <RevealOnScroll className="space-y-4 mb-16">
                <p className="font-subtitle tracking-[0.15em] text-xs md:text-sm uppercase text-[#4b483c]">We eagerly await your reply</p>
                <h2 className="font-title text-5xl md:text-7xl text-[#723332]">RSVP</h2>
              </RevealOnScroll>

              <RevealOnScroll delay={150} className="relative w-full max-w-md mx-auto">
                <form onSubmit={handleGuestSearch} className="relative flex items-center border-b border-[#723332] group">
                  <Search className="absolute left-2 text-[#4b483c] w-5 h-5 transition-colors group-focus-within:text-[#723332]" />
                  <input type="text" placeholder="Enter Full Name" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setSearchError(''); }} className="w-full pl-10 pr-28 py-4 bg-transparent outline-none text-lg md:text-xl text-[#723332] placeholder:text-[#723332]/40 font-subtitle tracking-wide" />
                  <button type="submit" className="absolute right-0 font-subtitle text-xs tracking-[0.15em] uppercase text-[#723332] hover:text-[#4b483c] transition-colors pr-2">Find RSVP</button>
                </form>
                
                {searchError && (
                  <p className="font-subtitle text-red-700/80 text-xs mt-4 tracking-normal bg-red-50 py-3 px-4 rounded border border-red-200 uppercase">{searchError}</p>
                )}

                {searchResults.length > 0 && !searchError && (
                  <div className="absolute w-full mt-2 bg-[#f1ece0] border border-[#723332]/20 shadow-2xl max-h-64 overflow-y-auto text-left z-50">
                    {searchResults.map((guest) => (
                      <button key={guest.id} onClick={() => { setSelectedHousehold({ name: guest.household, members: guests.filter(g => g.householdId === guest.householdId) }); setSearchTerm(''); setSearchResults([]); }} className="w-full text-left px-6 py-5 border-b border-[#723332]/10 last:border-0 hover:bg-[#4b483c]/5 transition-colors">
                        <p className="font-subtitle text-2xl tracking-normal text-[#723332]">{guest.name}</p>
                        <p className="font-subtitle text-xs tracking-widest uppercase text-[#4b483c] mt-2 opacity-70">{guest.household}</p>
                      </button>
                    ))}
                  </div>
                )}
              </RevealOnScroll>
            </div>
          </section>

          {selectedHousehold && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
              <div className="bg-[#f1ece0] p-8 md:p-16 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-300">
                <button onClick={() => setSelectedHousehold(null)} className="absolute top-8 right-8 text-[#4b483c] hover:text-[#723332] transition-colors">
                  <X className="w-8 h-8 stroke-[1]" />
                </button>
                <div className="text-center mb-12">
                  <h2 className="font-title text-5xl text-[#723332]">{selectedHousehold.name}</h2>
                  <div className="h-px w-16 bg-[#4b483c] mx-auto mt-6"></div>
                </div>
                <div className="space-y-12">
                  {selectedHousehold.members.map((member) => (
                    <div key={member.id} className="border-b border-[#723332]/10 pb-8 last:border-0 last:pb-0">
                      <h3 className="font-subtitle text-2xl tracking-normal text-[#723332] mb-8">{member.name}</h3>
                      <div className="space-y-6 md:pl-4">
                        {member.events?.map(event => (
                          <div key={event} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <span className="font-subtitle text-[#4b483c] tracking-[0.1em] uppercase text-sm">{event}</span>
                            <div className="flex gap-4">
                              <button onClick={() => handleRsvpChange(member.id, event, 'yes')} className={`font-subtitle px-8 py-3 border text-xs tracking-[0.15em] uppercase transition-all duration-300 ${member.rsvps?.[event] === 'yes' ? 'bg-[#723332] text-[#f1ece0] border-[#723332]' : 'border-[#723332]/30 text-[#723332] hover:border-[#723332]'}`}>Accept</button>
                              <button onClick={() => handleRsvpChange(member.id, event, 'no')} className={`font-subtitle px-8 py-3 border text-xs tracking-[0.15em] uppercase transition-all duration-300 ${member.rsvps?.[event] === 'no' ? 'bg-[#4b483c] text-[#f1ece0] border-[#4b483c]' : 'border-[#723332]/30 text-[#723332] hover:border-[#4b483c] hover:text-[#4b483c]'}`}>Decline</button>
                            </div>
                          </div>
                        ))}
                        {(!member.events || member.events.length === 0) && <p className="font-details text-lg text-[#4b483c]/60 italic">No events assigned.</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-16 text-center">
                  <button onClick={() => setSelectedHousehold(null)} className="font-subtitle bg-[#723332] text-[#f1ece0] px-12 py-4 tracking-[0.15em] uppercase text-xs hover:bg-[#4b483c] transition-colors shadow-lg">Complete RSVP</button>
                </div>
              </div>
            </div>
          )}

          <footer className="py-12 bg-[#f1ece0] border-t border-[#723332]/10 text-center relative z-20">
            <p className="font-title text-[#723332] text-2xl">J & S</p>
            <button onClick={() => setShowAdminLogin(true)} className="absolute bottom-6 right-6 text-[#723332]/10 hover:text-[#723332]/40 transition-colors">
              <Lock className="w-4 h-4" />
            </button>
          </footer>
        </>
      )}

      {/* =========================================
          ADMIN DASHBOARD UI (Maintained standard sans-serif for readability)
          ========================================= */}
      {isAdmin && (
        <div className="min-h-screen p-4 flex flex-col items-center bg-gray-100 font-sans">
          <div className="w-full max-w-6xl bg-white rounded-lg shadow-xl overflow-hidden min-h-[80vh] flex flex-col mt-4">
            
            <div className="bg-[#723332] text-[#f1ece0] p-6 flex justify-between items-center">
              <h2 className="font-serif text-2xl">Guest & RSVP Management</h2>
              <button onClick={() => setIsAdmin(false)} className="text-sm tracking-[0.1em] uppercase opacity-80 hover:opacity-100">Close Admin</button>
            </div>

            <div className="flex border-b border-gray-200 bg-gray-50 text-sm font-medium tracking-wide text-gray-500 overflow-x-auto">
              <button onClick={() => setDashboardTab('stats')} className={`px-8 py-4 uppercase whitespace-nowrap ${dashboardTab === 'stats' ? 'text-[#723332] border-b-2 border-[#723332] bg-white' : 'hover:bg-gray-100'}`}>Overview & Stats</button>
              <button onClick={() => setDashboardTab('list')} className={`px-8 py-4 uppercase whitespace-nowrap ${dashboardTab === 'list' ? 'text-[#723332] border-b-2 border-[#723332] bg-white' : 'hover:bg-gray-100'}`}>Guest List Editor</button>
            </div>

            {dashboardTab === 'stats' && (
              <div className="p-8 space-y-8 flex-1">
                <div className="grid md:grid-cols-2 gap-8">
                  {allUniqueEvents.length === 0 ? (
                    <div className="col-span-2 text-center py-12 border-2 border-dashed border-gray-200 rounded-lg text-gray-400">No events or guests found in the database.</div>
                  ) : (
                    allUniqueEvents.map(eventName => {
                      const stats = calcStats(eventName);
                      return (
                        <div key={eventName} className="bg-[#f1ece0]/30 p-6 rounded border border-[#723332]/10">
                          <h3 className="font-serif text-xl text-[#723332] mb-6">{eventName}</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded shadow-sm text-center">
                              <p className="text-3xl text-[#723332] font-serif">{stats.total}</p>
                              <p className="text-xs uppercase tracking-widest text-[#4b483c] mt-1">Invited</p>
                            </div>
                            <div className="bg-white p-4 rounded shadow-sm text-center">
                              <p className="text-3xl text-green-700 font-serif">{stats.yes}</p>
                              <p className="text-xs uppercase tracking-widest text-[#4b483c] mt-1">Accepted</p>
                            </div>
                            <div className="bg-white p-4 rounded shadow-sm text-center">
                              <p className="text-3xl text-red-700 font-serif">{stats.no}</p>
                              <p className="text-xs uppercase tracking-widest text-[#4b483c] mt-1">Declined</p>
                            </div>
                            <div className="bg-white p-4 rounded shadow-sm text-center">
                              <p className="text-3xl text-gray-400 font-serif">{stats.pending}</p>
                              <p className="text-xs uppercase tracking-widest text-[#4b483c] mt-1">Pending</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="font-serif text-xl text-[#723332] mb-4">Bulk Upload Guests</h3>
                  <label className="flex items-center gap-2 cursor-pointer bg-white border border-[#4b483c] text-[#4b483c] px-6 py-3 rounded-sm hover:bg-[#4b483c] hover:text-white transition-colors w-max">
                    <Upload className="w-5 h-5" />
                    <span className="uppercase tracking-wider text-sm font-medium">Select CSV File</span>
                    <input type="file" accept=".csv" onChange={processCsvUpload} className="hidden" />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">Required columns: Name, Household, Events. Optional: Household #, Age Range.</p>
                </div>
              </div>
            )}

            {dashboardTab === 'list' && (
              <div className="flex-1 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-white">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input type="text" placeholder="Search by Name, Household, or ID..." value={dashboardSearch} onChange={(e) => setDashboardSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded outline-none focus:border-[#723332] text-sm text-[#723332]" />
                    {dashboardSearch && <button onClick={() => setDashboardSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
                  </div>
                  <div className="flex gap-4">
                    <button onClick={handleOpenAddForm} className="flex items-center gap-2 bg-[#723332] text-white px-4 py-2 rounded-sm text-sm uppercase tracking-wider hover:bg-[#4b483c] transition-colors"><UserPlus className="w-4 h-4" /> Add Household</button>
                    <button onClick={exportToCsv} className="flex items-center gap-2 bg-white border border-[#723332] text-[#723332] px-4 py-2 rounded-sm text-sm uppercase tracking-wider hover:bg-gray-50 transition-colors"><Download className="w-4 h-4" /> Export CSV</button>
                  </div>
                </div>

                {showAddForm && (
                  <div className="bg-gray-50 p-6 border-b border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-serif text-lg text-[#723332]">Add New Guests</h3>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Household #</p>
                        <input type="text" value={newHouseholdId} onChange={(e) => setNewHouseholdId(e.target.value)} className="w-24 text-sm p-1 border border-gray-300 rounded outline-none focus:border-[#723332] text-center" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <input type="text" placeholder="Household Name (e.g. The Doe Family)" value={newHouseholdName} onChange={(e) => setNewHouseholdName(e.target.value)} className="w-full md:w-1/2 p-2 border border-gray-300 rounded outline-none focus:border-[#723332]" />
                      <div className="flex items-center gap-2 bg-white p-3 rounded border border-gray-200 shadow-sm w-full md:w-1/2">
                        <span className="text-xs uppercase text-gray-500 font-medium">Create New Event Type:</span>
                        <input type="text" placeholder="e.g. Sangeet" value={newCustomEvent} onChange={(e) => setNewCustomEvent(e.target.value)} className="flex-1 text-sm p-1 border-b border-gray-300 outline-none focus:border-[#723332]" />
                        <button onClick={handleAddCustomEventToForm} className="text-xs bg-gray-200 px-3 py-1 rounded hover:bg-gray-300 transition-colors">Add</button>
                      </div>

                      {newMembers.map((member, index) => (
                        <div key={index} className="flex flex-col gap-4 bg-white p-4 rounded border border-gray-200 shadow-sm">
                          <div className="flex flex-wrap items-center gap-4">
                            <input type="text" placeholder="Guest Full Name" value={member.name} onChange={(e) => handleUpdateMember(index, 'name', e.target.value)} className="flex-1 min-w-[200px] p-2 border border-gray-300 rounded outline-none focus:border-[#723332]" />
                            <select value={member.ageRange} onChange={(e) => handleUpdateMember(index, 'ageRange', e.target.value)} className="p-2 border border-gray-300 rounded outline-none focus:border-[#723332] bg-white">
                              <option value="Adult">Adult</option><option value="Child">Child</option><option value="Infant">Infant</option>
                            </select>
                            {newMembers.length > 1 && <button onClick={() => handleRemoveMemberRow(index)} className="text-red-400 hover:text-red-600 ml-auto"><Trash2 className="w-5 h-5" /></button>}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
                            <span className="text-xs uppercase text-gray-400 w-full md:w-auto">Invited To:</span>
                            {formAvailableEvents.length === 0 && <span className="text-xs text-gray-400 italic">No events defined yet. Add one above.</span>}
                            {formAvailableEvents.map(evt => (
                              <label key={evt} className="flex items-center gap-1.5 text-sm text-[#4b483c] cursor-pointer bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                <input type="checkbox" checked={member.events.includes(evt)} onChange={() => handleUpdateMember(index, 'events', evt)} className="accent-[#723332]" /> {evt}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-4 pt-2">
                        <button onClick={handleAddMemberRow} className="text-[#4b483c] text-sm uppercase tracking-wider font-medium flex items-center gap-1 hover:text-[#723332]"><Plus className="w-4 h-4" /> Add Person to Household</button>
                        <button onClick={submitNewHousehold} className="bg-[#4b483c] text-white px-6 py-2 rounded-sm text-sm uppercase tracking-wider ml-auto hover:bg-[#723332]">Save to Guest List</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-auto bg-white">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead className="sticky top-0 bg-gray-100 border-b border-gray-300 z-10 shadow-sm text-xs uppercase tracking-wider text-gray-600">
                      <tr>
                        <th onClick={() => handleSort('name')} className="px-6 py-4 font-medium cursor-pointer hover:bg-gray-200 transition-colors">Guest Name <SortIndicator columnKey="name" /></th>
                        <th onClick={() => handleSort('household')} className="px-6 py-4 font-medium cursor-pointer hover:bg-gray-200 transition-colors">Household <SortIndicator columnKey="household" /></th>
                        <th onClick={() => handleSort('ageRange')} className="px-6 py-4 font-medium cursor-pointer hover:bg-gray-200 transition-colors">Age Range <SortIndicator columnKey="ageRange" /></th>
                        {allUniqueEvents.map(evt => (
                          <th key={evt} onClick={() => handleSort(evt)} className="px-6 py-4 font-medium text-center cursor-pointer hover:bg-gray-200 transition-colors">{evt} <SortIndicator columnKey={evt} /></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-[#4b483c]">
                      {processedGuests.map((guest) => (
                        <tr key={guest.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-[#723332]">{guest.name}</td>
                          <td className="px-6 py-3">{guest.household} <span className="block text-xs text-gray-400 mt-0.5">ID: {guest.householdId}</span></td>
                          <td className="px-6 py-3 text-sm text-gray-500">{guest.ageRange || 'Adult'}</td>
                          {allUniqueEvents.map(evt => {
                            const isInvited = guest.events?.includes(evt);
                            const status = isInvited ? (guest.rsvps?.[evt] || 'pending') : 'not_invited';
                            return (
                              <td key={evt} className="px-6 py-3 text-center border-l border-gray-100">
                                <select value={status} onChange={(e) => handleAdminEventAndRsvpUpdate(guest, evt, e.target.value)} className={`text-xs uppercase tracking-wider font-medium outline-none cursor-pointer border px-2 py-1 rounded transition-colors ${status === 'yes' ? 'bg-green-50 text-green-700 border-green-200' : status === 'no' ? 'bg-red-50 text-red-700 border-red-200' : status === 'not_invited' ? 'bg-gray-100 text-gray-400 border-transparent hover:border-gray-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'}`}>
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
                    <div className="text-center py-12 text-gray-400 font-serif text-lg">
                      {dashboardSearch ? `No guests found matching "${dashboardSearch}"` : 'No guests added yet. Upload a CSV or add a household manually.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <form onSubmit={handleAdminLogin} className="bg-[#f1ece0] p-8 md:p-12 rounded shadow-2xl flex flex-col items-center border-t-4 border-[#723332] animate-in zoom-in-95">
            <Lock className="w-8 h-8 text-[#723332] mb-4" />
            <h3 className="font-serif text-2xl text-[#723332] mb-8">Admin Access</h3>
            <input type="password" placeholder="Enter PIN" value={pin} onChange={(e) => setPin(e.target.value)} className="border border-[#723332]/30 bg-white px-4 py-3 text-center text-2xl tracking-widest focus:border-[#723332] outline-none mb-8 w-56 font-serif" autoFocus />
            <div className="flex gap-4 w-full">
              <button type="button" onClick={() => setShowAdminLogin(false)} className="flex-1 border border-[#723332]/30 text-[#723332] hover:bg-[#723332]/5 py-3 text-xs tracking-widest uppercase transition-colors">Cancel</button>
              <button type="submit" className="flex-1 bg-[#723332] text-[#f1ece0] py-3 text-xs tracking-widest uppercase hover:bg-[#4b483c] transition-colors">Login</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}