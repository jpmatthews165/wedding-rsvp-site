import { useState } from 'react';
import { sortEventsByConfig, usePublicEventOrder } from '../../lib/sortEvents.js';

// ---------------------------------------------------------------------------
// RSVP behaviour (protected). Search, loading a household and saving answers.
// RsvpSection.jsx only decides how this looks. Design-change requests from the
// editor may restyle RsvpSection.jsx but can never edit this file.
// ---------------------------------------------------------------------------

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

export default function useRsvp({ disabled = false } = {}) {
  const eventOrder = usePublicEventOrder();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [household, setHousehold] = useState(null);
  const [rsvpError, setRsvpError] = useState('');

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (disabled) return;
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

  const answer = async (memberId, event, value) => {
    const previous = household?.members.find((m) => m.id === memberId)?.rsvps?.[event];
    setRsvpError('');
    setLocal(memberId, event, value);
    try {
      await postJson('/api/rsvp', { name: household.searcherName, guestId: household.searcherId, memberId, event, answer: value });
    } catch (err) {
      setLocal(memberId, event, previous);
      setRsvpError(err.message);
    }
  };

  return {
    searchTerm,
    setSearchTerm: (v) => { setSearchTerm(v); setSearchError(''); },
    search: handleSearch,
    isSearching,
    searchError,
    searchResults,
    openHousehold,
    household,
    closeHousehold: () => setHousehold(null),
    answer,
    rsvpError,
    // Events for one guest, in the couple's chosen order.
    eventsFor: (member) => sortEventsByConfig(member.events || [], eventOrder),
  };
}
