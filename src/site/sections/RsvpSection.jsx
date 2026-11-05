import { useState } from 'react';
import { Search, X } from 'lucide-react';
import ParallaxBackground from '../../components/ParallaxBackground.jsx';
import RevealOnScroll from '../RevealOnScroll.jsx';
import { T, useSection, useEdit, ImageButton } from '../editing.jsx';
import { sortEventsByConfig, useEventOrder } from '../../lib/eventOrder.js';

// Guest-facing calls to the /api serverless functions (see /api/*.js).
const postJson = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
};

export default function RsvpSection() {
  const { section } = useSection();
  const edit = useEdit();
  const [eventOrder] = useEventOrder();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [household, setHousehold] = useState(null);
  const [rsvpError, setRsvpError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (edit) return;
    setSearchError('');
    setSearchResults([]);
    const name = searchTerm.trim();
    if (name.split(/\s+/).length < 2) {
      setSearchError('Please enter your full first and last name.');
      return;
    }
    setIsSearching(true);
    try {
      const { matches } = await postJson('/api/lookup', { name });
      if (!matches?.length) setSearchError("We couldn't find a match. Please check spelling and try again.");
      else setSearchResults(matches.map((m) => ({ ...m, searchedName: name })));
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const openHousehold = async (match) => {
    setSearchError('');
    setRsvpError('');
    setIsSearching(true);
    try {
      const data = await postJson('/api/household', { name: match.searchedName, guestId: match.guestId });
      setHousehold({ name: data.household, members: data.members, searcherName: match.searchedName, searcherId: match.guestId });
      setSearchTerm('');
      setSearchResults([]);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const setLocal = (memberId, event, answer) => setHousehold((prev) => prev && ({
    ...prev,
    members: prev.members.map((m) => (m.id === memberId ? { ...m, rsvps: { ...(m.rsvps || {}), [event]: answer } } : m)),
  }));

  const handleRsvp = async (memberId, event, answer) => {
    const previous = household?.members.find((m) => m.id === memberId)?.rsvps?.[event];
    setRsvpError('');
    setLocal(memberId, event, answer);
    try {
      await postJson('/api/rsvp', { name: household.searcherName, guestId: household.searcherId, memberId, event, answer });
    } catch (err) {
      setLocal(memberId, event, previous);
      setRsvpError(err.message);
    }
  };

  return (
    <>
      <section id={section.id} className="relative min-h-screen flex items-center justify-center py-24 px-6 overflow-hidden border-t border-brand/15 bg-paper2">
        {section.image && <ParallaxBackground image={section.image} pos={section.imagePos} speed={0.3} />}
        <div className="absolute inset-0 bg-paper/85 backdrop-blur-sm z-10 pointer-events-none" />
        <ImageButton f="image" className="bottom-6 right-6" />
        <div className="max-w-xl w-full text-center relative z-20">
          <RevealOnScroll className="space-y-4 mb-16">
            <T f="eyebrow" as="p" className="font-subtitle tracking-[0.15em] uppercase text-xs md:text-sm text-ink" />
            <T f="title" as="h2" className="font-title text-5xl md:text-7xl text-brand" />
          </RevealOnScroll>

          <RevealOnScroll delay={150} className="relative w-full max-w-md mx-auto">
            <form onSubmit={handleSearch} className="relative flex items-center border-b border-ink group">
              <Search className="absolute left-2 text-brand w-5 h-5 transition-colors group-focus-within:text-ink" />
              <input
                type="text"
                placeholder={section.placeholder}
                value={searchTerm}
                readOnly={!!edit}
                onChange={(e) => { setSearchTerm(e.target.value); setSearchError(''); }}
                className="w-full pl-10 pr-28 py-4 bg-transparent outline-none text-lg md:text-xl text-ink placeholder:text-ink/50 font-subtitle tracking-wide"
              />
              <button type="submit" disabled={isSearching} className="absolute right-0 font-subtitle text-xs tracking-[0.15em] uppercase text-ink hover:text-brand transition-colors pr-2 disabled:opacity-50">
                {isSearching ? 'Searching…' : <T f="buttonText" />}
              </button>
            </form>
            {edit && <p className="font-sans text-xs text-ink/60 mt-3">Guest search is turned off while editing. Edit the placeholder text in the side panel.</p>}

            {searchError && (
              <p role="alert" className="font-subtitle text-ink text-xs mt-4 tracking-normal bg-accent/30 py-3 px-4 rounded border border-accent/50 uppercase">{searchError}</p>
            )}

            {searchResults.length > 0 && !searchError && (
              <div className="absolute w-full mt-2 bg-paper border border-ink/20 shadow-2xl max-h-64 overflow-y-auto text-left z-50">
                {searchResults.map((g) => (
                  <button key={g.guestId} disabled={isSearching} onClick={() => openHousehold(g)} className="w-full text-left px-6 py-5 border-b border-ink/10 last:border-0 hover:bg-brand/5 transition-colors">
                    <p className="font-subtitle text-2xl tracking-normal text-brand">{g.name}</p>
                    <p className="font-subtitle text-xs tracking-widest uppercase text-ink mt-2 opacity-80">{g.household}</p>
                  </button>
                ))}
              </div>
            )}
          </RevealOnScroll>
        </div>
      </section>

      {household && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-paper p-8 md:p-16 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative border border-ink/10">
            <button onClick={() => setHousehold(null)} aria-label="Close" className="absolute top-8 right-8 text-brand hover:text-ink transition-colors">
              <X className="w-8 h-8 stroke-[1]" />
            </button>
            <div className="text-center mb-12">
              <h2 className="font-title text-5xl text-brand">{household.name}</h2>
              <div className="h-px w-16 bg-brand/40 mx-auto mt-6" />
            </div>
            <div className="space-y-12">
              {household.members.map((member) => (
                <div key={member.id} className="border-b border-ink/10 pb-8 last:border-0 last:pb-0">
                  <h3 className="font-subtitle text-2xl tracking-normal text-brand mb-8">{member.name}</h3>
                  <div className="space-y-6 md:pl-4">
                    {sortEventsByConfig(member.events || [], eventOrder).map((event) => (
                      <div key={event} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <span className="font-subtitle text-ink tracking-[0.1em] uppercase text-sm">{event}</span>
                        <div className="flex gap-4">
                          <button onClick={() => handleRsvp(member.id, event, 'yes')} className={`font-subtitle px-8 py-3 border text-xs tracking-[0.15em] uppercase transition-all duration-300 ${member.rsvps?.[event] === 'yes' ? 'bg-brand text-paper border-brand' : 'border-ink/30 text-ink hover:border-brand'}`}>Accept</button>
                          <button onClick={() => handleRsvp(member.id, event, 'no')} className={`font-subtitle px-8 py-3 border text-xs tracking-[0.15em] uppercase transition-all duration-300 ${member.rsvps?.[event] === 'no' ? 'bg-accent text-ink border-accent' : 'border-ink/30 text-ink hover:border-accent'}`}>Decline</button>
                        </div>
                      </div>
                    ))}
                    {(!member.events || member.events.length === 0) && <p className="font-details text-lg text-ink/60 italic">No events assigned.</p>}
                  </div>
                </div>
              ))}
            </div>
            {rsvpError && (
              <p role="alert" className="font-subtitle text-ink text-xs mt-10 tracking-normal bg-accent/30 py-3 px-4 rounded border border-accent/50 uppercase text-center">{rsvpError}</p>
            )}
            <div className="mt-16 text-center">
              <button onClick={() => setHousehold(null)} className="font-subtitle bg-brand text-paper px-12 py-4 tracking-[0.15em] uppercase text-xs hover:bg-brand-dark transition-colors shadow-lg">
                {section.completeButtonText || 'Complete RSVP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
