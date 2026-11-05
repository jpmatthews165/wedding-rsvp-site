import { useEffect, useState } from 'react';
import { readPublicDoc } from '../content/publicRead.js';

// Sorts event names using the order saved in settings/events (admin → Events page).
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

// Event order for the public RSVP form (read once, no Firebase SDK).
export const usePublicEventOrder = () => {
  const [order, setOrder] = useState([]);
  useEffect(() => {
    readPublicDoc('settings/events').then((d) => { if (Array.isArray(d?.order)) setOrder(d.order); }).catch(() => {});
  }, []);
  return order;
};
