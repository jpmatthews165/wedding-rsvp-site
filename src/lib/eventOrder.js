import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';

export { sortEventsByConfig } from './sortEvents.js';

// Live event order for the admin dashboard (Firebase SDK).
export const useEventOrder = () => {
  const [order, setOrder] = useState([]);
  useEffect(() => onSnapshot(
    doc(db, 'settings', 'events'),
    (snap) => { if (snap.exists() && snap.data().order) setOrder(snap.data().order); },
    (err) => console.error('Event order listener error:', err)
  ), []);
  return [order, setOrder];
};
