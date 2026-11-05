import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';

// Sorts event names using the order saved in settings/events (admin → Event Order tab).
export const sortEventsByConfig = (eventsArray, orderConfig) => {
  return [...eventsArray].sort((a, b) => {
    const indexA = orderConfig.indexOf(a);
    const indexB = orderConfig.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });
};

export const useEventOrder = () => {
  const [order, setOrder] = useState([]);
  useEffect(() => onSnapshot(
    doc(db, 'settings', 'events'),
    (snap) => { if (snap.exists() && snap.data().order) setOrder(snap.data().order); },
    (err) => console.error('Event order listener error:', err)
  ), []);
  return [order, setOrder];
};
